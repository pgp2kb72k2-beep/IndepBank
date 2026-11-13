import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function SignUpPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Creá tu cuenta</h1>
        <p className="text-muted-foreground text-sm">
          ¿Ya tenés cuenta?{" "}
          <Link href="/ingresar" className="text-foreground underline underline-offset-4">
            Ingresá
          </Link>
        </p>
      </div>
      <SignUpForm />
      <p className="text-muted-foreground text-xs">
        IndepBank nunca te va a pedir las claves de tu banco.
      </p>
    </div>
  );
}
