import { describe, expect, it } from "vitest";
import { allocateAmount, validateAllocation, versionFor } from "./allocation";
import type { DepartmentInput } from "./types";

const dept = (id: string, sortOrder: number): DepartmentInput => ({
  id,
  name: id,
  sortOrder,
  minimumReserve: 0n,
});
const ABC = [dept("a", 1), dept("b", 2), dept("c", 3)];
const total = (m: Map<string, bigint>) => [...m.values()].reduce((s, v) => s + v, 0n);

describe("validateAllocation", () => {
  it("accepts percentages that add up to exactly 100%", () => {
    expect(validateAllocation({ a: 5000, b: 3000, c: 2000 }, ["a", "b", "c"])).toEqual([]);
  });

  it("reports every problem", () => {
    expect(validateAllocation({}, ["a"])).toEqual(["empty"]);
    expect(validateAllocation({ a: 9999 }, ["a"])).toEqual(["sum_not_100"]);
    expect(validateAllocation({ a: 10_001, b: -1 }, ["a", "b"])).toEqual(["negative_percent"]);
    expect(validateAllocation({ a: 5000.5, b: 4999.5 }, ["a", "b"])).toEqual([
      "non_integer_percent",
    ]);
    expect(validateAllocation({ a: 5000, z: 5000 }, ["a"])).toEqual(["unknown_department"]);
  });
});

describe("allocateAmount", () => {
  it("splits exactly when there is no remainder", () => {
    const shares = allocateAmount(10_000n, { a: 5000, b: 3000, c: 2000 }, ABC);
    expect(Object.fromEntries(shares)).toEqual({ a: 5000n, b: 3000n, c: 2000n });
  });

  it("gives the rounding remainder to the highest percentage", () => {
    // 100 cents: 33 + 33 + 33 = 99 → the remaining cent goes to c (3334 bp).
    const shares = allocateAmount(100n, { a: 3333, b: 3333, c: 3334 }, ABC);
    expect(Object.fromEntries(shares)).toEqual({ a: 33n, b: 33n, c: 34n });
  });

  it("breaks ties by lowest sortOrder, regardless of input order", () => {
    const shares = allocateAmount(1n, { a: 5000, b: 5000 }, [dept("b", 2), dept("a", 1)]);
    expect(Object.fromEntries(shares)).toEqual({ a: 1n, b: 0n });
  });

  it("gives 0 to departments without a percentage", () => {
    const shares = allocateAmount(999n, { a: 10_000 }, ABC);
    expect(Object.fromEntries(shares)).toEqual({ a: 999n, b: 0n, c: 0n });
    const skipFirst = allocateAmount(999n, { b: 3333, c: 6667 }, ABC);
    expect(Object.fromEntries(skipFirst)).toEqual({ a: 0n, b: 332n, c: 667n });
  });

  it("splits negative amounts symmetrically", () => {
    const shares = allocateAmount(-101n, { a: 5000, b: 5000 }, [dept("a", 1), dept("b", 2)]);
    expect(Object.fromEntries(shares)).toEqual({ a: -51n, b: -50n });
  });

  it("always adds up to the original amount", () => {
    const percent = { a: 3500, b: 2500, c: 4000 };
    for (const amount of [0n, 1n, 7n, 99n, 12_345n, 10_000_001n, 987_654_321_987n]) {
      expect(total(allocateAmount(amount, percent, ABC))).toBe(amount);
    }
  });

  it("refuses an invalid configuration", () => {
    expect(() => allocateAmount(100n, { a: 9000 }, ABC)).toThrow(/sum_not_100/);
  });
});

describe("versionFor", () => {
  const v1 = { effectiveFrom: "2026-10-01", percentBp: { a: 10_000 } };
  const v2 = { effectiveFrom: "2026-11-10", percentBp: { b: 10_000 } };
  const recalc = { effectiveFrom: "2026-11-01", percentBp: { c: 10_000 } };

  it("uses the latest version in force on the date", () => {
    expect(versionFor("2026-11-05", [v1, v2])).toBe(v1);
    expect(versionFor("2026-11-10", [v1, v2])).toBe(v2);
  });

  it("a later 'recalculate period' version overrides earlier ones from the 1st", () => {
    expect(versionFor("2026-11-05", [v1, v2, recalc])).toBe(recalc);
    expect(versionFor("2026-11-20", [v1, v2, recalc])).toBe(recalc);
    expect(versionFor("2026-10-31", [v1, v2, recalc])).toBe(v1);
  });

  it("throws when nothing is in force", () => {
    expect(() => versionFor("2026-09-30", [v1])).toThrow(/No allocation/);
  });
});
