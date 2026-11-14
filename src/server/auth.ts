import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { db } from "@/db/client";
import * as authSchema from "@/db/auth-schema";
import { appOrigins, env } from "@/env";

const isProduction = env().NODE_ENV === "production";

export const auth = betterAuth({
  appName: "IndepBank",
  ...appOrigins(env()), // baseURL + trustedOrigins (production, previews, localhost)
  secret: env().BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh once a day
  },
  rateLimit: {
    // Also on in development so the behaviour can be tested locally.
    enabled: env().NODE_ENV !== "test",
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/two-factor/verify-totp": { window: 60, max: 5 },
      "/two-factor/verify-backup-code": { window: 60, max: 5 },
    },
  },
  advanced: {
    useSecureCookies: isProduction,
    defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure: isProduction },
  },
  plugins: [
    twoFactor({ issuer: "IndepBank" }),
    nextCookies(), // must stay last: lets server actions set auth cookies
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
