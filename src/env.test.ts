import { describe, expect, it } from "vitest";
import { appOrigins, parseEnv } from "./env";

const base = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  BETTER_AUTH_SECRET: "x".repeat(32),
};

describe("parseEnv", () => {
  it("accepts a valid postgres URL and applies defaults", () => {
    const env = parseEnv(base);
    expect(env.NODE_ENV).toBe("development");
    expect(env.APP_TIMEZONE).toBe("America/Montevideo");
  });

  it("rejects a missing or non-postgres DATABASE_URL without leaking values", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
    expect(() => parseEnv({ ...base, DATABASE_URL: "mysql://secret@host/db" })).toThrow(
      /^Invalid environment variables: DATABASE_URL$/,
    );
  });

  it("requires a long auth secret", () => {
    expect(() => parseEnv({ ...base, BETTER_AUTH_SECRET: "short" })).toThrow(/BETTER_AUTH_SECRET/);
  });
});

describe("appOrigins", () => {
  it("local development defaults to localhost:3000", () => {
    expect(appOrigins(parseEnv(base))).toEqual({
      baseURL: "http://localhost:3000",
      trustedOrigins: ["http://localhost:3000"],
    });
  });

  it("production uses APP_URL and also trusts Vercel's own URLs", () => {
    const { baseURL, trustedOrigins } = appOrigins(
      parseEnv({
        ...base,
        APP_URL: "https://app.indepbank.uy/",
        VERCEL_ENV: "production",
        VERCEL_URL: "indepbank-abc123.vercel.app",
        VERCEL_PROJECT_PRODUCTION_URL: "indepbank.vercel.app",
      }),
    );
    expect(baseURL).toBe("https://app.indepbank.uy/");
    expect(trustedOrigins).toEqual([
      "https://app.indepbank.uy",
      "https://indepbank-abc123.vercel.app",
      "https://indepbank.vercel.app",
    ]);
  });

  it("previews use their branch URL even if APP_URL points to production", () => {
    const { baseURL, trustedOrigins } = appOrigins(
      parseEnv({
        ...base,
        APP_URL: "https://indepbank.vercel.app",
        VERCEL_ENV: "preview",
        VERCEL_URL: "indepbank-git-x-abc.vercel.app",
        VERCEL_BRANCH_URL: "indepbank-git-stage-5.vercel.app",
      }),
    );
    expect(baseURL).toBe("https://indepbank-git-stage-5.vercel.app");
    expect(trustedOrigins).toContain("https://indepbank-git-x-abc.vercel.app");
  });

  it("without APP_URL on Vercel, uses the production domain or the deployment URL", () => {
    expect(
      appOrigins(
        parseEnv({
          ...base,
          VERCEL_ENV: "production",
          VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app",
        }),
      ).baseURL,
    ).toBe("https://x.vercel.app");
    expect(appOrigins(parseEnv({ ...base, VERCEL_URL: "y.vercel.app" })).baseURL).toBe(
      "https://y.vercel.app",
    );
  });
});
