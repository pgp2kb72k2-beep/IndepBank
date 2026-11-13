import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { bankAccount, bankTransaction, department } from "@/db/schema";
import { NotFoundError } from "@/server/errors";
import {
  getOrganization,
  listMembers,
  removeMember,
  resolveOrgContext,
  updateOrganizationSettings,
} from "@/server/organizations";
import { scoped, type OrgContext } from "@/server/scoped";
import { createOrgWithOwner, departmentValues, resetDb } from "./helpers";

/**
 * Organization isolation: nobody can read or change another organization's data,
 * and the database itself refuses to link rows across organizations.
 */
describe("organization isolation", () => {
  let a: OrgContext;
  let b: OrgContext;
  let deptA: typeof department.$inferSelect;

  beforeEach(async () => {
    await resetDb();
    a = await createOrgWithOwner("Distribuidora Sur");
    b = await createOrgWithOwner("Competencia SA");
    deptA = await scoped(a).create(department, "department", departmentValues("Operaciones A"));
    await scoped(b).create(department, "department", departmentValues("Operaciones B"));
  });

  it("lists only the current organization's rows", async () => {
    const rowsA = await scoped(a).findMany(department);
    const rowsB = await scoped(b).findMany(department);
    expect(rowsA.map((d) => d.name)).toEqual(["Operaciones A"]);
    expect(rowsB.map((d) => d.name)).toEqual(["Operaciones B"]);
  });

  it("another organization's row looks exactly like a missing one", async () => {
    await expect(scoped(b).findById(department, "department", deptA.id)).rejects.toThrow(
      NotFoundError,
    );
    await expect(scoped(b).findById(department, "department", randomUUID())).rejects.toThrow(
      NotFoundError,
    );
  });

  it("cannot update or delete another organization's row", async () => {
    await expect(
      scoped(b).update(department, "department", deptA.id, { name: "Hackeado" }),
    ).rejects.toThrow(NotFoundError);
    await expect(scoped(b).remove(department, "department", deptA.id)).rejects.toThrow(
      NotFoundError,
    );
    const [still] = await db.select().from(department).where(eq(department.id, deptA.id));
    expect(still?.name).toBe("Operaciones A");
  });

  it("ignores any organizationId sent by the caller on create and update", async () => {
    const created = await scoped(b).create(department, "department", {
      ...departmentValues("Intruso"),
      organizationId: a.organizationId,
    } as never);
    expect(created.organizationId).toBe(b.organizationId);

    const moved = await scoped(b).update(department, "department", created.id, {
      organizationId: a.organizationId,
    } as never);
    expect(moved.organizationId).toBe(b.organizationId);
  });

  it("the database rejects links between organizations (composite foreign keys)", async () => {
    const [accountB] = await db
      .insert(bankAccount)
      .values({
        organizationId: b.organizationId,
        name: "Cuenta B",
        bankName: "BROU",
        currency: "USD",
        openingBalanceDate: "2026-11-01",
      })
      .returning();

    // Even bypassing the app layer, B's transaction cannot point to A's department.
    await expect(
      db.insert(bankTransaction).values({
        organizationId: b.organizationId,
        bankAccountId: accountB!.id,
        date: "2026-11-02",
        description: "Pago",
        descriptionNormalized: "pago",
        amount: -100n,
        currency: "USD",
        type: "expense",
        departmentId: deptA.id,
        dedupeHash: "x",
      }),
    ).rejects.toMatchObject({ cause: { constraint: "transaction_department_fk" } });
  });

  it("organization data and members are only reachable through one's own context", async () => {
    expect((await getOrganization(b)).name).toBe("Competencia SA");
    const membersOfB = await listMembers(b);
    expect(membersOfB).toHaveLength(1);
    expect(membersOfB[0]?.userId).toBe(b.userId);

    // A's owner cannot remove B's owner using B's membership id.
    await expect(removeMember(a, membersOfB[0]!.id)).rejects.toThrow(NotFoundError);

    await updateOrganizationSettings(b, { horizonDays: 45 });
    expect((await getOrganization(a)).horizonDays).toBe(30);
  });

  it("a forged 'active organization' the user does not belong to is ignored", async () => {
    const ctx = await resolveOrgContext(b.userId, a.organizationId);
    expect(ctx?.organizationId).toBe(b.organizationId);
  });

  it("a user without memberships has no context", async () => {
    await db.execute(sql`DELETE FROM membership WHERE user_id = ${b.userId}`);
    expect(await resolveOrgContext(b.userId)).toBeNull();
  });
});
