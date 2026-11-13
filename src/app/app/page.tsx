import type { Metadata } from "next";
import { Suspense } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { getOrganization } from "@/server/organizations";
import { requireOrgContext } from "@/server/session";

export const metadata: Metadata = { title: "Inicio" };

const ROLE_LABEL = { owner: "Dueño", admin: "Administrador", viewer: "Solo lectura" } as const;

export default function AppHome() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <Suspense fallback={<p className="text-muted-foreground text-sm">Cargando…</p>}>
        <Home />
      </Suspense>
    </main>
  );
}

async function Home() {
  const ctx = await requireOrgContext();
  const org = await getOrganization(ctx);
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">{ROLE_LABEL[ctx.role]}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
        </div>
        <SignOutButton />
      </header>
      <p className="text-muted-foreground">
        Acá vas a ver tu Safe-to-Spend, el Financial Map y tus alertas.
      </p>
    </div>
  );
}
