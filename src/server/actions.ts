import "server-only";
import { z } from "zod";
import { DomainError, ForbiddenError, NotFoundError } from "./errors";

/** What every server action returns to its form. */
export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const DOMAIN_COPY: Record<string, string> = {
  sum_not_100: "Los porcentajes tienen que sumar exactamente 100%.",
  duplicate_name: "Hay dos departamentos con el mismo nombre.",
  user_not_found: "No hay ninguna cuenta con ese email. Pedile que se registre primero.",
  already_member: "Esa persona ya es parte de la empresa.",
  last_owner: "La empresa tiene que tener al menos un dueño.",
  confirm_mismatch: "El nombre no coincide.",
};

/** Turns any error into user-facing copy. Unknown errors are logged without data. */
export function toActionError(error: unknown): ActionResult {
  if (error instanceof ForbiddenError) {
    return { ok: false, error: "No tenés permiso para hacer esto." };
  }
  if (error instanceof NotFoundError) {
    return { ok: false, error: "No encontramos lo que querías modificar. Recargá la página." };
  }
  if (error instanceof DomainError) {
    return { ok: false, error: DOMAIN_COPY[error.code] ?? "No se pudo guardar." };
  }
  if (error instanceof z.ZodError) {
    const known = error.issues.map((i) => DOMAIN_COPY[i.message]).find(Boolean);
    return { ok: false, error: known ?? "Revisá los datos: hay campos incompletos o inválidos." };
  }
  // Only the error type reaches the logs: never amounts or other financial data.
  console.error("Unexpected action error:", error instanceof Error ? error.name : typeof error);
  return { ok: false, error: "Algo salió mal. Probá de nuevo en unos segundos." };
}

/** Runs an action body and converts thrown errors into an ActionResult. */
export async function runAction(fn: () => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (error) {
    // Let Next.js redirects/not-found pass through.
    if (error instanceof Error && "digest" in error) throw error;
    return toActionError(error);
  }
}
