import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { requireAppContext, requireUser } from "@/server/session";
import { TwoFactorSettings } from "./two-factor";

export const metadata: Metadata = { title: "Seguridad" };

export default function SecurityPage() {
  return (
    <Card>
      <CardHeader
        title="Verificación en dos pasos"
        description="Además de tu contraseña, al ingresar te vamos a pedir un código de 6 dígitos de una app de autenticación (Google Authenticator, Microsoft Authenticator, 1Password, etc.)."
      />
      <Suspense fallback={<p className="text-muted-foreground text-sm">Cargando…</p>}>
        <Content />
      </Suspense>
    </Card>
  );
}

async function Content() {
  await requireAppContext();
  const user = await requireUser();
  return <TwoFactorSettings enabled={Boolean(user.twoFactorEnabled)} />;
}
