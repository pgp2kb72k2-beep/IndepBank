import { beforeEach, describe, expect, it } from "vitest";
import { department } from "@/db/schema";
import { DomainError, ForbiddenError } from "@/server/errors";
import {
  addMember,
  changeMemberRole,
  deleteOrganization,
  getOrganization,
  listMembers,
  removeMember,
  updateOrganizationSettings,
} from "@/server/organizations";
import { DEPARTMENT_TEMPLATE } from "@/lib/validation/departments";
import { saveDepartments } from "@/server/departments";
import { can } from "@/server/permissions";
import { scoped, type OrgContext } from "@/server/scoped";
import {
  addUserWithRole,
  createOrgWithOwner,
  createUser,
  departmentValues,
  resetDb,
} from "./helpers";

describe("permission matrix", () => {
  it("owner: everything · admin: all but owners and deleting · viewer: read only", () => {
    expect(can("owner", "delete_organization")).toBe(true);
    expect(can("admin", "write")).toBe(true);
    expect(can("admin", "manage_members")).toBe(true);
    expect(can("admin", "manage_owners")).toBe(false);
    expect(can("admin", "delete_organization")).toBe(false);
    expect(can("viewer", "read")).toBe(true);
    expect(can("viewer", "write")).toBe(false);
  });
});

describe("roles against the database", () => {
  let owner: OrgContext;
  let admin: OrgContext;
  let viewer: OrgContext;
  let deptId: string;

  beforeEach(async () => {
    await resetDb();
    owner = await createOrgWithOwner();
    admin = await addUserWithRole(owner, "admin");
    viewer = await addUserWithRole(owner, "viewer");
    deptId = (await scoped(owner).create(department, "department", departmentValues())).id;
  });

  it("a viewer can read but cannot change anything", async () => {
    expect(await scoped(viewer).findMany(department)).toHaveLength(1);
    expect((await getOrganization(viewer)).id).toBe(owner.organizationId);

    const v = scoped(viewer);
    await expect(v.create(department, "department", departmentValues("X"))).rejects.toThrow(
      ForbiddenError,
    );
    await expect(v.update(department, "department", deptId, { name: "X" })).rejects.toThrow(
      ForbiddenError,
    );
    await expect(v.remove(department, "department", deptId)).rejects.toThrow(ForbiddenError);
    await expect(updateOrganizationSettings(viewer, { horizonDays: 10 })).rejects.toThrow(
      ForbiddenError,
    );
    await expect(addMember(viewer, { email: "a@b.uy", role: "viewer" })).rejects.toThrow(
      ForbiddenError,
    );
    await expect(deleteOrganization(viewer)).rejects.toThrow(ForbiddenError);
  });

  it("an admin edits data and manages admins/viewers, but not owners", async () => {
    await scoped(admin).update(department, "department", deptId, { name: "Ops" });
    const newcomer = await createUser("nuevo@empresa.uy");
    const added = await addMember(admin, { email: "NUEVO@empresa.uy ", role: "viewer" });
    expect(added.userId).toBe(newcomer.id);

    await expect(addMember(admin, { email: "nuevo@empresa.uy", role: "admin" })).rejects.toThrow(
      new DomainError("already_member"),
    );
    await expect(changeMemberRole(admin, added.id, "owner")).rejects.toThrow(ForbiddenError);

    const ownerMembership = (await listMembers(owner)).find((m) => m.role === "owner")!;
    await expect(removeMember(admin, ownerMembership.id)).rejects.toThrow(ForbiddenError);
    await expect(changeMemberRole(admin, ownerMembership.id, "viewer")).rejects.toThrow(
      ForbiddenError,
    );
    await expect(deleteOrganization(admin)).rejects.toThrow(ForbiddenError);
  });

  it("only registered users can be added", async () => {
    await expect(addMember(owner, { email: "nadie@empresa.uy", role: "viewer" })).rejects.toThrow(
      new DomainError("user_not_found"),
    );
  });

  it("the last owner cannot be removed or demoted", async () => {
    const ownerMembership = (await listMembers(owner)).find((m) => m.role === "owner")!;
    await expect(removeMember(owner, ownerMembership.id)).rejects.toThrow(
      new DomainError("last_owner"),
    );
    await expect(changeMemberRole(owner, ownerMembership.id, "admin")).rejects.toThrow(
      new DomainError("last_owner"),
    );

    // With a second owner, the first one can step down.
    const adminMembership = (await listMembers(owner)).find((m) => m.userId === admin.userId)!;
    await changeMemberRole(owner, adminMembership.id, "owner");
    await changeMemberRole(owner, ownerMembership.id, "admin");
    const roles = (await listMembers(owner)).map((m) => m.role).sort();
    expect(roles).toEqual(["admin", "owner", "viewer"]);
  });

  it("an owner can delete the organization, with all its configuration", async () => {
    await saveDepartments(owner, { departments: DEPARTMENT_TEMPLATE.map((d) => ({ ...d })) });
    await deleteOrganization(owner);
    await expect(getOrganization(owner)).rejects.toThrow(/not found/);
  });
});
