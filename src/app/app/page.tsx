import type { Metadata } from "next";
import { Suspense } from "react";
import { getOrganization } from "@/server/organizations";
import { requireAppContext } from "@/server/session";

export const metadata: Metadata = { title: "Inicio" };

const ROLE_LABEL = { owner: "Dueño", admin: "Administrador", viewer: "Solo lectura" } as const;

export default function AppHome() {
  return (
    <Suspense fallback={<p className="text-muted-foreground text-sm">Cargando…</p>}>
      <Home />
    </Suspense>
  );
}

// DECISION: placeholder until stage 7 (dashboard: Safe-to-Spend, Financial Map, alerts).
async function Home() {
  const ctx = await requireAppContext();
  const org = await getOrganization(ctx);
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-sm">{ROLE_LABEL[ctx.role]}</p>
      <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
      <p className="text-muted-foreground">
        Acá vas a ver tu Safe-to-Spend, el Financial Map y tus alertas.
      </p>
    </div>
  );
}
