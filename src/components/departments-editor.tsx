"use client";

import { Plus, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { DepartmentIcon } from "@/components/department-icon";
import {
  FormStatus,
  ReadOnlyNotice,
  SubmitButton,
  useClearableResult,
} from "@/components/form-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPercent, parseMoney, parsePercent, type CurrencyCode } from "@/lib/money";
import { cn } from "@/lib/utils";
import { DEPARTMENT_COLORS, DEPARTMENT_ICONS, MAX_DEPARTMENTS } from "@/lib/validation/departments";

export interface EditorRow {
  id?: string;
  name: string;
  color: string;
  icon: string;
  /** As typed, es-UY: "35" or "12,5" */
  percent: string;
  /** As typed, es-UY: "5.000" */
  reserve: string;
}

type Result = { ok: true; message?: string } | { ok: false; error: string } | null;

const ICON_LABEL: Record<(typeof DEPARTMENT_ICONS)[number], string> = {
  briefcase: "Maletín",
  package: "Paquete",
  landmark: "Banco",
  truck: "Camión",
  megaphone: "Megáfono",
  shield: "Escudo",
  store: "Tienda",
  users: "Personas",
  wrench: "Herramienta",
  laptop: "Computadora",
  building: "Edificio",
  "piggy-bank": "Alcancía",
};

let nextKey = 0;
const withKey = (row: EditorRow) => ({ ...row, key: `row-${nextKey++}` });

export function DepartmentsEditor({
  initialRows,
  currency,
  action,
  submitLabel,
  showReserves = false,
  showRecalculate = false,
  readOnly = false,
  syncKey,
}: {
  initialRows: EditorRow[];
  /** Changes when the saved data changes; the editor then reloads `initialRows`. */
  syncKey?: string;
  currency: CurrencyCode;
  action: (prev: Result, form: FormData) => Promise<Result>;
  submitLabel: string;
  showReserves?: boolean;
  showRecalculate?: boolean;
  readOnly?: boolean;
}) {
  const [rows, setRows] = useState(() => initialRows.map(withKey));
  const [result, formAction, pending] = useActionState(action, null);
  const [visibleResult, clearResult] = useClearableResult(result);

  // After a save the server sends fresh rows (new departments now have ids). Reload them,
  // keeping the "Guardado" message. Without this, saving twice would duplicate new rows.
  const [syncedKey, setSyncedKey] = useState(syncKey);
  if (syncKey !== syncedKey) {
    setSyncedKey(syncKey);
    setRows(initialRows.map(withKey));
  }

  const parsed = rows.map((r) => ({
    percentBp: parsePercent(r.percent),
    // An empty reserve means 0, not "invalid".
    reserve: showReserves && r.reserve.trim() !== "" ? parseMoney(r.reserve) : 0n,
    nameOk: r.name.trim().length > 0,
  }));
  const names = rows.map((r) => r.name.trim().toLocaleLowerCase("es")).filter(Boolean);
  const duplicateName = new Set(names).size !== names.length;
  const total = parsed.reduce((sum, p) => sum + (p.percentBp ?? 0), 0);
  const blocker = parsed.some((p) => !p.nameOk)
    ? "Completá el nombre de todos los departamentos."
    : duplicateName
      ? "Hay dos departamentos con el mismo nombre."
      : parsed.some((p) => p.percentBp === null)
        ? "Revisá los porcentajes: usá números como 35 o 12,5."
        : parsed.some((p) => p.reserve === null || p.reserve < 0n)
          ? "Revisá las reservas: usá montos como 5.000 o 5.000,50."
          : total !== 10_000
            ? "Los porcentajes tienen que sumar exactamente 100%."
            : null;
  const canSave = !readOnly && blocker === null;

  const payload = JSON.stringify(
    rows.map((r, i) => ({
      id: r.id,
      name: r.name.trim(),
      color: r.color,
      icon: r.icon,
      percentBp: parsed[i]!.percentBp ?? 0,
      minimumReserve: (parsed[i]!.reserve ?? 0n).toString(),
    })),
  );

  const update = (key: string, patch: Partial<EditorRow>) =>
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <form action={formAction} onInput={clearResult} className="space-y-5">
      {readOnly && <ReadOnlyNotice />}
      <input type="hidden" name="payload" value={payload} />

      <div
        className={cn(
          "text-muted-foreground hidden gap-3 px-1 text-xs font-medium sm:grid",
          showReserves
            ? "sm:grid-cols-[2rem_1fr_7rem_6rem_9rem_2.25rem]"
            : "sm:grid-cols-[2rem_1fr_7rem_6rem_2.25rem]",
        )}
      >
        <span />
        <span>Departamento</span>
        <span>Ícono</span>
        <span>Porcentaje</span>
        {showReserves && <span>Reserva mínima</span>}
        <span />
      </div>

      <ul className="space-y-3">
        {rows.map((row, i) => {
          const p = parsed[i]!;
          return (
            <li
              key={row.key}
              className={cn(
                "grid grid-cols-[2rem_1fr_2.25rem] items-center gap-3 rounded-lg border p-3 sm:border-0 sm:p-0",
                showReserves
                  ? "sm:grid-cols-[2rem_1fr_7rem_6rem_9rem_2.25rem]"
                  : "sm:grid-cols-[2rem_1fr_7rem_6rem_2.25rem]",
              )}
            >
              <button
                type="button"
                disabled={readOnly}
                title="Cambiar color"
                onClick={() => {
                  const idx = DEPARTMENT_COLORS.indexOf(row.color as never);
                  update(row.key, {
                    color: DEPARTMENT_COLORS[(idx + 1) % DEPARTMENT_COLORS.length]!,
                  });
                }}
              >
                <DepartmentIcon icon={row.icon} color={row.color} />
              </button>
              <Input
                aria-label="Nombre del departamento"
                value={row.name}
                maxLength={40}
                disabled={readOnly}
                aria-invalid={!p.nameOk}
                onChange={(e) => update(row.key, { name: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="sm:order-last"
                aria-label={`Quitar ${row.name}`}
                disabled={readOnly || rows.length === 1}
                onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
              >
                <Trash2 />
              </Button>
              <div className="col-span-3 grid grid-cols-2 gap-3 sm:contents">
                <select
                  aria-label="Ícono"
                  value={row.icon}
                  disabled={readOnly}
                  onChange={(e) => update(row.key, { icon: e.target.value })}
                  className="border-input bg-background h-10 rounded-md border px-2 text-sm"
                >
                  {DEPARTMENT_ICONS.map((icon) => (
                    <option key={icon} value={icon}>
                      {ICON_LABEL[icon]}
                    </option>
                  ))}
                </select>
                <div className="relative">
                  <Input
                    aria-label={`Porcentaje de ${row.name}`}
                    inputMode="decimal"
                    value={row.percent}
                    disabled={readOnly}
                    aria-invalid={p.percentBp === null}
                    onChange={(e) => update(row.key, { percent: e.target.value })}
                    className="pr-7 text-right"
                  />
                  <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">
                    %
                  </span>
                </div>
                {showReserves && (
                  <div className="relative col-span-2 sm:col-span-1">
                    <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                      <span className="sm:hidden">Reserva mínima </span>
                      {currency === "USD" ? "US$" : "$"}
                    </span>
                    <Input
                      aria-label={`Reserva mínima de ${row.name}`}
                      inputMode="decimal"
                      value={row.reserve}
                      placeholder="0"
                      disabled={readOnly}
                      aria-invalid={p.reserve === null || p.reserve < 0n}
                      onChange={(e) => update(row.key, { reserve: e.target.value })}
                      className="text-right"
                    />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={readOnly || rows.length >= MAX_DEPARTMENTS}
          onClick={() =>
            setRows((current) => [
              ...current,
              withKey({
                name: "",
                color: DEPARTMENT_COLORS[current.length % DEPARTMENT_COLORS.length]!,
                icon: "briefcase",
                percent: "0",
                reserve: "",
              }),
            ])
          }
        >
          <Plus /> Agregar departamento
        </Button>
        <TotalBadge total={total} />
      </div>

      {showReserves && (
        <p className="text-muted-foreground text-xs">
          Montos en {currency === "USD" ? "dólares" : "pesos"}, por ejemplo 5.000 o 5.000,50.
        </p>
      )}

      {showRecalculate && !readOnly && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="recalculate" className="accent-primary mt-0.5" />
          <span>
            Recalcular el período actual
            <span className="text-muted-foreground block text-xs">
              Si no lo marcás, los porcentajes nuevos se aplican a los ingresos desde hoy. Si lo
              marcás, también se reparten de nuevo los ingresos de este mes.
            </span>
          </span>
        </label>
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-4">
          <SubmitButton pending={pending} disabled={!canSave}>
            {submitLabel}
          </SubmitButton>
          {blocker ? (
            <p className="text-muted-foreground text-sm">{blocker}</p>
          ) : (
            <FormStatus result={visibleResult} />
          )}
        </div>
      )}
    </form>
  );
}

function TotalBadge({ total }: { total: number }) {
  const diff = 10_000 - total;
  const ok = diff === 0;
  return (
    <p
      aria-live="polite"
      className={cn("text-sm font-medium", ok ? "text-status-ok" : "text-status-warn")}
    >
      Total {formatPercent(total)}
      {!ok && (
        <span className="font-normal">
          {" · "}
          {diff > 0 ? `faltan ${formatPercent(diff)}` : `sobran ${formatPercent(-diff)}`}
        </span>
      )}
    </p>
  );
}
