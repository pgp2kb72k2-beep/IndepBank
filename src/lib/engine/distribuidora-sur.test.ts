import { describe, expect, it } from "vitest";
import { computeSnapshot } from "./compute";
import { distribuidoraSur, usd, type Scenario } from "./fixtures/distribuidora-sur";
import type { Snapshot } from "./types";

type ByDept = Record<"ops" | "inv" | "tax" | "log" | "mkt" | "res", number>;

const field = (s: Snapshot, key: "assigned" | "protected" | "available") =>
  Object.fromEntries(s.departments.map((d) => [d.id, d[key]]));

const inUsd = (values: ByDept) =>
  Object.fromEntries(Object.entries(values).map(([k, v]) => [k, usd(v)]));

/** Compact alert list for readable assertions: "code:subject". */
const alertKeys = (s: Snapshot) =>
  s.alerts.map((a) => `${a.code}:${a.plannedOutflowId ?? a.departmentId ?? "company"}`);

function expectInvariant(s: Snapshot) {
  const sumAvailable = s.departments.reduce((acc, d) => acc + d.available, 0n);
  expect(sumAvailable).toBe(s.safeToSpend.safeToSpend);
  expect(s.reconciliation.difference).toBe(0n);
}

describe("Distribuidora Sur — escenario A (día 1, ingreso de 100.000)", () => {
  const s = computeSnapshot(distribuidoraSur("A"));

  it("bank balance and allocation", () => {
    expect(s.safeToSpend.bankBalance).toBe(usd(100_000));
    expect(field(s, "assigned")).toEqual(
      inUsd({ ops: 35_000, inv: 25_000, tax: 20_000, log: 10_000, mkt: 5_000, res: 5_000 }),
    );
  });

  it("protected and available per department", () => {
    expect(field(s, "protected")).toEqual(
      inUsd({ ops: 35_000, inv: 5_000, tax: 20_000, log: 0, mkt: 0, res: 5_000 }),
    );
    expect(field(s, "available")).toEqual(
      inUsd({ ops: 0, inv: 20_000, tax: 0, log: 10_000, mkt: 5_000, res: 0 }),
    );
  });

  it("Safe-to-Spend = 100.000 − 40.000 − 5.000 − 20.000 = 35.000", () => {
    expect(s.safeToSpend).toEqual({
      bankBalance: usd(100_000),
      obligationsPending: usd(40_000),
      commitmentsPending: usd(5_000),
      minimumReserves: usd(20_000),
      safeToSpend: usd(35_000),
    });
    expectInvariant(s);
  });

  it("alerts: only the supplier order due in 6 days", () => {
    expect(alertKeys(s)).toEqual(["upcoming_due:supplier-order"]);
    expect(s.alerts[0]).toMatchObject({ severity: "info", daysUntilDue: 6 });
  });
});

describe("Distribuidora Sur — escenario B (día 15)", () => {
  const s = computeSnapshot(distribuidoraSur("B"));

  it("bank balance 72.000 and Safe-to-Spend 2.000", () => {
    expect(s.safeToSpend.bankBalance).toBe(usd(72_000));
    expect(s.safeToSpend.safeToSpend).toBe(usd(2_000));
    expect(s.safeToSpend.commitmentsPending).toBe(usd(10_000));
    expectInvariant(s);
  });

  it("available per department", () => {
    expect(field(s, "available")).toEqual(
      inUsd({ ops: 0, inv: 0, tax: 0, log: 2_000, mkt: 0, res: 0 }),
    );
  });

  it("alerts: high usage in Inventario and Marketing, DGI and inventory order upcoming", () => {
    expect(alertKeys(s)).toEqual([
      "high_usage:inv",
      "high_usage:mkt",
      "upcoming_due:dgi",
      "upcoming_due:inventory-order",
    ]);
    expect(s.alerts[0]).toMatchObject({ severity: "warning", usageBp: 10_000 });
  });
});

describe("Distribuidora Sur — escenario C (día 15, reparación de 12.000 en Logística)", () => {
  const s = computeSnapshot(distribuidoraSur("C"));

  it("bank balance 60.000, Logística −10.000, Safe-to-Spend −10.000", () => {
    expect(s.safeToSpend.bankBalance).toBe(usd(60_000));
    expect(s.departments.find((d) => d.id === "log")).toMatchObject({
      available: -usd(10_000),
      status: "over",
    });
    expect(s.safeToSpend.safeToSpend).toBe(-usd(10_000));
    expectInvariant(s);
  });

  it("alerts: reserves in use (critical) and Logística over (warning)", () => {
    expect(alertKeys(s)).toEqual([
      "safe_to_spend_negative:company",
      "department_over:log",
      "high_usage:inv",
      "high_usage:mkt",
      "upcoming_due:dgi",
      "upcoming_due:inventory-order",
    ]);
    expect(s.alerts[0]).toMatchObject({ severity: "critical", amount: usd(10_000) });
    expect(s.alerts[1]).toMatchObject({ severity: "warning", amount: usd(10_000) });
  });
});

describe("Distribuidora Sur — escenario D (día 20, DGI pagada el 18)", () => {
  const s = computeSnapshot(distribuidoraSur("D"));

  it("bank balance 50.000, pending 30.000 + 10.000, Safe-to-Spend −10.000", () => {
    expect(s.safeToSpend).toEqual({
      bankBalance: usd(50_000),
      obligationsPending: usd(30_000),
      commitmentsPending: usd(10_000),
      minimumReserves: usd(20_000),
      safeToSpend: -usd(10_000),
    });
    expect(s.departments.find((d) => d.id === "tax")?.available).toBe(0n);
    expectInvariant(s);
  });

  it("alerts: full expected list (salaries are not upcoming yet)", () => {
    expect(alertKeys(s)).toEqual([
      "safe_to_spend_negative:company",
      "department_over:log",
      "high_usage:inv",
      "high_usage:mkt",
      "upcoming_due:inventory-order",
      "upcoming_due:campaign",
    ]);
  });

  it("salaries (due 30-nov) become upcoming on day 23, not on day 22", () => {
    const day22 = computeSnapshot(distribuidoraSur("D", "2026-11-22"));
    const day23 = computeSnapshot(distribuidoraSur("D", "2026-11-23"));
    expect(alertKeys(day22)).not.toContain("upcoming_due:salaries");
    expect(alertKeys(day23)).toContain("upcoming_due:salaries");
    expect(day23.alerts.find((a) => a.plannedOutflowId === "salaries")?.daysUntilDue).toBe(7);
  });

  it("an unpaid commitment past its due date is overdue (critical)", () => {
    const day23 = computeSnapshot(distribuidoraSur("D", "2026-11-23"));
    expect(day23.alerts[0]).toMatchObject({
      code: "overdue",
      severity: "critical",
      plannedOutflowId: "inventory-order",
      daysUntilDue: -1,
    });
  });
});

describe("Distribuidora Sur — invariant holds in every scenario", () => {
  it.each<Scenario>(["A", "B", "C", "D"])("scenario %s", (scenario) => {
    expectInvariant(computeSnapshot(distribuidoraSur(scenario)));
  });
});
