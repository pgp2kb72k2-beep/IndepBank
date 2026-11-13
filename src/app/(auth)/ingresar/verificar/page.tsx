import type { Metadata } from "next";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "Verificación en dos pasos" };

export default function VerifyPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Verificación en dos pasos</h1>
        <p className="text-muted-foreground text-sm">
          Ingresá el código de 6 dígitos de tu app de autenticación.
        </p>
      </div>
      <VerifyForm />
    </div>
  );
}
