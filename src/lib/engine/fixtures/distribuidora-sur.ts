/**
 * Mandatory test case "Distribuidora Sur" (fictional). Also reused by the dev seed.
 * All figures in USD (base currency). Opening balance 0, opening income disabled.
 */
import type {
  AllocationVersion,
  Cents,
  DepartmentInput,
  EngineInput,
  EngineSettings,
  IsoDate,
  PlannedOutflowInput,
  TransactionInput,
} from "../types";

export const usd = (whole: number): Cents => BigInt(whole) * 100n;

export const DEPARTMENTS: DepartmentInput[] = [
  { id: "ops", name: "Operaciones", sortOrder: 1, minimumReserve: usd(5_000) },
  { id: "inv", name: "Inventario", sortOrder: 2, minimumReserve: 0n },
  { id: "tax", name: "Impuestos", sortOrder: 3, minimumReserve: usd(10_000) },
  { id: "log", name: "Logística", sortOrder: 4, minimumReserve: 0n },
  { id: "mkt", name: "Marketing", sortOrder: 5, minimumReserve: 0n },
  { id: "res", name: "Reservas", sortOrder: 6, minimumReserve: usd(5_000) },
];

export const ALLOCATION: AllocationVersion = {
  effectiveFrom: "2026-11-01",
  percentBp: { ops: 3500, inv: 2500, tax: 2000, log: 1000, mkt: 500, res: 500 },
};

export const SETTINGS: EngineSettings = {
  horizonDays: 30,
  upcomingDueDays: 7,
  highUsageThresholdBp: 9000,
  openingIncomeEnabled: false,
};

const outflow = (
  id: string,
  kind: PlannedOutflowInput["kind"],
  description: string,
  amount: number,
  dueDate: IsoDate,
  departmentId: string,
): PlannedOutflowInput => ({
  id,
  kind,
  description,
  amount: usd(amount),
  dueDate,
  departmentId,
  status: "pending",
});

const expense = (id: string, date: IsoDate, amount: number, dept: string): TransactionInput => ({
  id,
  date,
  amount: -usd(amount),
  type: "expense",
  departmentId: dept,
});

export const OUTFLOWS = {
  salaries: outflow("salaries", "obligation", "Sueldos", 30_000, "2026-11-30", "ops"),
  dgi: outflow("dgi", "obligation", "Impuestos DGI", 10_000, "2026-11-18", "tax"),
  supplierOrder: outflow(
    "supplier-order",
    "commitment",
    "Orden a proveedor",
    5_000,
    "2026-11-07",
    "inv",
  ),
  inventoryOrder: outflow(
    "inventory-order",
    "commitment",
    "Orden de inventario",
    8_000,
    "2026-11-22",
    "inv",
  ),
  campaign: outflow("campaign", "commitment", "Campaña de marketing", 2_000, "2026-11-25", "mkt"),
};

export type Scenario = "A" | "B" | "C" | "D";

const DEFAULT_AS_OF: Record<Scenario, IsoDate> = {
  A: "2026-11-01",
  B: "2026-11-15",
  C: "2026-11-15",
  D: "2026-11-20",
};

/** Builds the engine input for a scenario. Scenarios are cumulative (B includes A, etc.). */
export function distribuidoraSur(scenario: Scenario, asOf = DEFAULT_AS_OF[scenario]): EngineInput {
  const step = { A: 0, B: 1, C: 2, D: 3 }[scenario];
  const transactions: TransactionInput[] = [
    {
      id: "income-1",
      date: "2026-11-01",
      amount: usd(100_000),
      type: "income",
      departmentId: null,
    },
  ];
  const plannedOutflows: PlannedOutflowInput[] = [
    OUTFLOWS.salaries,
    OUTFLOWS.dgi,
    OUTFLOWS.supplierOrder,
  ];

  if (step >= 1) {
    transactions.push(
      expense("pay-supplier-order", "2026-11-07", 5_000, "inv"),
      expense("inventory-purchases", "2026-11-10", 12_000, "inv"),
      expense("logistics", "2026-11-12", 8_000, "log"),
      expense("marketing", "2026-11-13", 3_000, "mkt"),
    );
    plannedOutflows[2] = { ...OUTFLOWS.supplierOrder, status: "paid" };
    plannedOutflows.push(OUTFLOWS.inventoryOrder, OUTFLOWS.campaign);
  }
  if (step >= 2) {
    transactions.push(expense("repair", "2026-11-15", 12_000, "log"));
  }
  if (step >= 3) {
    transactions.push(expense("pay-dgi", "2026-11-18", 10_000, "tax"));
    plannedOutflows[1] = { ...OUTFLOWS.dgi, status: "paid" };
  }

  return {
    asOf,
    initialBalance: 0n,
    departments: DEPARTMENTS,
    allocationVersions: [ALLOCATION],
    transactions,
    plannedOutflows,
    settings: SETTINGS,
  };
}
