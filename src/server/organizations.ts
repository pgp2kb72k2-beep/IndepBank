import "server-only";
import { and, asc, count, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { membership, organization, user } from "@/db/schema";
import {
  addMemberSchema,
  createOrganizationSchema,
  organizationSettingsSchema,
  type AddMemberInput,
  type CreateOrganizationInput,
  type OrganizationSettingsInput,
} from "@/lib/validation/organization";
import { writeAudit } from "./audit";
import type { Db, Tx } from "./db-types";
import { DomainError, NotFoundError } from "./errors";
import { assertCan, type Role } from "./permissions";
import type { OrgContext } from "./scoped";

/**
 * Resolves which organization a signed-in user is acting on, and with which role.
 * Returns null when the user has no membership (they must create an organization first).
 * A preferred organization the user does not belong to is ignored, never trusted.
 */
export async function resolveOrgContext(
  userId: string,
  preferredOrganizationId?: string | null,
  database: Db = db,
): Promise<OrgContext | null> {
  const memberships = await database
    .select({ organizationId: membership.organizationId, role: membership.role })
    .from(membership)
    .where(eq(membership.userId, userId))
    .orderBy(asc(membership.createdAt));

  const chosen =
    memberships.find((m) => m.organizationId === preferredOrganizationId) ?? memberships[0];
  return chosen ? { userId, organizationId: chosen.organizationId, role: chosen.role } : null;
}

/** Creates an organization and makes the creator its owner. */
export async function createOrganization(
  userId: string,
  input: CreateOrganizationInput,
  database: Db = db,
) {
  const data = createOrganizationSchema.parse(input);
  return database.transaction(async (tx) => {
    const [org] = await tx.insert(organization).values(data).returning();
    const created = org!;
    const [owner] = await tx
      .insert(membership)
      .values({ organizationId: created.id, userId, role: "owner" })
      .returning();
    const base = { organizationId: created.id, userId, action: "create" as const };
    await writeAudit(tx, { ...base, entity: "organization", entityId: created.id, after: created });
    await writeAudit(tx, { ...base, entity: "membership", entityId: owner!.id, after: owner });
    return created;
  });
}

export async function getOrganization(ctx: OrgContext, database: Db = db) {
  assertCan(ctx, "read");
  const [org] = await database
    .select()
    .from(organization)
    .where(eq(organization.id, ctx.organizationId));
  if (!org) throw new NotFoundError("organization");
  return org;
}

export async function updateOrganizationSettings(
  ctx: OrgContext,
  input: OrganizationSettingsInput,
  database: Db = db,
) {
  assertCan(ctx, "write");
  const patch = organizationSettingsSchema.parse(input);
  return database.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(organization)
      .where(eq(organization.id, ctx.organizationId))
      .for("update");
    if (!before) throw new NotFoundError("organization");
    const [after] = await tx
      .update(organization)
      .set(patch)
      .where(eq(organization.id, ctx.organizationId))
      .returning();
    await writeAudit(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "update",
      entity: "organization",
      entityId: ctx.organizationId,
      before,
      after,
    });
    return after!;
  });
}

/** Owner only. Deletes the organization and, by cascade, all of its data and audit log. */
export async function deleteOrganization(ctx: OrgContext, database: Db = db): Promise<void> {
  assertCan(ctx, "delete_organization");
  await database.delete(organization).where(eq(organization.id, ctx.organizationId));
}

// --- Members -----------------------------------------------------------------------------

export async function listMembers(ctx: OrgContext, database: Db = db) {
  assertCan(ctx, "read");
  return database
    .select({
      id: membership.id,
      role: membership.role,
      userId: user.id,
      name: user.name,
      email: user.email,
      createdAt: membership.createdAt,
    })
    .from(membership)
    .innerJoin(user, eq(user.id, membership.userId))
    .where(eq(membership.organizationId, ctx.organizationId))
    .orderBy(asc(membership.createdAt));
}

/** Adds an already registered user. (Email invitations are out of scope for the Basic plan.) */
export async function addMember(ctx: OrgContext, input: AddMemberInput, database: Db = db) {
  const { email, role } = addMemberSchema.parse(input);
  assertCanAssign(ctx, role);
  return database.transaction(async (tx) => {
    const [target] = await tx.select({ id: user.id }).from(user).where(eq(user.email, email));
    if (!target) throw new DomainError("user_not_found");
    const [existing] = await tx
      .select({ id: membership.id })
      .from(membership)
      .where(
        and(eq(membership.organizationId, ctx.organizationId), eq(membership.userId, target.id)),
      );
    if (existing) throw new DomainError("already_member");
    const [created] = await tx
      .insert(membership)
      .values({ organizationId: ctx.organizationId, userId: target.id, role })
      .returning();
    await auditMembership(tx, ctx, "create", created!.id, undefined, created);
    return created!;
  });
}

export async function changeMemberRole(
  ctx: OrgContext,
  membershipId: string,
  role: Role,
  database: Db = db,
) {
  assertCanAssign(ctx, role);
  return database.transaction(async (tx) => {
    const before = await lockMembership(tx, ctx, membershipId);
    assertCanAssign(ctx, before.role);
    if (before.role === "owner" && role !== "owner") await assertNotLastOwner(tx, ctx);
    const [after] = await tx
      .update(membership)
      .set({ role })
      .where(eq(membership.id, membershipId))
      .returning();
    await auditMembership(tx, ctx, "update", membershipId, before, after);
    return after!;
  });
}

export async function removeMember(ctx: OrgContext, membershipId: string, database: Db = db) {
  assertCan(ctx, "manage_members");
  await database.transaction(async (tx) => {
    const before = await lockMembership(tx, ctx, membershipId);
    assertCanAssign(ctx, before.role);
    if (before.role === "owner") await assertNotLastOwner(tx, ctx);
    await tx.delete(membership).where(eq(membership.id, membershipId));
    await auditMembership(tx, ctx, "delete", membershipId, before, undefined);
  });
}

/** Admins manage admins and viewers; only owners can grant or revoke the owner role. */
function assertCanAssign(ctx: OrgContext, role: Role) {
  assertCan(ctx, role === "owner" ? "manage_owners" : "manage_members");
}

async function lockMembership(tx: Tx, ctx: OrgContext, membershipId: string) {
  const [row] = await tx
    .select()
    .from(membership)
    .where(and(eq(membership.id, membershipId), eq(membership.organizationId, ctx.organizationId)))
    .for("update");
  if (!row) throw new NotFoundError("membership");
  return row;
}

async function assertNotLastOwner(tx: Tx, ctx: OrgContext) {
  const [result] = await tx
    .select({ owners: count() })
    .from(membership)
    .where(and(eq(membership.organizationId, ctx.organizationId), eq(membership.role, "owner")));
  if ((result?.owners ?? 0) <= 1) throw new DomainError("last_owner");
}

function auditMembership(
  tx: Tx,
  ctx: OrgContext,
  action: "create" | "update" | "delete",
  entityId: string,
  before: unknown,
  after: unknown,
) {
  return writeAudit(tx, {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action,
    entity: "membership",
    entityId,
    before,
    after,
  });
}
