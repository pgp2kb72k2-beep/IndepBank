import { z } from "zod";

/**
 * Server-side environment, validated once at startup.
 * Never import this module from client components.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  /** Public URL of the app. On Vercel it can be omitted: the deployment URL is used. */
  APP_URL: z.url().optional(),
  APP_TIMEZONE: z.literal("America/Montevideo").default("America/Montevideo"),
  BETTER_AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
  // Set automatically by Vercel (hostnames without protocol).
  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
  VERCEL_URL: z.string().optional(),
  VERCEL_BRANCH_URL: z.string().optional(),
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    // Only field names are reported: values may contain secrets.
    throw new Error(`Invalid environment variables: ${fields}`);
  }
  return result.data;
}

const https = (host?: string) => (host ? `https://${host}` : undefined);

/**
 * Base URL for auth, plus every origin allowed to call it.
 * Preview deployments get their own URL (branch or deployment), so logins work there too.
 */
export function appOrigins(e: Env): { baseURL: string; trustedOrigins: string[] } {
  const preview =
    e.VERCEL_ENV === "preview" ? https(e.VERCEL_BRANCH_URL ?? e.VERCEL_URL) : undefined;
  const baseURL =
    preview ??
    e.APP_URL ??
    https(e.VERCEL_PROJECT_PRODUCTION_URL) ??
    https(e.VERCEL_URL) ??
    "http://localhost:3000";
  const trustedOrigins = [
    baseURL,
    e.APP_URL,
    https(e.VERCEL_URL),
    https(e.VERCEL_BRANCH_URL),
    https(e.VERCEL_PROJECT_PRODUCTION_URL),
  ]
    .filter((origin): origin is string => Boolean(origin))
    .map((origin) => new URL(origin).origin);
  return { baseURL, trustedOrigins: [...new Set(trustedOrigins)] };
}

let cached: Env | undefined;

export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
