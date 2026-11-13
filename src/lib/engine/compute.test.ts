import { describe, expect, it } from "vitest";
import { computeSnapshot } from "./compute";
import type { EngineInput, PlannedOutflowInput, TransactionInput } from "./types";

/** Two departments, 60/40, reserve 100 in "a". Amounts in cents to keep tests short. */
function base(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    asOf: "2026-11-15",
    initialBalance: 0n,
    departments: [
      { id: "a", name: "A", sortOrder: 1, minimumReserve: 100n },
      { id: "b", name: "B", sortOrder: 2, minimumReserve: 0n },
    ],
    allocationVersions: [{ effectiveFrom: "2026-01-01", percentBp: { a: 6000, b: 4000 } }],
    transactions: [],
    plannedOutflows: [],
    settings: {
      horizonDays: 30,
      upcomingDueDays: 7,
      highUsageThresholdBp: 9000,
      openingIncomeEnabled: false,
    },
    ...overrides,
  };
}

const income = (id: string, date: string, amount: bigint, extra = {}): TransactionInput => ({
  id,
  date,
  amount,
  type: "income",
  departmentId: null,
  ...extra,
});

const outflow = (over: Partial<PlannedOutflowInput>): PlannedOutflowInput => ({
  id: "o",
  kind: "obligation",
  description: "x",
  amount: 100n,
  dueDate: "2026-11-20",
  departmentId: "a",
  status: "pending",
  ...over,
});

const dept = (s: ReturnType<typeof computeSnapshot>, id: string) =>
  s.departments.find((d) => d.id === id)!;

describe("period and opening balance", () => {
  const history = [
    income("oct", "2026-10-20", 1_000n),
    income("nov", "2026-11-10", 500n),
    income("future", "2026-11-16", 9_999n),
  ];

  it("previous months feed the opening balance; transactions after asOf are ignored", () => {
    const s = computeSnapshot(base({ initialBalance: 200n, transactions: history }));
    expect(s.periodStart).toBe("2026-11-01");
    expect(s.openingBalance).toBe(1_200n);
    expect(s.safeToSpend.bankBalance).toBe(1_700n);
  });

  it("opening income disabled: the opening balance stays unassigned and is reported", () => {
    const s = computeSnapshot(base({ initialBalance: 200n, transactions: history }));
    expect(dept(s, "a").assigned).toBe(300n); // only November's 500 × 60%
    expect(s.reconciliation.unassignedIncome).toBe(1_200n);
    expect(s.reconciliation.difference).toBe(1_200n);
    expect(s.reconciliation.other).toBe(0n);
  });

  it("opening income enabled: the opening balance is distributed and the invariant holds", () => {
    const s = computeSnapshot(
      base({
        initialBalance: 200n,
        transactions: history,
        settings: { ...base().settings, openingIncomeEnabled: true },
      }),
    );
    expect(dept(s, "a").assigned).toBe(1_020n); // (1.200 + 500) × 60%
    expect(dept(s, "b").assigned).toBe(680n);
    expect(s.reconciliation.difference).toBe(0n);
  });

  it("opening income enabled with a zero opening balance distributes nothing", () => {
    const s = computeSnapshot(
      base({ settings: { ...base().settings, openingIncomeEnabled: true } }),
    );
    expect(dept(s, "a").assigned).toBe(0n);
    expect(s.reconciliation.unassignedIncome).toBe(0n);
  });

  it("rejects invalid dates anywhere in the input", () => {
    expect(() => computeSnapshot(base({ asOf: "2026-11-31" }))).toThrow();
    expect(() =>
      computeSnapshot(base({ transactions: [income("x", "2026-13-01", 1n)] })),
    ).toThrow();
    expect(() =>
      computeSnapshot(base({ plannedOutflows: [outflow({ dueDate: "15/11/2026" })] })),
    ).toThrow();
  });
});

