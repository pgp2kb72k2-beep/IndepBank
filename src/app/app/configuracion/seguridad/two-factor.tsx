"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

type Step =
  | { kind: "idle" }
  | { kind: "setup"; qr: string; secret: string; backupCodes: string[] }
  | { kind: "disable" };

export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function start(form: FormData) {
    setPending(true);
    setError(null);
    const { data, error } = await authClient.twoFactor.enable({
      password: String(form.get("password")),
    });
    setPending(false);
    if (error || !data || data.method !== "totp") return setError(authErrorMessage(error));
    const secret = new URL(data.totpURI).searchParams.get("secret") ?? "";
    const qr = await QRCode.toDataURL(data.totpURI, { margin: 1, width: 200 });
    setStep({ kind: "setup", qr, secret, backupCodes: data.backupCodes });
  }

  async function confirm(form: FormData) {
    setPending(true);
    setError(null);
    const { error } = await authClient.twoFactor.verifyTotp({
      code: String(form.get("code")).trim(),
    });
    setPending(false);
    if (error) return setError(authErrorMessage(error));
    setStep({ kind: "idle" });
    router.refresh();
  }

  async function disable(form: FormData) {
    setPending(true);
    setError(null);
    const { error } = await authClient.twoFactor.disable({
      password: String(form.get("password")),
    });
    setPending(false);
    if (error) return setError(authErrorMessage(error));
    setStep({ kind: "idle" });
    router.refresh();
  }

  const errorLine = error && (
    <p role="alert" className="text-destructive text-sm">
      {error}
    </p>
  );

  if (step.kind === "setup") {
    return (
      <div className="space-y-6">
        <ol className="list-decimal space-y-4 pl-5 text-sm">
          <li className="space-y-3">
            <p>Escaneá este código con tu app de autenticación.</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
            <img
              src={step.qr}
              alt="Código QR para la app de autenticación"
              className="rounded-md bg-white p-2"
              width={200}
              height={200}
            />
            <p className="text-muted-foreground text-xs">
              ¿No podés escanearlo? Ingresá esta clave a mano:{" "}
              <code className="bg-muted rounded px-1 py-0.5 break-all">{step.secret}</code>
            </p>
          </li>
          <li className="space-y-2">
            <p>
              Guardá estos códigos de respaldo en un lugar seguro. Sirven para entrar si perdés el
              celular; cada uno se usa una sola vez.
            </p>
            <ul className="bg-muted grid grid-cols-2 gap-1 rounded-md p-3 font-mono text-xs sm:grid-cols-3">
              {step.backupCodes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
          </li>
          <li>
            <form action={confirm} className="flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <Label htmlFor="code">Código de 6 dígitos</Label>
                <Input
                  id="code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  className="w-36"
                />
              </div>
              <Button type="submit" disabled={pending}>
                {pending ? "Verificando…" : "Activar"}
              </Button>
            </form>
          </li>
        </ol>
        {errorLine}
      </div>
    );
  }

  if (enabled) {
    return (
      <div className="space-y-4">
        <p className="text-status-ok flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="size-4" /> Activada
        </p>
        {step.kind === "disable" ? (
          <PasswordForm
            label="Ingresá tu contraseña para desactivarla"
            submit="Desactivar"
            variant="destructive"
            pending={pending}
            onSubmit={disable}
          />
        ) : (
          <Button variant="outline" onClick={() => setStep({ kind: "disable" })}>
            Desactivar
          </Button>
        )}
        {errorLine}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">No está activada.</p>
      <PasswordForm
        label="Ingresá tu contraseña para empezar"
        submit="Activar verificación en dos pasos"
        pending={pending}
        onSubmit={start}
      />
      {errorLine}
    </div>
  );
}

function PasswordForm({
  label,
  submit,
  pending,
  onSubmit,
  variant = "default",
}: {
  label: string;
  submit: string;
  pending: boolean;
  onSubmit: (form: FormData) => Promise<void>;
  variant?: "default" | "destructive";
}) {
  return (
    <form action={onSubmit} className="flex flex-wrap items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="password">{label}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-64"
        />
      </div>
      <Button type="submit" variant={variant} disabled={pending}>
        {pending ? "Un momento…" : submit}
      </Button>
    </form>
  );
}
