import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, department, user } from "@/db/schema";
import { createOrganization, resolveOrgContext } from "@/server/organizations";
import type { Role } from "@/server/permissions";
import type { OrgContext } from "@/server/scoped";
import { eq } from "drizzle-orm";

/** Empties every table. Cascades from the roots cover all business data. */
export async function resetDb() {
  await db.execute(
    sql`TRUNCATE TABLE "user", organization, verification, rate_limit RESTART IDENTITY CASCADE`,
  );
}

export async function createUser(email = `${randomUUID()}@test.uy`) {
  const [row] = await db
    .insert(user)
    .values({ id: randomUUID(), name: email.split("@")[0]!, email })
    .returning();
  return row!;
}

/** A fresh organization owned by a fresh user; returns the owner's context. */
export async function createOrgWithOwner(name = "Empresa"): Promise<OrgContext> {
  const owner = await createUser();
  const org = await createOrganization(owner.id, { name, baseCurrency: "USD" });
  return { userId: owner.id, organizationId: org.id, role: "owner" };
}

/** Adds a new user with `role` directly (bypassing permission checks) and returns their context. */
export async function addUserWithRole(ctx: OrgContext, role: Role): Promise<OrgContext> {
  const member = await createUser();
  await db.execute(
    sql`INSERT INTO membership (organization_id, user_id, role) VALUES (${ctx.organizationId}, ${member.id}, ${role})`,
  );
  const resolved = await resolveOrgContext(member.id, ctx.organizationId);
  return resolved!;
}

export const departmentValues = (name = "Operaciones") => ({
  name,
  color: "#1A5CFF",
  icon: "briefcase",
  minimumReserve: 500_000n,
  currency: "USD" as const,
  sortOrder: 1,
});

export async function auditFor(organizationId: string) {
  return db
    .select()
    .from(auditLog)
    .where(eq(auditLog.organizationId, organizationId))
    .orderBy(auditLog.createdAt);
}

export { department };
