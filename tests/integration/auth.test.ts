import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { account, user } from "@/db/schema";
import { auth } from "@/server/auth";
import { resetDb } from "./helpers";

describe("authentication (email + password)", () => {
  beforeEach(resetDb);

  const credentials = { email: "duenio@distribuidorasur.uy", password: "una-clave-segura-123" };

  it("signs up, stores only a password hash, and signs in", async () => {
    const signUp = await auth.api.signUpEmail({ body: { ...credentials, name: "Dueño" } });
    expect(signUp.user.email).toBe(credentials.email);

    const [stored] = await db.select().from(account).where(eq(account.userId, signUp.user.id));
    expect(stored?.password).toBeTruthy();
    expect(stored?.password).not.toContain(credentials.password);

    const signIn = await auth.api.signInEmail({ body: credentials });
    expect(signIn.user.id).toBe(signUp.user.id);
  });

  it("rejects a wrong password and a short password", async () => {
    await auth.api.signUpEmail({ body: { ...credentials, name: "Dueño" } });
    await expect(
      auth.api.signInEmail({ body: { ...credentials, password: "otra-clave-9999" } }),
    ).rejects.toThrow();
    await expect(
      auth.api.signUpEmail({ body: { email: "x@y.uy", password: "corta", name: "X" } }),
    ).rejects.toThrow();
  });

  it("users start without two-factor enabled (it is opt-in)", async () => {
    const { user: created } = await auth.api.signUpEmail({ body: { ...credentials, name: "D" } });
    const [row] = await db.select().from(user).where(eq(user.id, created.id));
    expect(row?.twoFactorEnabled).toBe(false);
  });
});
