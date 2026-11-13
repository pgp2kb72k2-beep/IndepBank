import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./auth-errors";

describe("authErrorMessage", () => {
  it("translates known codes, rate limiting and unknown errors", () => {
    expect(authErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD" })).toMatch(/no son correctos/);
    expect(authErrorMessage({ status: 429, code: "INVALID_CODE" })).toMatch(/demasiados intentos/);
    expect(authErrorMessage({ code: "SOMETHING_NEW" })).toMatch(/Algo salió mal/);
    expect(authErrorMessage({})).toMatch(/Algo salió mal/);
    expect(authErrorMessage(null)).toMatch(/Algo salió mal/);
  });
});
