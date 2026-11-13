import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar" };

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Ingresá a tu cuenta</h1>
        <p className="text-muted-foreground text-sm">
          ¿Todavía no tenés cuenta?{" "}
          <Link href="/registro" className="text-foreground underline underline-offset-4">
            Creala acá
          </Link>
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
