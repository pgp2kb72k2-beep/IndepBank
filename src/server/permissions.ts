import { ForbiddenError } from "./errors";

export type Role = "owner" | "admin" | "viewer";

export type Action =
  | "read"
  | "write" // create / edit / delete business data and settings
  | "manage_members" // add, remove and change admins and viewers
  | "manage_owners" // grant or revoke the owner role
  | "delete_organization";

const PERMISSIONS: Record<Role, ReadonlySet<Action>> = {
  owner: new Set(["read", "write", "manage_members", "manage_owners", "delete_organization"]),
  admin: new Set(["read", "write", "manage_members"]),
  viewer: new Set(["read"]),
};

export function can(role: Role, action: Action): boolean {
  return PERMISSIONS[role].has(action);
}

export function assertCan(ctx: { role: Role }, action: Action): void {
  if (!can(ctx.role, action)) throw new ForbiddenError(`Role ${ctx.role} cannot ${action}`);
}
