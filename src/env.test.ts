import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

describe("parseEnv", () => {
  it("accepts a valid postgres URL and applies defaults", () => {
    const env = parseEnv({ DATABASE_URL: "postgresql://u:p@localhost:5432/db" });
    expect(env.NODE_ENV).toBe("development");
    expect(env.APP_TIMEZONE).toBe("America/Montevideo");
  });

  it("rejects a missing or non-postgres DATABASE_URL without leaking values", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
    expect(() => parseEnv({ DATABASE_URL: "mysql://secret@host/db" })).toThrow(
      /^Invalid environment variables: DATABASE_URL$/,
    );
  });
});
