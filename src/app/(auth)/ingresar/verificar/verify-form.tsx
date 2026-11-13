"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

export function VerifyForm() {
  const router = useRouter();
  const [useBackup, setUseBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const code = String(form.get("code")).trim();
    const trustDevice = form.get("trust") === "on";
    setPending(true);
    setError(null);
    const { error } = useBackup
      ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice })
      : await authClient.twoFactor.verifyTotp({ code, trustDevice });
    setPending(false);
    if (error) return setError(authErrorMessage(error));
    router.push("/app");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="code">{useBackup ? "Código de respaldo" : "Código"}</Label>
        <Input
          id="code"
          name="code"
          autoComplete="one-time-code"
          inputMode={useBackup ? "text" : "numeric"}
          maxLength={useBackup ? 32 : 6}
          required
          autoFocus
        />
      </div>
      <label className="text-muted-foreground flex items-center gap-2 text-sm">
        <input type="checkbox" name="trust" className="accent-primary" />
        Confiar en este dispositivo por 30 días
      </label>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Verificando…" : "Verificar"}
      </Button>
      <Button
        type="button"
        variant="link"
        className="w-full"
        onClick={() => setUseBackup((v) => !v)}
      >
        {useBackup ? "Usar el código de la app" : "Usar un código de respaldo"}
      </Button>
    </form>
  );
}
