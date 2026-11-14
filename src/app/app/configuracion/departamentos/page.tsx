import type { Metadata } from "next";
import { Suspense } from "react";
import { DepartmentsEditor } from "@/components/departments-editor";
import { Card, CardHeader } from "@/components/ui/card";
import { centsToInput, formatMoney, formatPercent } from "@/lib/money";
import { getAllocationState, listAllocationVersions } from "@/server/departments";
import { getOrganization } from "@/server/organizations";
import { can } from "@/server/permissions";
import { requireAppContext } from "@/server/session";
import { saveDepartmentsAction } from "../actions";

export const metadata: Metadata = { title: "Departamentos y reservas" };

export default function DepartmentsSettingsPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground text-sm">Cargando…</p>}>
      <Content />
    </Suspense>
  );
}

const dateFormat = new Intl.DateTimeFormat("es-UY", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Montevideo",
});

async function Content() {
  const ctx = await requireAppContext();
  const [org, state, versions] = await Promise.all([
    getOrganization(ctx),
    getAllocationState(ctx),
    listAllocationVersions(ctx),
  ]);
  const totalReserve = state.departments.reduce((sum, d) => sum + d.minimumReserve, 0n);

  return (
    <>
      <Card>
        <CardHeader
          title="Departamentos, porcentajes y reservas"
          description={
            <>
              Cada ingreso se reparte con estos porcentajes. La reserva mínima queda siempre
              protegida. Reserva total de la empresa:{" "}
              <strong className="text-foreground">
                {formatMoney(totalReserve, org.baseCurrency)}
              </strong>
              .
            </>
          }
        />
        <DepartmentsEditor
          syncKey={[
            state.currentVersion?.id,
            ...state.departments.map((d) => `${d.id}:${d.updatedAt.getTime()}`),
          ].join("|")}
          initialRows={state.departments.map((d) => ({
            id: d.id,
            name: d.name,
            color: d.color,
            icon: d.icon,
            percent: formatPercent(d.percentBp).replace("%", ""),
            reserve: centsToInput(d.minimumReserve),
          }))}
          currency={org.baseCurrency}
          action={saveDepartmentsAction}
          submitLabel="Guardar"
          showReserves
          showRecalculate
          readOnly={!can(ctx.role, "write")}
        />
      </Card>
      <Card>
        <CardHeader
          title="Historial de porcentajes"
          description="Cada cambio de porcentajes queda guardado con la fecha desde la que rige."
        />
        <ul className="divide-y text-sm">
          {versions.map((v, i) => (
            <li key={v.id} className="flex justify-between gap-4 py-2">
              <span>
                Rige desde el {dateFormat.format(new Date(`${v.effectiveFrom}T12:00:00Z`))}
                {i === 0 && <span className="text-brand-cyan ml-2 text-xs">vigente</span>}
              </span>
              <span className="text-muted-foreground">
                Guardado el {dateFormat.format(v.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
