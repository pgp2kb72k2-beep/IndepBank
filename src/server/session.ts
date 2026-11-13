import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
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

/** User + organization + role. Redirects to onboarding when the user has no organization. */
export async function requireOrgContext(): Promise<OrgContext> {
  const user = await requireUser();
  const preferred = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  const ctx = await resolveOrgContext(user.id, preferred);
  if (!ctx) redirect("/onboarding");
  return ctx;
}
