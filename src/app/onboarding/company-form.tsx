"use client";

import { useActionState } from "react";
import { FormStatus, SubmitButton } from "@/components/form-status";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCompanyAction } from "./actions";

export function CompanyForm() {
  const [result, action, pending] = useActionState(createCompanyAction, null);
  return (
    <form action={action} className="max-w-md space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Nombre de la empresa</Label>
        <Input id="name" name="name" required minLength={2} maxLength={100} autoFocus />
      </div>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">¿En qué moneda trabaja tu cuenta principal?</legend>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: "USD", label: "Dólares", hint: "US$" },
            { value: "UYU", label: "Pesos uruguayos", hint: "$" },
          ].map((option, i) => (
            <label
              key={option.value}
              className="has-checked:border-primary has-checked:bg-accent flex cursor-pointer flex-col gap-1 rounded-lg border p-4"
            >
              <input
                type="radio"
                name="currency"
                value={option.value}
                defaultChecked={i === 0}
                className="sr-only"
              />
              <span className="font-medium">{option.label}</span>
              <span className="text-muted-foreground text-sm">{option.hint}</span>
            </label>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          Por ahora IndepBank trabaja con una sola moneda por empresa y no se puede cambiar después.
        </p>
      </fieldset>
      <div className="flex items-center gap-4">
        <SubmitButton pending={pending} pendingLabel="Creando…">
          Continuar
        </SubmitButton>
        <FormStatus result={result} />
      </div>
    </form>
  );
}
