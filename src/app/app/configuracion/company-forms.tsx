"use client";

import { useActionState, useState } from "react";
import { FormStatus, ReadOnlyNotice, SubmitButton } from "@/components/form-status";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteCompanyAction, updateCompanyAction } from "./actions";

interface Values {
  name: string;
  currency: "UYU" | "USD";
  horizonDays: number;
  upcomingDueDays: number;
  highUsage: string;
  openingIncome: boolean;
}

export function CompanySettingsForm({ values, readOnly }: { values: Values; readOnly: boolean }) {
  const [result, action, pending] = useActionState(updateCompanyAction, null);
  return (
    <form action={action} className="space-y-5">
      {readOnly && <ReadOnlyNotice />}
      <fieldset disabled={readOnly} className="grid gap-5 sm:grid-cols-2">
        <Field label="Nombre" htmlFor="name">
          <Input id="name" name="name" defaultValue={values.name} required maxLength={100} />
        </Field>
        <Field
          label="Moneda"
          htmlFor="currency"
          hint="Se elige al crear la empresa y no se puede cambiar."
        >
          <Input
            id="currency"
            value={values.currency === "USD" ? "Dólares (US$)" : "Pesos uruguayos ($)"}
            disabled
            readOnly
          />
        </Field>
        <Field
          label="Horizonte de obligaciones (días)"
          htmlFor="horizonDays"
          hint="Se protegen las obligaciones y compromisos que vencen dentro de este plazo."
        >
          <Input
            id="horizonDays"
            name="horizonDays"
            type="number"
            min={1}
            max={365}
            defaultValue={values.horizonDays}
            required
          />
        </Field>
        <Field
          label="Aviso de vencimiento (días antes)"
          htmlFor="upcomingDueDays"
          hint="Cuándo empezar a avisar que algo está por vencer."
        >
          <Input
            id="upcomingDueDays"
            name="upcomingDueDays"
            type="number"
            min={0}
            max={60}
            defaultValue={values.upcomingDueDays}
            required
          />
        </Field>
        <Field
          label="Umbral de uso alto del presupuesto (%)"
          htmlFor="highUsage"
          hint="Avisamos cuando un área usó o comprometió este porcentaje de lo asignado."
        >
          <Input
            id="highUsage"
            name="highUsage"
            inputMode="decimal"
            defaultValue={values.highUsage}
            required
          />
        </Field>
        <label className="flex items-start gap-2 self-center text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="openingIncome"
            defaultChecked={values.openingIncome}
            className="accent-primary mt-0.5"
          />
          <span>
            Repartir el saldo con el que empieza cada mes
            <span className="text-muted-foreground block text-xs">
              El saldo del banco al inicio del mes se reparte entre los departamentos como si fuera
              un ingreso. Si lo desactivás, ese saldo queda como &quot;sin asignar&quot;.
            </span>
          </span>
        </label>
      </fieldset>
      {!readOnly && (
        <div className="flex items-center gap-4">
          <SubmitButton pending={pending}>Guardar cambios</SubmitButton>
          <FormStatus result={result} />
        </div>
      )}
    </form>
  );
}

export function DeleteCompanyForm({ name }: { name: string }) {
  const [result, action, pending] = useActionState(deleteCompanyAction, null);
  const [typed, setTyped] = useState("");
  return (
    <form action={action} className="space-y-4">
      <Field label={`Escribí "${name}" para confirmar`} htmlFor="confirm">
        <Input
          id="confirm"
          name="confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
        />
      </Field>
      <div className="flex items-center gap-4">
        <SubmitButton
          variant="destructive"
          pending={pending}
          pendingLabel="Borrando…"
          disabled={typed.trim() !== name}
        >
          Borrar la empresa
        </SubmitButton>
        <FormStatus result={result} />
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}
