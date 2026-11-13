"use client";

import { Check } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

type Result = { ok: true; message?: string } | { ok: false; error: string } | null;

/** Shows the result of the last submit: error in red, success briefly in green. */
export function FormStatus({ result }: { result: Result }) {
  if (!result) return null;
  if (!result.ok) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {result.error}
      </p>
    );
  }
  return (
    <p role="status" className="text-status-ok flex items-center gap-1.5 text-sm">
      <Check className="size-4" /> {result.message ?? "Guardado"}
    </p>
  );
}

export function SubmitButton({
  pending,
  children,
  pendingLabel = "Guardando…",
  ...props
}: ButtonProps & { pending: boolean; pendingLabel?: string }) {
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

export function ReadOnlyNotice() {
  return (
    <p className="bg-muted text-muted-foreground rounded-md px-3 py-2 text-sm">
      Tenés acceso de solo lectura: podés ver la configuración pero no cambiarla.
    </p>
  );
}
