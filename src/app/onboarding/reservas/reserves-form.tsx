"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { DepartmentIcon } from "@/components/department-icon";
import { FormStatus, SubmitButton } from "@/components/form-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney, parseMoney, type CurrencyCode } from "@/lib/money";
import { saveOnboardingReservesAction } from "../actions";

interface Dept {
  id: string;
  name: string;
  icon: string;
  color: string;
  reserve: string;
}

export function ReservesForm({
  departments,
  currency,
}: {
  departments: Dept[];
  currency: CurrencyCode;
}) {
  const [result, action, pending] = useActionState(saveOnboardingReservesAction, null);
  const [values, setValues] = useState(() =>
    Object.fromEntries(departments.map((d) => [d.id, d.reserve])),
  );
  const parsed = Object.fromEntries(
    Object.entries(values).map(([id, v]) => [id, v.trim() === "" ? 0n : parseMoney(v)]),
  );
  const valid = Object.values(parsed).every((v) => v !== null && v >= 0n);
  const total = Object.values(parsed).reduce<bigint>((sum, v) => sum + (v ?? 0n), 0n);

  return (
    <form action={action} className="space-y-6">
      <ul className="divide-y rounded-lg border">
        {departments.map((d) => (
          <li key={d.id} className="flex items-center gap-3 px-4 py-3">
            <DepartmentIcon icon={d.icon} color={d.color} />
            <label htmlFor={`reserve-${d.id}`} className="flex-1 text-sm font-medium">
              {d.name}
            </label>
            <Input
              id={`reserve-${d.id}`}
              name={`reserve:${d.id}`}
              inputMode="decimal"
              placeholder="0"
              value={values[d.id]}
              aria-invalid={parsed[d.id] === null}
              onChange={(e) => setValues((v) => ({ ...v, [d.id]: e.target.value }))}
              className="w-36 text-right"
            />
          </li>
        ))}
      </ul>
      <p className="text-sm">
        Reserva total de la empresa:{" "}
        <span className="font-semibold">{formatMoney(total, currency)}</span>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" asChild>
          <Link href="/onboarding/departamentos">Volver</Link>
        </Button>
        <SubmitButton pending={pending} disabled={!valid} pendingLabel="Terminando…">
          Terminar
        </SubmitButton>
        <FormStatus result={result} />
      </div>
    </form>
  );
}
