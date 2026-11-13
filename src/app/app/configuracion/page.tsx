import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { can } from "@/server/permissions";
import { getOrganization } from "@/server/organizations";
import { requireAppContext } from "@/server/session";
import { CompanySettingsForm, DeleteCompanyForm } from "./company-forms";

export const metadata: Metadata = { title: "Configuración" };

export default function CompanySettingsPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground text-sm">Cargando…</p>}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const ctx = await requireAppContext();
  const org = await getOrganization(ctx);
  return (
    <>
      <Card>
        <CardHeader
          title="Empresa y cálculos"
          description="Datos de la empresa y parámetros que usa el cálculo del Safe-to-Spend y las alertas."
        />
        <CompanySettingsForm
          readOnly={!can(ctx.role, "write")}
          values={{
            name: org.name,
            currency: org.baseCurrency,
            horizonDays: org.horizonDays,
            upcomingDueDays: org.upcomingDueDays,
            highUsage: String(org.highUsageThresholdBp / 100).replace(".", ","),
            openingIncome: org.openingIncomeEnabled,
          }}
        />
      </Card>
      {can(ctx.role, "delete_organization") && (
        <Card className="border-destructive/40">
          <CardHeader
            title="Borrar la empresa"
            description="Se borran para siempre todos sus datos: departamentos, movimientos, obligaciones y el registro de auditoría. No se puede deshacer."
          />
          <DeleteCompanyForm name={org.name} />
        </Card>
      )}
    </>
  );
}
