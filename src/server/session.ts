import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { getOnboardingStep, ONBOARDING_PATH } from "./onboarding";
import { resolveOrgContext } from "./organizations";
import type { OrgContext } from "./scoped";

/** Cookie with the organization the user last chose. Only a hint: membership is re-checked. */
export const ACTIVE_ORG_COOKIE = "ib_active_org";

/** Signed-in user, verified against the database. Redirects to login otherwise. */
export async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/ingresar");
  return session.user;
}

/** Context if the user belongs to an organization, null otherwise. */
export async function getOrgContext(): Promise<OrgContext | null> {
  const user = await requireUser();
  const preferred = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  return resolveOrgContext(user.id, preferred);
}

/** User + organization + role. Redirects to onboarding when the user has no organization. */
export async function requireOrgContext(): Promise<OrgContext> {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/onboarding");
  return ctx;
}

/** For pages inside the app: also requires a finished onboarding. */
export async function requireAppContext(): Promise<OrgContext> {
  const ctx = await requireOrgContext();
  const step = await getOnboardingStep(ctx);
  if (step !== "done") redirect(ONBOARDING_PATH[step]);
  return ctx;
}

export async function setActiveOrganization(organizationId: string) {
  (await cookies()).set(ACTIVE_ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
