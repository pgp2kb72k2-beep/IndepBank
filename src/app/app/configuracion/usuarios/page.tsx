import type { Metadata } from "next";
import { Suspense } from "react";
import { ReadOnlyNotice } from "@/components/form-status";
import { Card, CardHeader } from "@/components/ui/card";
import { listMembers } from "@/server/organizations";
import { can } from "@/server/permissions";
import { requireAppContext } from "@/server/session";
import { AddMemberForm, MemberRow } from "./member-forms";

export const metadata: Metadata = { title: "Usuarios" };

export default function MembersPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground text-sm">Cargando…</p>}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const ctx = await requireAppContext();
  const members = await listMembers(ctx);
  const canManage = can(ctx.role, "manage_members");
  const canManageOwners = can(ctx.role, "manage_owners");

  return (
    <Card>
      <CardHeader
        title="Usuarios y roles"
        description="Dueño: puede todo. Administrador: todo menos gestionar dueños y borrar la empresa. Solo lectura: ve todo pero no cambia nada."
      />
      <div className="space-y-6">
        {canManage ? <AddMemberForm canAddOwner={canManageOwners} /> : <ReadOnlyNotice />}
        <ul className="divide-y rounded-lg border">
          {members.map((m) => (
            <MemberRow
              key={m.id}
              member={{ id: m.id, name: m.name, email: m.email, role: m.role }}
              isSelf={m.userId === ctx.userId}
              // Admins cannot touch owners; nobody changes their own role here.
              editable={
                canManage && m.userId !== ctx.userId && (m.role !== "owner" || canManageOwners)
              }
              canAssignOwner={canManageOwners}
            />
          ))}
        </ul>
      </div>
    </Card>
  );
}
