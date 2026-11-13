"use server";

import { redirect } from "next/navigation";
import { parseMoney } from "@/lib/money";
import { parseDepartmentsPayload } from "@/lib/validation/departments";
import { runAction, type ActionResult } from "@/server/actions";
import { saveDepartments, updateReserves } from "@/server/departments";
import { completeOnboarding } from "@/server/onboarding";
import { createOrganization } from "@/server/organizations";
import {
  getOrgContext,
  requireOrgContext,
  requireUser,
  setActiveOrganization,
} from "@/server/session";

/** Step 1: company name and base currency. */
export async function createCompanyAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    if (await getOrgContext()) redirect("/onboarding/departamentos");
    const org = await createOrganization(user.id, {
      name: String(form.get("name") ?? ""),
      baseCurrency: form.get("currency") === "UYU" ? "UYU" : "USD",
    });
    await setActiveOrganization(org.id);
    redirect("/onboarding/departamentos");
  });
}

/** Step 2: departments and percentages. */
export async function saveOnboardingDepartmentsAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireOrgContext();
    await saveDepartments(ctx, {
      departments: parseDepartmentsPayload(String(form.get("payload") ?? "[]")),
    });
    redirect("/onboarding/reservas");
  });
}

/** Step 3: minimum reserves. Finishes onboarding. */
export async function saveOnboardingReservesAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireOrgContext();
    const reserves: Record<string, bigint> = {};
    for (const [key, value] of form.entries()) {
      if (!key.startsWith("reserve:")) continue;
      const cents = String(value).trim() === "" ? 0n : parseMoney(String(value));
      if (cents === null || cents < 0n) {
        return { ok: false, error: "Revisá los montos: usá números como 5.000 o 5.000,50." };
      }
      reserves[key.slice("reserve:".length)] = cents;
    }
    await updateReserves(ctx, reserves);
    await completeOnboarding(ctx);
    redirect("/app");
  });
}
