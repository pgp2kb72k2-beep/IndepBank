"use client";

import { Trash2 } from "lucide-react";
import { useActionState } from "react";
import { FormStatus, SubmitButton } from "@/components/form-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createRuleAction, deleteRuleAction } from "../actions";

export function NewRuleForm({ departments }: { departments: { id: string; name: string }[] }) {
  const [result, action, pending] = useActionState(createRuleAction, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_6rem_auto] sm:items-end">
      <div className="space-y-2">
        <Label htmlFor="matchText">Si la descripción contiene</Label>
        <Input id="matchText" name="matchText" placeholder="DGI" required minLength={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="departmentId">Asignar a</Label>
        <select
          id="departmentId"
          name="departmentId"
          className="border-input bg-background h-10 w-full rounded-md border px-2 text-sm"
          required
        >
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="priority">Prioridad</Label>
        <Input id="priority" name="priority" type="number" min={0} max={1000} defaultValue={0} />
      </div>
      <SubmitButton pending={pending}>Agregar</SubmitButton>
      <div className="sm:col-span-4">
        <FormStatus result={result} />
        <p className="text-muted-foreground text-xs">
          Si varias reglas coinciden, gana la de mayor prioridad. No importan mayúsculas ni tildes.
        </p>
      </div>
    </form>
  );
}

export function DeleteRuleButton({ id }: { id: string }) {
  const [result, action, pending] = useActionState(deleteRuleAction, null);
  return (
    <form action={action} className="ml-auto flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {result && !result.ok && <FormStatus result={result} />}
      <Button variant="ghost" size="icon" aria-label="Borrar regla" disabled={pending}>
        <Trash2 />
      </Button>
    </form>
  );
}
