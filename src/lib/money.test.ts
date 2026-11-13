import { describe, expect, it } from "vitest";
import { centsToInput, formatMoney, formatPercent, parseMoney, parsePercent } from "./money";

describe("formatMoney (es-UY)", () => {
  it("uses . for thousands and , for decimals", () => {
    expect(formatMoney(3_500_000n, "USD")).toBe("US$ 35.000");
    expect(formatMoney(123_456_789n, "UYU")).toBe("$ 1.234.567,89");
    expect(formatMoney(50n, "USD")).toBe("US$ 0,50");
    expect(formatMoney(-1_000_000n, "USD")).toBe("−US$ 10.000");
    expect(formatMoney(100n, "USD", { cents: true })).toBe("US$ 1,00");
  });
});

describe("parseMoney", () => {
  it.each([
    ["35.000", 3_500_000n],
    ["35000", 3_500_000n],
    ["35.000,5", 3_500_050n],
    ["1.234.567,89", 123_456_789n],
    [" US$ 5.000 ", 500_000n],
    ["$1.000", 100_000n],
    ["-500", -50_000n],
    ["0", 0n],
  ])("%s → %s cents", (input, cents) => {
    expect(parseMoney(input)).toBe(cents);
  });

  it.each(["", "abc", "35,000.00", "1.23", "35.0000", "1,234", "12,345"])("rejects %s", (input) => {
    expect(parseMoney(input)).toBeNull();
  });

  it("formats inputs with thousands separators", () => {
    expect(centsToInput(500_000n)).toBe("5.000");
    expect(centsToInput(123_456_789n)).toBe("1.234.567,89");
  });

  it("round-trips through the input format", () => {
    for (const cents of [0n, 1n, 99n, 3_500_000n, 123_456_789n, -50n]) {
      expect(parseMoney(centsToInput(cents))).toBe(cents);
    }
  });
});

describe("percentages", () => {
  it("formats basis points", () => {
    expect(formatPercent(3500)).toBe("35%");
    expect(formatPercent(1250)).toBe("12,5%");
    expect(formatPercent(25)).toBe("0,25%");
  });

  it("parses what a person types", () => {
    expect(parsePercent("35")).toBe(3500);
    expect(parsePercent("12,5 %")).toBe(1250);
    expect(parsePercent("0,25")).toBe(25);
    expect(parsePercent("100")).toBe(10_000);
    expect(parsePercent("100,5")).toBeNull();
    expect(parsePercent("12.5")).toBeNull();
    expect(parsePercent("")).toBeNull();
  });
});

describe("parseDepartmentsPayload", async () => {
  const { parseDepartmentsPayload } = await import("./validation/departments");
  it("turns cent strings into bigint and rejects anything else", () => {
    const row = { name: "Ops", color: "#1A5CFF", icon: "briefcase", percentBp: 10_000 };
    expect(parseDepartmentsPayload(JSON.stringify([{ ...row, minimumReserve: "500000" }]))).toEqual(
      [{ ...row, minimumReserve: 500_000n }],
    );
    expect(() =>
      parseDepartmentsPayload(JSON.stringify([{ ...row, minimumReserve: "5,5" }])),
    ).toThrow();
  });
});
