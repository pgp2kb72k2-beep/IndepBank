import { z } from "zod";

/**
 * Server-side environment, validated once at startup.
 * Never import this module from client components.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  APP_URL: z.url().default("http://localhost:3000"),
  APP_TIMEZONE: z.literal("America/Montevideo").default("America/Montevideo"),
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

let cached: Env | undefined;

export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
