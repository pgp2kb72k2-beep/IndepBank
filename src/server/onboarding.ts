import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { allocationConfigVersion, organization } from "@/db/schema";
import { writeAudit } from "./audit";
import type { Db } from "./db-types";
import { NotFoundError } from "./errors";
import { assertCan } from "./permissions";
import type { OrgContext } from "./scoped";

export type OnboardingStep = "company" | "departments" | "reserves" | "done";

export const ONBOARDING_PATH: Record<Exclude<OnboardingStep, "done">, string> = {
  company: "/onboarding",
  departments: "/onboarding/departamentos",
  reserves: "/onboarding/reservas",
};

/** Where the organization is in the 3-step onboarding. `null` context = no company yet. */
export async function getOnboardingStep(
  ctx: OrgContext | null,
  database: Db = db,
): Promise<OnboardingStep> {
  if (!ctx) return "company";
  const [org] = await database
    .select({ completedAt: organization.onboardingCompletedAt })
    .from(organization)
    .where(eq(organization.id, ctx.organizationId));
  if (!org) throw new NotFoundError("organization");
  if (org.completedAt) return "done";

  const [version] = await database
    .select({ id: allocationConfigVersion.id })
    .from(allocationConfigVersion)
    .where(eq(allocationConfigVersion.organizationId, ctx.organizationId))
    .limit(1);
  return version ? "reserves" : "departments";
}

export async function completeOnboarding(ctx: OrgContext, database: Db = db): Promise<void> {
  assertCan(ctx, "write");
  await database.transaction(async (tx) => {
    const [updated] = await tx
      .update(organization)
      .set({ onboardingCompletedAt: new Date() })
      .where(
        and(eq(organization.id, ctx.organizationId), isNull(organization.onboardingCompletedAt)),
      )
      .returning({ completedAt: organization.onboardingCompletedAt });
    if (!updated) return; // already completed
    await writeAudit(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "update",
      entity: "organization",
      entityId: ctx.organizationId,
      before: { onboardingCompletedAt: null },
      after: updated,
    });
  });
}