describe("transactions", () => {
  it("non-distributable income adds to the balance but not to departments", () => {
    const s = computeSnapshot(
      base({ transactions: [income("loan", "2026-11-02", 1_000n, { distributable: false })] }),
    );
    expect(s.safeToSpend.bankBalance).toBe(1_000n);
    expect(dept(s, "a").assigned).toBe(0n);
    expect(s.reconciliation).toMatchObject({ unassignedIncome: 1_000n, other: 0n });
  });

  it("expenses without a known department are unclassified and raise an info alert", () => {
    const s = computeSnapshot(
      base({
        transactions: [
          income("i", "2026-11-01", 10_000n),
          { id: "e1", date: "2026-11-02", amount: -300n, type: "expense", departmentId: null },
          { id: "e2", date: "2026-11-03", amount: -200n, type: "expense", departmentId: "gone" },
          { id: "e3", date: "2026-11-03", amount: -50n, type: "expense", departmentId: "b" },
        ],
      }),
    );
    expect(dept(s, "b").spent).toBe(50n);
    expect(s.reconciliation).toMatchObject({
      unclassifiedExpenses: 500n,
      unclassifiedCount: 2,
      difference: -500n,
      other: 0n,
    });
    expect(s.alerts).toContainEqual({
      code: "unclassified_expenses",
      severity: "info",
      amount: 500n,
      count: 2,
    });
  });

  it("transfers between own accounts move the balance only by their net", () => {
    const s = computeSnapshot(
      base({
        transactions: [
          { id: "t1", date: "2026-11-05", amount: -400n, type: "transfer", departmentId: null },
          { id: "t2", date: "2026-11-05", amount: 400n, type: "transfer", departmentId: null },
          { id: "t3", date: "2026-11-06", amount: -50n, type: "transfer", departmentId: null },
        ],
      }),
    );
    expect(s.safeToSpend.bankBalance).toBe(-50n);
    expect(dept(s, "a").assigned).toBe(0n);
    expect(s.reconciliation).toMatchObject({ transfersNet: -50n, other: 0n });
  });
});

describe("planned outflows", () => {
  it("only pending items within the horizon are protected (overdue always count)", () => {
    const s = computeSnapshot(
      base({
        transactions: [income("i", "2026-11-01", 100_000n)],
        plannedOutflows: [
          outflow({ id: "in", amount: 10n, dueDate: "2026-12-15" }), // asOf + 30 → included
          outflow({ id: "out", amount: 20n, dueDate: "2026-12-16" }), // beyond horizon
          outflow({ id: "late", amount: 40n, dueDate: "2026-10-01" }), // overdue
          outflow({ id: "paid", amount: 80n, status: "paid" }),
          outflow({ id: "cancel", amount: 160n, status: "cancelled" }),
          outflow({ id: "c", kind: "commitment", amount: 5n, departmentId: "b" }),
        ],
      }),
    );
    expect(s.safeToSpend.obligationsPending).toBe(50n);
    expect(s.safeToSpend.commitmentsPending).toBe(5n);
    expect(dept(s, "a").protected).toBe(150n); // 10 + 40 + reserve 100
    expect(dept(s, "b").protected).toBe(5n);
  });

  it("items of an unknown department still reduce Safe-to-Spend and show up as 'other'", () => {
    const s = computeSnapshot(
      base({
        transactions: [income("i", "2026-11-01", 1_000n)],
        plannedOutflows: [
          outflow({ amount: 70n, departmentId: "gone" }),
          outflow({ id: "c", kind: "commitment", amount: 30n, departmentId: "gone" }),
        ],
      }),
    );
    expect(s.safeToSpend.safeToSpend).toBe(800n); // 1.000 − 70 − 30 − 100
    expect(s.reconciliation).toMatchObject({ difference: -100n, other: -100n });
  });
});

