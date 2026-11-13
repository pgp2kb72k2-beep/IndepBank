import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { centsToInput } from "@/lib/money";
import { getAllocationState } from "@/server/departments";
import { getOnboardingStep, ONBOARDING_PATH } from "@/server/onboarding";
import { getOrganization } from "@/server/organizations";
import { requireOrgContext } from "@/server/session";
import { Stepper } from "../stepper";
import { ReservesForm } from "./reserves-form";

export const metadata: Metadata = { title: "Reservas mínimas" };

export default function OnboardingReservesPage() {
  return (
    <div className="space-y-8">
      <Stepper current={3} />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">¿Cuánto querés tener protegido?</h1>
        <p className="text-muted-foreground">
          La reserva mínima es plata que cada área siempre mantiene guardada: un fondo operativo,
          una provisión para impuestos o un colchón general. No se cuenta como disponible. Si
          todavía no lo sabés, dejalo en 0 y lo cambiás después.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted-foreground text-sm">Cargando…</p>}>
        <Reserves />
      </Suspense>
    </div>
  );
}

async function Reserves() {
  const ctx = await requireOrgContext();
  const step = await getOnboardingStep(ctx);
  if (step === "done") redirect("/app");
  if (step !== "reserves") redirect(ONBOARDING_PATH[step]);
  const [org, state] = await Promise.all([getOrganization(ctx), getAllocationState(ctx)]);
  return (
    <ReservesForm
      currency={org.baseCurrency}
      departments={state.departments.map((d) => ({
        id: d.id,
        name: d.name,
        icon: d.icon,
        color: d.color,
        reserve: d.minimumReserve === 0n ? "" : centsToInput(d.minimumReserve),
      }))}
    />
  );
}
