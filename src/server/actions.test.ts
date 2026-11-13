import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { runAction, toActionError } from "./actions";
import { DomainError, ForbiddenError, NotFoundError } from "./errors";

describe("toActionError", () => {
  it("maps each error kind to Spanish copy", () => {
    expect(toActionError(new ForbiddenError())).toEqual({
      ok: false,
      error: "No tenés permiso para hacer esto.",
    });
    expect(toActionError(new NotFoundError("x"))).toMatchObject({ error: /No encontramos/ });
    expect(toActionError(new DomainError("last_owner"))).toMatchObject({ error: /un dueño/ });
    expect(toActionError(new DomainError("nope"))).toMatchObject({ error: "No se pudo guardar." });
  });

  it("uses known validation codes and a generic message otherwise", () => {
    const schema = z.number().refine(() => false, { message: "sum_not_100" });
    expect(toActionError(schema.safeParse(1).error)).toMatchObject({ error: /100%/ });
    expect(toActionError(z.string().safeParse(1).error)).toMatchObject({ error: /Revisá/ });
  });

  it("never logs the error contents", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(toActionError(new Error("saldo 35000"))).toMatchObject({ error: /Algo salió mal/ });
    expect(spy).toHaveBeenCalledWith("Unexpected action error:", "Error");
    spy.mockRestore();
  });
});

describe("runAction", () => {
  it("returns ok, the action's own result, or a mapped error", async () => {
    expect(await runAction(async () => {})).toEqual({ ok: true });
    expect(await runAction(async () => ({ ok: true, message: "Listo" }))).toEqual({
      ok: true,
      message: "Listo",
    });
    expect(
      await runAction(async () => {
        throw new ForbiddenError();
      }),
    ).toMatchObject({ ok: false });
  });

  it("lets framework redirects through", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;/x" });
    await expect(
      runAction(async () => {
        throw redirect;
      }),
    ).rejects.toBe(redirect);
  });
});
