"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { parsePercent } from "@/lib/money";
import { parseDepartmentsPayload } from "@/lib/validation/departments";
import { roleSchema } from "@/lib/validation/organization";
import { runAction, type ActionResult } from "@/server/actions";
import { createRule, deleteRule } from "@/server/classification-rules";
import { saveDepartments } from "@/server/departments";
import { DomainError } from "@/server/errors";
import {
  addMember,
  changeMemberRole,
  deleteOrganization,
  getOrganization,
  removeMember,
  updateOrganizationSettings,
} from "@/server/organizations";
import { requireAppContext } from "@/server/session";

type Prev = ActionResult | null;

const int = (value: FormDataEntryValue | null) => Number.parseInt(String(value ?? ""), 10);

export async function updateCompanyAction(_prev: Prev, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAppContext();
    const threshold = parsePercent(String(form.get("highUsage") ?? ""));
    if (threshold === null || threshold === 0) {
      return { ok: false, error: "El umbral tiene que ser un porcentaje entre 1 y 100." };
    }
    await updateOrganizationSettings(ctx, {
      name: String(form.get("name") ?? ""),
      horizonDays: int(form.get("horizonDays")),
      upcomingDueDays: int(form.get("upcomingDueDays")),
      highUsageThresholdBp: threshold,
      openingIncomeEnabled: form.get("openingIncome") === "on",
    });
    refresh();
  });
}

export async function deleteCompanyAction(_prev: Prev, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAppContext();
    const org = await getOrganization(ctx);
    if (String(form.get("confirm") ?? "").trim() !== org.name) {
      throw new DomainError("confirm_mismatch");
    }
    await deleteOrganization(ctx);
    redirect("/onboarding");
  });
}

export async function saveDepartmentsAction(_prev: Prev, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAppContext();
    await saveDepartments(ctx, {
      departments: parseDepartmentsPayload(String(form.get("payload") ?? "[]")),
      recalculateCurrentPeriod: form.get("recalculate") === "on",
    });
    refresh();
  });
}

export async function createRuleAction(_prev: Prev, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAppContext();
    await createRule(ctx, {
      matchText: String(form.get("matchText") ?? ""),
      departmentId: String(form.get("departmentId") ?? ""),
      priority: int(form.get("priority")) || 0,
    });
    refresh();
    return { ok: true, message: "Regla creada" };
  });
}

export async function deleteRuleAction(_prev: Prev, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAppContext();
    await deleteRule(ctx, String(form.get("id") ?? ""));
    refresh();
  });
}

export async function addMemberAction(_prev: Prev, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAppContext();
    await addMember(ctx, {
      email: String(form.get("email") ?? ""),
      role: roleSchema.parse(form.get("role")),
    });
    refresh();
    return { ok: true, message: "Usuario agregado" };
  });
}

export async function changeRoleAction(_prev: Prev, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAppContext();
    await changeMemberRole(ctx, String(form.get("id") ?? ""), roleSchema.parse(form.get("role")));
    refresh();
  });
}

export async function removeMemberAction(_prev: Prev, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAppContext();
    await removeMember(ctx, String(form.get("id") ?? ""));
    refresh();
  });
}
