import type { Metadata } from "next";
import { Suspense } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Creá tu empresa" };

export default function OnboardingPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
      <Suspense fallback={<p className="text-muted-foreground text-sm">Cargando…</p>}>
        <Welcome />
      </Suspense>
    </main>
  );
}

// DECISION: placeholder until stage 4 (onboarding in 3 steps: company → departments → reserves).
async function Welcome() {
  const user = await requireUser();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">¡Hola, {user.name}!</h1>
      <p className="text-muted-foreground">
        Tu cuenta está lista. El siguiente paso es crear tu empresa y sus departamentos.
      </p>
      <SignOutButton />
    </div>
  );
}
