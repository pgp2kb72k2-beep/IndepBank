import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getOnboardingStep, ONBOARDING_PATH } from "@/server/onboarding";
import { getOrgContext } from "@/server/session";
import { CompanyForm } from "./company-form";
import { Stepper } from "./stepper";

export const metadata: Metadata = { title: "Creá tu empresa" };

export default function OnboardingCompanyPage() {
  return (
    <div className="space-y-8">
      <Stepper current={1} />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Contanos de tu empresa</h1>
        <p className="text-muted-foreground">
          En tres pasos vas a tener tu Safe-to-Spend: el capital que realmente podés usar.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted-foreground text-sm">Cargando…</p>}>
        <Step />
      </Suspense>
    </div>
  );
}

async function Step() {
  const ctx = await getOrgContext();
  if (ctx) {
    const step = await getOnboardingStep(ctx);
    redirect(step === "done" ? "/app" : ONBOARDING_PATH[step]);
  }
  return <CompanyForm />;
}