describe("department status", () => {
  it("nothing assigned and nothing used: ok, usage unknown", () => {
    const s = computeSnapshot(
      base({
        departments: [{ ...base().departments[1]! }],
        allocationVersions: [{ effectiveFrom: "2026-01-01", percentBp: { b: 10_000 } }],
      }),
    );
    expect(dept(s, "b")).toMatchObject({ status: "ok", usageBp: null, percentBp: 10_000 });
  });

  it("high usage exactly at the threshold, not just below it", () => {
    const at = computeSnapshot(
      base({
        transactions: [
          income("i", "2026-11-01", 1_000n), // b gets 400
          { id: "e", date: "2026-11-02", amount: -360n, type: "expense", departmentId: "b" },
        ],
      }),
    );
    expect(dept(at, "b")).toMatchObject({ status: "high_usage", usageBp: 9000 });

    const below = computeSnapshot(
      base({
        transactions: [
          income("i", "2026-11-01", 1_000n),
          { id: "e", date: "2026-11-02", amount: -359n, type: "expense", departmentId: "b" },
        ],
      }),
    );
    expect(dept(below, "b")).toMatchObject({ status: "ok", usageBp: 8975 });
  });

  it("a department missing from the current version has 0%", () => {
    const s = computeSnapshot(
      base({
        departments: [
          ...base().departments,
          { id: "new", name: "N", sortOrder: 3, minimumReserve: 0n },
        ],
      }),
    );
    expect(dept(s, "new").percentBp).toBe(0);
  });
});

describe("alerts", () => {
  it("an item the balance cannot cover after earlier items is critical, with its shortfall", () => {
    const s = computeSnapshot(
      base({
        transactions: [income("i", "2026-11-01", 1_000n)],
        plannedOutflows: [
          outflow({ id: "rent", amount: 700n, dueDate: "2026-11-20" }),
          outflow({ id: "same-day", amount: 100n, dueDate: "2026-11-20" }),
          outflow({ id: "salaries", amount: 500n, dueDate: "2026-12-01" }),
        ],
      }),
    );
    const uncovered = s.alerts.filter((a) => a.code === "uncovered_due");
    // rent: 1.000 ≥ 700 → covered. salaries: 1.000 − 800 = 200 < 500 → missing 300.
    expect(uncovered).toHaveLength(1);
    expect(uncovered[0]).toMatchObject({ plannedOutflowId: "salaries", shortfall: 300n });
  });

  it("are sorted by severity, then due date, then code", () => {
    const s = computeSnapshot(
      base({
        transactions: [income("i", "2026-11-01", 100n)],
        plannedOutflows: [
          outflow({ id: "soon", amount: 10n, dueDate: "2026-11-16" }),
          outflow({ id: "late", amount: 10n, dueDate: "2026-11-01" }),
          outflow({ id: "big", amount: 1_000n, dueDate: "2026-11-30" }),
        ],
      }),
    );
    expect(s.alerts.map((a) => `${a.severity}:${a.code}:${a.plannedOutflowId ?? "-"}`)).toEqual([
      "critical:overdue:late",
      "critical:uncovered_due:big",
      "critical:safe_to_spend_negative:-",
      "warning:department_over:-",
      "info:upcoming_due:soon",
    ]);
  });
});

describe("deactivated departments", () => {
  it("keep what they were assigned before the change; their reserve stops counting", () => {
    const s = computeSnapshot(
      base({
        departments: [
          { id: "a", name: "A", sortOrder: 1, minimumReserve: 100n },
          { id: "b", name: "B", sortOrder: 2, minimumReserve: 50n, active: false },
        ],
        allocationVersions: [
          { effectiveFrom: "2026-01-01", percentBp: { a: 6000, b: 4000 } },
          { effectiveFrom: "2026-11-10", percentBp: { a: 10_000 } },
        ],
        transactions: [
          income("before", "2026-11-05", 1_000n), // 600 / 400
          income("after", "2026-11-12", 1_000n), // 1.000 / 0
        ],
      }),
    );
    expect(dept(s, "b")).toMatchObject({ active: false, assigned: 400n, minimumReserve: 0n });
    expect(dept(s, "a")).toMatchObject({ active: true, assigned: 1_600n, percentBp: 10_000 });
    expect(s.safeToSpend.minimumReserves).toBe(100n);
    expect(s.reconciliation.difference).toBe(0n);
  });
});
