/**
 * Domain types for the calculation engine.
 *
 * The engine is pure TypeScript: no database, no React, no clock. Callers pass
 * everything in (including `asOf`) and get plain data back.
 *
 * Money is always `bigint` in minor units (cents). Never use `number` for money.
 */

/** Amount in minor units (cents). */
export type Cents = bigint;

/** Calendar date as `YYYY-MM-DD`, interpreted in the organization's time zone. */
export type IsoDate = string;

/** Allocation percentages in basis points: 3500 = 35%. Must add up to 10000. */
export type PercentBp = Readonly<Record<string, number>>;

export interface DepartmentInput {
  id: string;
  name: string;
  sortOrder: number;
  minimumReserve: Cents;
  /**
   * Deactivated departments must still be passed when an allocation version in force this
   * month names them: incomes before the change were assigned to them. Their reserve no
   * longer counts. Default `true`.
   */
  active?: boolean;
}

export interface AllocationVersion {
  /** First date (inclusive) on which these percentages apply. */
  effectiveFrom: IsoDate;
  percentBp: PercentBp;
}

export type TransactionType = "income" | "expense" | "transfer";

export interface TransactionInput {
  id: string;
  date: IsoDate;
  /** Signed: income > 0, expense < 0. Transfers carry their own sign per account. */
  amount: Cents;
  type: TransactionType;
  /** Only meaningful for expenses. `null` = not classified yet. */
  departmentId: string | null;
  /** Incomes only. `false` = not distributed (refunds, loans received...). Default `true`. */
  distributable?: boolean;
}

export type PlannedOutflowKind = "obligation" | "commitment";
export type PlannedOutflowStatus = "pending" | "paid" | "cancelled";

export interface PlannedOutflowInput {
  id: string;
  kind: PlannedOutflowKind;
  description: string;
  /** Positive amount to be paid. */
  amount: Cents;
  dueDate: IsoDate;
  departmentId: string;
  status: PlannedOutflowStatus;
}

export interface EngineSettings {
  /** Pending items due within `asOf + horizonDays` are protected. Overdue ones always count. */
  horizonDays: number;
  /** "Upcoming due" alert fires when an item is due in this many days or fewer. */
  upcomingDueDays: number;
  /** "High usage" alert threshold in basis points (9000 = 90%). */
  highUsageThresholdBp: number;
  /** Treat the balance at period start as an income distributed with current percentages. */
  openingIncomeEnabled: boolean;
}

export interface EngineInput {
  /** Day the snapshot is computed for. The period is the calendar month containing it. */
  asOf: IsoDate;
  /** Sum of the bank accounts' opening balances, before any imported transaction. */
  initialBalance: Cents;
  departments: readonly DepartmentInput[];
  /** In creation order. When several apply to a date, the last one wins. */
  allocationVersions: readonly AllocationVersion[];
  /** All transactions (any date). The engine filters by period and `asOf`. */
  transactions: readonly TransactionInput[];
  /** All planned outflows, any status. The engine keeps pending ones within the horizon. */
  plannedOutflows: readonly PlannedOutflowInput[];
  settings: EngineSettings;
}

export type DepartmentStatus = "ok" | "high_usage" | "over";

export interface DepartmentResult {
  id: string;
  name: string;
  active: boolean;
  /** Percentage in force on `asOf`. */
  percentBp: number;
  assigned: Cents;
  spent: Cents;
  obligationsPending: Cents;
  commitmentsPending: Cents;
  minimumReserve: Cents;
  /** obligationsPending + commitmentsPending + minimumReserve */
  protected: Cents;
  /** assigned − spent − protected. Negative means the department overspent. */
  available: Cents;
  /** (spent + pending) / assigned in basis points, floored. `null` when nothing was assigned. */
  usageBp: number | null;
  status: DepartmentStatus;
}

export interface SafeToSpendBreakdown {
  bankBalance: Cents;
  obligationsPending: Cents;
  commitmentsPending: Cents;
  minimumReserves: Cents;
  /** bankBalance − obligationsPending − commitmentsPending − minimumReserves */
  safeToSpend: Cents;
}

/**
 * Explains why Σ available may differ from Safe-to-Spend.
 * difference = unassignedIncome − unclassifiedExpenses + transfersNet + other
 */
export interface Reconciliation {
  /** safeToSpend − Σ available. Zero when the invariant holds. */
  difference: Cents;
  /** Opening balance not distributed (opening income disabled) + non-distributable incomes. */
  unassignedIncome: Cents;
  /** Positive total of expenses without a (known) department. */
  unclassifiedExpenses: Cents;
  unclassifiedCount: number;
  /** Net of transfers between own accounts in the period (0 when all legs are imported). */
  transfersNet: Cents;
  /** Anything else, e.g. planned outflows assigned to a department not in the input. */
  other: Cents;
}

export type AlertSeverity = "info" | "warning" | "critical";

export type AlertCode =
  | "upcoming_due"
  | "uncovered_due"
  | "overdue"
  | "department_over"
  | "high_usage"
  | "safe_to_spend_negative"
  | "unclassified_expenses";

export interface Alert {
  code: AlertCode;
  severity: AlertSeverity;
  departmentId?: string;
  plannedOutflowId?: string;
  /** Main amount of the alert (item amount, overspend, reserves in use...). */
  amount?: Cents;
  /** uncovered_due only: how much is missing to pay the item. */
  shortfall?: Cents;
  dueDate?: IsoDate;
  /** Negative when overdue. */
  daysUntilDue?: number;
  /** high_usage only. */
  usageBp?: number;
  /** unclassified_expenses only. */
  count?: number;
}

export interface Snapshot {
  asOf: IsoDate;
  periodStart: IsoDate;
  /** Balance right before the period started. */
  openingBalance: Cents;
  departments: DepartmentResult[];
  safeToSpend: SafeToSpendBreakdown;
  reconciliation: Reconciliation;
  alerts: Alert[];
}
