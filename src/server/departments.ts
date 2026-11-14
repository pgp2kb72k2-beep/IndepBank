import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  allocationConfigItem,
  allocationConfigVersion,
  department,
  organization,
} from "@/db/schema";
import { monthStart, todayIn } from "@/lib/engine/dates";
import {
  reservesSchema,
  saveDepartmentsSchema,
  type SaveDepartmentsInput,
} from "@/lib/validation/departments";
import { writeAudit } from "./audit";
import type { Database, Db } from "./db-types";
import { NotFoundError } from "./errors";
import { assertCan } from "./permissions";
import { scoped, type OrgContext } from "./scoped";

export type DepartmentRow = typeof department.$inferSelect;

export interface AllocationState {
  /** Active departments in display order, with the percentage in force today. */
  departments: (DepartmentRow & { percentBp: number })[];
  /** Latest allocation version, or null if the organization has not configured one yet. */
  currentVersion: { id: string; effectiveFrom: string; createdAt: Date } | null;
}

/** Active departments and the latest allocation version. */
export async function getAllocationState(
  ctx: OrgContext,
  database: Database = db,
): Promise<AllocationState> {
  const scope = scoped(ctx, database);
  const departments = (await scope.findMany(department, eq(department.active, true))).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const [version] = await database
    .select()
    .from(allocationConfigVersion)
    .where(scope.owns(allocationConfigVersion))
    .orderBy(desc(allocationConfigVersion.createdAt))
    .limit(1);

  const percents = new Map<string, number>();
  if (version) {
    const items = await database
      .select()
      .from(allocationConfigItem)
      .where(
        and(
          eq(allocationConfigItem.organizationId, ctx.organizationId),
          eq(allocationConfigItem.versionId, version.id),
        ),
      );
    for (const item of items) percents.set(item.departmentId, item.percentBp);
  }

  return {
    departments: departments.map((d) => ({ ...d, percentBp: percents.get(d.id) ?? 0 })),
    currentVersion: version
      ? { id: version.id, effectiveFrom: version.effectiveFrom, createdAt: version.createdAt }
      : null,
  };
}

/**
 * Saves the full department setup in one transaction:
 * - creates new departments, updates existing ones, deactivates the ones left out;
 * - when percentages change (or a recalculation is asked), creates a new allocation version.
 *
 * Percentage changes apply from today on. With `recalculateCurrentPeriod` they apply from
 * the first day of the current month, so this month's incomes are redistributed.
 */
export async function saveDepartments(
  ctx: OrgContext,
  input: SaveDepartmentsInput,
  database: Db = db,
): Promise<AllocationState> {
  assertCan(ctx, "write");
  const data = saveDepartmentsSchema.parse(input);
  const [org] = await database
    .select({ baseCurrency: organization.baseCurrency })
    .from(organization)
    .where(eq(organization.id, ctx.organizationId));
  if (!org) throw new NotFoundError("organization");

  await database.transaction(async (tx) => {
    const scope = scoped(ctx, tx);
    const existing = await scope.findMany(department);
    const byId = new Map(existing.map((d) => [d.id, d]));
    const claimedIds = new Set(data.departments.flatMap((d) => (d.id ? [d.id] : [])));
    // A row without id whose name already exists (active or not) reuses that department
    // instead of creating a duplicate: keeps its history and rules (e.g. a stale form).
    const byName = new Map(
      existing.filter((d) => !claimedIds.has(d.id)).map((d) => [d.name.toLocaleLowerCase("es"), d]),
    );
    const keptIds = new Set<string>();
    const finalPercents = new Map<string, number>();

    for (const [index, input] of data.departments.entries()) {
      const values = {
        name: input.name,
        color: input.color,
        icon: input.icon,
        minimumReserve: input.minimumReserve,
        sortOrder: index + 1,
        active: true,
      };
      let id: string;
      const reuse = input.id ? undefined : byName.get(input.name.toLocaleLowerCase("es"));
      if (input.id || reuse) {
        const current = reuse ?? byId.get(input.id!);
        if (!current) throw new NotFoundError("department");
        byName.delete(current.name.toLocaleLowerCase("es"));
        id = current.id;
        const changed = (Object.keys(values) as (keyof typeof values)[]).some(
          (key) => current[key] !== values[key],
        );
        if (changed) await scope.update(department, "department", id, values);
      } else {
        id = (
          await scope.create(department, "department", {
            ...values,
            currency: org.baseCurrency,
          })
        ).id;
      }
      keptIds.add(id);
      finalPercents.set(id, input.percentBp);
    }

    for (const d of existing) {
      if (d.active && !keptIds.has(d.id)) {
        await scope.update(department, "department", d.id, { active: false });
      }
    }

    const current = await getAllocationState(ctx, tx);
    const currentPercents = new Map(current.departments.map((d) => [d.id, d.percentBp]));
    const percentsChanged =
      !current.currentVersion ||
      currentPercents.size !== finalPercents.size ||
      [...finalPercents].some(([id, bp]) => currentPercents.get(id) !== bp);
    if (!percentsChanged && !data.recalculateCurrentPeriod) return;

    const today = todayIn();
    // DECISION: a change applies to incomes dated today or later (not only those imported
    // later), so the configuration in force on a date is always unambiguous.
    const effectiveFrom = data.recalculateCurrentPeriod ? monthStart(today) : today;
    const [version] = await tx
      .insert(allocationConfigVersion)
      .values({ organizationId: ctx.organizationId, effectiveFrom, createdBy: ctx.userId })
      .returning();
    const items = [...finalPercents]
      .filter(([, bp]) => bp > 0)
      .map(([departmentId, percentBp]) => ({
        organizationId: ctx.organizationId,
        versionId: version!.id,
        departmentId,
        percentBp,
      }));
    await tx.insert(allocationConfigItem).values(items);
    await writeAudit(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "create",
      entity: "allocation_config_version",
      entityId: version!.id,
      after: { ...version, items },
    });
  });

  return getAllocationState(ctx, database);
}

/** Updates minimum reserves (cents) of the given departments. */
export async function updateReserves(
  ctx: OrgContext,
  reserves: Record<string, bigint>,
  database: Db = db,
): Promise<void> {
  assertCan(ctx, "write");
  const data = reservesSchema.parse(reserves);
  await scoped(ctx, database).transaction(async (scope) => {
    for (const [id, minimumReserve] of Object.entries(data)) {
      const current = await scope.findById(department, "department", id);
      if (current.minimumReserve !== minimumReserve) {
        await scope.update(department, "department", id, { minimumReserve });
      }
    }
  });
}

/** All allocation versions, newest first (configuration history). */
export async function listAllocationVersions(ctx: OrgContext, database: Db = db) {
  assertCan(ctx, "read");
  return database
    .select()
    .from(allocationConfigVersion)
    .where(eq(allocationConfigVersion.organizationId, ctx.organizationId))
    .orderBy(desc(allocationConfigVersion.createdAt), asc(allocationConfigVersion.id));
}
