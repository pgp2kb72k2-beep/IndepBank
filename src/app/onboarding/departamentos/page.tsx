import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DepartmentsEditor, type EditorRow } from "@/components/departments-editor";
import { centsToInput } from "@/lib/money";
import { DEPARTMENT_TEMPLATE } from "@/lib/validation/departments";
import { getAllocationState } from "@/server/departments";
import { getOnboardingStep } from "@/server/onboarding";
import { getOrganization } from "@/server/organizations";
import { requireOrgContext } from "@/server/session";
import { saveOnboardingDepartmentsAction } from "../actions";
import { Stepper } from "../stepper";

export const metadata: Metadata = { title: "Departamentos" };

export default function OnboardingDepartmentsPage() {
  return (
    <div className="space-y-8">
      <Stepper current={2} />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">¿Cómo repartís cada ingreso?</h1>
        <p className="text-muted-foreground">
          Cada vez que entra dinero, IndepBank lo reparte virtualmente entre tus áreas con estos
          porcentajes. Te dejamos una plantilla para empezar: ajustala a tu empresa. Tienen que
          sumar 100%.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted-foreground text-sm">Cargando…</p>}>
        <Editor />
      </Suspense>
    </div>
  );
}

async function Editor() {
  const ctx = await requireOrgContext();
  const step = await getOnboardingStep(ctx);
  if (step === "done") redirect("/app");
  const [org, state] = await Promise.all([getOrganization(ctx), getAllocationState(ctx)]);

  const rows: EditorRow[] =
    state.departments.length > 0
      ? state.departments.map((d) => ({
          id: d.id,
          name: d.name,
          color: d.color,
          icon: d.icon,
          percent: String(d.percentBp / 100).replace(".", ","),
          reserve: centsToInput(d.minimumReserve),
        }))
      : DEPARTMENT_TEMPLATE.map((d) => ({
          name: d.name,
          color: d.color,
          icon: d.icon,
          percent: String(d.percentBp / 100),
          reserve: "",
        }));

  return (
    <DepartmentsEditor
      initialRows={rows}
      currency={org.baseCurrency}
      action={saveOnboardingDepartmentsAction}
      submitLabel="Continuar"
    />
  );
}
