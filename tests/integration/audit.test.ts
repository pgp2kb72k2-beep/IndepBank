import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { auditLog, department } from "@/db/schema";
import { toAuditJson } from "@/server/audit";
import { addMember, removeMember, updateOrganizationSettings } from "@/server/organizations";
import { scoped, type OrgContext } from "@/server/scoped";
import { auditFor, createOrgWithOwner, createUser, departmentValues, resetDb } from "./helpers";

describe("audit log", () => {
  let ctx: OrgContext;

  beforeEach(async () => {
    await resetDb();
    ctx = await createOrgWithOwner();
  });

  it("records the organization and owner membership on creation", async () => {
    const entries = await auditFor(ctx.organizationId);
    expect(entries.map((e) => `${e.action}:${e.entity}`)).toEqual([
      "create:organization",
      "create:membership",
    ]);
    expect(entries.every((e) => e.userId === ctx.userId)).toBe(true);
  });

  it("records create, update and delete with before/after (money as strings)", async () => {
    const s = scoped(ctx);
    const created = await s.create(department, "department", departmentValues());
    await s.update(department, "department", created.id, { minimumReserve: 1_000_000n });
    await s.remove(department, "department", created.id);

    const entries = (await auditFor(ctx.organizationId)).filter((e) => e.entity === "department");
    expect(entries.map((e) => e.action)).toEqual(["create", "update", "delete"]);
    const [create, update, remove] = entries;
    expect(create).toMatchObject({ entityId: created.id, before: null });
    expect(create?.after).toMatchObject({ name: "Operaciones", minimumReserve: "500000" });
    expect(update?.before).toMatchObject({ minimumReserve: "500000" });
    expect(update?.after).toMatchObject({ minimumReserve: "1000000" });
    expect(remove).toMatchObject({ after: null });
    expect(remove?.before).toMatchObject({ id: created.id });
  });

  it("records settings and membership changes", async () => {
    await updateOrganizationSettings(ctx, { horizonDays: 45 });
    await createUser("socio@empresa.uy");
    const m = await addMember(ctx, { email: "socio@empresa.uy", role: "admin" });
    await removeMember(ctx, m.id);

    const entries = await auditFor(ctx.organizationId);
    expect(entries.slice(2).map((e) => `${e.action}:${e.entity}`)).toEqual([
      "update:organization",
      "create:membership",
      "delete:membership",
    ]);
    expect(entries[2]?.before).toMatchObject({ horizonDays: 30 });
    expect(entries[2]?.after).toMatchObject({ horizonDays: 45 });
  });

  it("a failed change leaves neither the change nor an audit entry", async () => {
    const s = scoped(ctx);
    await expect(
      s.transaction(async (tx) => {
        await tx.create(department, "department", departmentValues("Temporal"));
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(await s.findMany(department)).toHaveLength(0);
    const entries = await db.select().from(auditLog);
    expect(entries.filter((e) => e.entity === "department")).toHaveLength(0);
  });

  it("serializes bigint and dates safely", () => {
    expect(toAuditJson({ a: 1n, d: new Date("2026-11-13T12:00:00Z") })).toEqual({
      a: "1",
      d: "2026-11-13T12:00:00.000Z",
    });
    expect(toAuditJson(undefined)).toBeNull();
  });
});
