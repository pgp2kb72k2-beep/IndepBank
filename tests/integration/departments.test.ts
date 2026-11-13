import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { allocationConfigItem, department } from "@/db/schema";
import { monthStart, todayIn } from "@/lib/engine/dates";
import { DEPARTMENT_TEMPLATE } from "@/lib/validation/departments";
import { createRule, deleteRule, listRules, updateRule } from "@/server/classification-rules";
import {
  getAllocationState,
  listAllocationVersions,
  saveDepartments,
  updateReserves,
} from "@/server/departments";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { completeOnboarding, getOnboardingStep } from "@/server/onboarding";
import type { OrgContext } from "@/server/scoped";
import { addUserWithRole, auditFor, createOrgWithOwner, resetDb } from "./helpers";

const template = () => ({ departments: DEPARTMENT_TEMPLATE.map((d) => ({ ...d })) });

describe("departments and allocation", () => {
  let ctx: OrgContext;

  beforeEach(async () => {
    await resetDb();
    ctx = await createOrgWithOwner();
  });

  it("creates the template with its percentages and a first allocation version", async () => {
    const state = await saveDepartments(ctx, template());
    expect(state.departments.map((d) => `${d.name}:${d.percentBp}`)).toEqual([
      "Operaciones:3500",
      "Inventario:2500",
      "Impuestos:2000",
      "Logística:1000",
      "Marketing:500",
      "Reservas:500",
    ]);
    expect(state.departments.every((d) => d.currency === "USD")).toBe(true);
    expect(state.currentVersion?.effectiveFrom).toBe(todayIn());
  });

  it("refuses percentages that do not add up to 100% or repeated names", async () => {
    const bad = template();
    bad.departments[0]!.percentBp = 3400;
    await expect(saveDepartments(ctx, bad)).rejects.toThrow(/sum_not_100/);

    const dup = template();
    dup.departments[1]!.name = "operaciones";
    await expect(saveDepartments(ctx, dup)).rejects.toThrow(/duplicate_name/);
    expect((await getAllocationState(ctx)).departments).toHaveLength(0);
  });

  it("keeps history: changing percentages creates a new version; same percentages do not", async () => {
    const first = await saveDepartments(ctx, template());
    const edited = {
      departments: first.departments.map((d) => ({
        id: d.id,
        name: d.name,
        color: d.color as never,
        icon: d.icon as never,
        minimumReserve: d.minimumReserve,
        percentBp: d.name === "Operaciones" ? 3000 : d.name === "Marketing" ? 1000 : d.percentBp,
      })),
    };
    await saveDepartments(ctx, edited);
    await saveDepartments(ctx, edited); // no change → no new version
    expect(await listAllocationVersions(ctx)).toHaveLength(2);

    await saveDepartments(ctx, { ...edited, recalculateCurrentPeriod: true });
    const versions = await listAllocationVersions(ctx);
    expect(versions).toHaveLength(3);
    expect(versions[0]?.effectiveFrom).toBe(monthStart(todayIn()));
  });

  it("deactivates departments left out (history is kept) and stores no 0% items", async () => {
    const first = await saveDepartments(ctx, template());
    const [ops, ...rest] = first.departments;
    const withoutMarketing = rest
      .filter((d) => d.name !== "Marketing")
      .map((d) => ({ ...d, color: d.color as never, icon: d.icon as never }));
    const state = await saveDepartments(ctx, {
      departments: [
        { ...ops!, color: ops!.color as never, icon: ops!.icon as never, percentBp: 4000 },
        ...withoutMarketing,
      ],
    });
    expect(state.departments.map((d) => d.name)).not.toContain("Marketing");
    const [marketing] = await db.select().from(department).where(eq(department.name, "Marketing"));
    expect(marketing?.active).toBe(false);

    const items = await db
      .select()
      .from(allocationConfigItem)
      .where(eq(allocationConfigItem.versionId, state.currentVersion!.id));
    expect(items).toHaveLength(5);
  });

  it("updates reserves and audits every change", async () => {
    const { departments } = await saveDepartments(ctx, template());
    const ops = departments[0]!;
    await updateReserves(ctx, { [ops.id]: 500_000n });
    expect((await getAllocationState(ctx)).departments[0]?.minimumReserve).toBe(500_000n);

    const entities = (await auditFor(ctx.organizationId)).map((e) => `${e.action}:${e.entity}`);
    expect(entities.filter((e) => e === "create:department")).toHaveLength(6);
    expect(entities).toContain("create:allocation_config_version");
    expect(entities.at(-1)).toBe("update:department");
  });

  it("cannot touch another organization's departments", async () => {
    const other = await createOrgWithOwner("Otra");
    const { departments } = await saveDepartments(other, template());
    await expect(updateReserves(ctx, { [departments[0]!.id]: 1n })).rejects.toThrow(NotFoundError);
    await expect(
      saveDepartments(ctx, {
        departments: [{ ...DEPARTMENT_TEMPLATE[0]!, id: departments[0]!.id, percentBp: 10_000 }],
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("viewers cannot change the configuration", async () => {
    const viewer = await addUserWithRole(ctx, "viewer");
    await expect(saveDepartments(viewer, template())).rejects.toThrow(ForbiddenError);
    await expect(updateReserves(viewer, {})).rejects.toThrow(ForbiddenError);
  });
});

describe("classification rules", () => {
  let ctx: OrgContext;
  let taxes: string;

  beforeEach(async () => {
    await resetDb();
    ctx = await createOrgWithOwner();
    const { departments } = await saveDepartments(ctx, template());
    taxes = departments.find((d) => d.name === "Impuestos")!.id;
  });

  it("creates, lists by priority, updates and deletes rules", async () => {
    const dgi = await createRule(ctx, { matchText: " DGI ", departmentId: taxes });
    await createRule(ctx, { matchText: "BPS", departmentId: taxes, priority: 5 });
    expect((await listRules(ctx)).map((r) => r.matchText)).toEqual(["BPS", "DGI"]);

    await updateRule(ctx, dgi.id, { matchText: "DGI PAGO", departmentId: taxes, priority: 9 });
    expect((await listRules(ctx))[0]?.matchText).toBe("DGI PAGO");

    await deleteRule(ctx, dgi.id);
    expect(await listRules(ctx)).toHaveLength(1);
  });

  it("rejects a department of another organization", async () => {
    const other = await createOrgWithOwner("Otra");
    const { departments } = await saveDepartments(other, template());
    await expect(
      createRule(ctx, { matchText: "DGI", departmentId: departments[0]!.id }),
    ).rejects.toThrow(NotFoundError);
    await expect(createRule(ctx, { matchText: "DGI", departmentId: randomUUID() })).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("onboarding progress", () => {
  beforeEach(resetDb);

  it("company → departments → reserves → done", async () => {
    expect(await getOnboardingStep(null)).toBe("company");
    const ctx = await createOrgWithOwner();
    expect(await getOnboardingStep(ctx)).toBe("departments");
    await saveDepartments(ctx, template());
    expect(await getOnboardingStep(ctx)).toBe("reserves");
    await completeOnboarding(ctx);
    await completeOnboarding(ctx); // idempotent
    expect(await getOnboardingStep(ctx)).toBe("done");
  });
});
