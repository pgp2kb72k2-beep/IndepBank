"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { FormStatus, SubmitButton, useClearableResult } from "@/components/form-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addMemberAction, changeRoleAction, removeMemberAction } from "../actions";

type Role = "owner" | "admin" | "viewer";

const ROLE_LABEL: Record<Role, string> = {
  owner: "Dueño",
  admin: "Administrador",
  viewer: "Solo lectura",
};

const selectClass = "border-input bg-background h-10 rounded-md border px-2 text-sm";

export function AddMemberForm({ canAddOwner }: { canAddOwner: boolean }) {
  const [result, action, pending] = useActionState(addMemberAction, null);
  const [visible, clear] = useClearableResult(result);
  const roles: Role[] = canAddOwner ? ["viewer", "admin", "owner"] : ["viewer", "admin"];
  return (
    <form action={action} onInput={clear} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_11rem_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="email">Email de la persona</Label>
          <Input id="email" name="email" type="email" required placeholder="nombre@empresa.uy" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Rol</Label>
          <select id="role" name="role" className={`${selectClass} w-full`} defaultValue="viewer">
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        <SubmitButton pending={pending} pendingLabel="Agregando…">
          Agregar
        </SubmitButton>
      </div>
      <FormStatus result={visible} />
      <p className="text-muted-foreground text-xs">
        La persona tiene que haber creado su cuenta en IndepBank con ese email.
      </p>
    </form>
  );
}

export function MemberRow({
  member,
  isSelf,
  editable,
  canAssignOwner,
}: {
  member: { id: string; name: string; email: string; role: Role };
  isSelf: boolean;
  editable: boolean;
  canAssignOwner: boolean;
}) {
  const [roleResult, roleAction, rolePending] = useActionState(changeRoleAction, null);
  // Controlled select: when a change is rejected (e.g. last owner), go back to the saved role.
  const [role, setRole] = useState<Role>(member.role);
  const [handled, setHandled] = useState(roleResult);
  if (roleResult !== handled) {
    setHandled(roleResult);
    if (roleResult && !roleResult.ok) setRole(member.role);
  }
  const [savedRole, setSavedRole] = useState(member.role);
  if (member.role !== savedRole) {
    setSavedRole(member.role);
    setRole(member.role);
  }
  const [removeResult, removeAction, removePending] = useActionState(removeMemberAction, null);
  const roles: Role[] = canAssignOwner ? ["owner", "admin", "viewer"] : ["admin", "viewer"];
  const error = [roleResult, removeResult].find((r) => r && !r.ok) ?? null;

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {member.name} {isSelf && <span className="text-muted-foreground font-normal">(vos)</span>}
        </p>
        <p className="text-muted-foreground truncate text-xs">{member.email}</p>
      </div>
      {editable ? (
        <>
          <form action={roleAction}>
            <input type="hidden" name="id" value={member.id} />
            <select
              name="role"
              aria-label={`Rol de ${member.name}`}
              value={role}
              disabled={rolePending}
              className={selectClass}
              onChange={(e) => {
                setRole(e.target.value as Role);
                e.currentTarget.form?.requestSubmit();
              }}
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </form>
          <form action={removeAction}>
            <input type="hidden" name="id" value={member.id} />
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Quitar a ${member.name}`}
              disabled={removePending}
            >
              <Trash2 />
            </Button>
          </form>
        </>
      ) : (
        <span className="text-muted-foreground text-sm">{ROLE_LABEL[member.role]}</span>
      )}
      {error && (
        <div className="w-full">
          <FormStatus result={error} />
        </div>
      )}
    </li>
  );
}
