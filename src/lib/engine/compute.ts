import { allocateAmount, FULL_BP, versionFor } from "./allocation";
import { computeAlerts } from "./alerts";
import { addDays, assertIsoDate, monthStart } from "./dates";
import type {
  Cents,
  DepartmentResult,
  DepartmentStatus,
  EngineInput,
  IsoDate,
  PlannedOutflowInput,
  Snapshot,
  TransactionInput,
} from "./types";

interface DepartmentAccumulator {
  assigned: Cents;
  spent: Cents;
  obligationsPending: Cents;
  commitmentsPending: Cents;
}

const sum = (values: Iterable<Cents>): Cents => {
  let total = 0n;
  for (const v of values) total += v;
  return total;
};

/**
 * Computes the full financial picture for the month containing `input.asOf`.
 *
 * Period rules:
 * - Transactions before the month only feed the opening balance.
 * - Transactions after `asOf` are ignored.
 * - Pending planned outflows count when due on or before `asOf + horizonDays`
 *   (overdue ones always count).
 */
export function computeSnapshot(input: EngineInput): Snapshot {
  const { asOf, settings } = input;
  assertIsoDate(asOf);
  const periodStart = monthStart(asOf);
  const horizonEnd = addDays(asOf, settings.horizonDays);

  const departments = [...input.departments].sort((a, b) => a.sortOrder - b.sortOrder);
  const acc = new Map<string, DepartmentAccumulator>(
    departments.map((d) => [
      d.id,
      { assigned: 0n, spent: 0n, obligationsPending: 0n, commitmentsPending: 0n },
    ]),
  );

  const distribute = (amount: Cents, date: IsoDate) => {
    const { percentBp } = versionFor(date, input.allocationVersions);
    for (const [id, share] of allocateAmount(amount, percentBp, departments)) {
      acc.get(id)!.assigned += share;
    }
  };

  // --- Opening balance -------------------------------------------------------
  let openingBalance = input.initialBalance;
  const inPeriod: TransactionInput[] = [];
  for (const tx of input.transactions) {
    assertIsoDate(tx.date);
    if (tx.date < periodStart) openingBalance += tx.amount;
    else if (tx.date <= asOf) inPeriod.push(tx);
  }

  // DECISION: no carry-over of department "available" between months (v1). Each month
  // restarts from the opening balance, redistributed with the percentages in force.
  // Revisit when we see how customers use it (e.g. carry over overspending).
  let unassignedIncome = 0n;
  if (!settings.openingIncomeEnabled) unassignedIncome += openingBalance;
  else if (openingBalance !== 0n) distribute(openingBalance, periodStart);

  // --- Transactions of the period ---------------------------------------------
  let bankBalance = openingBalance;
  let unclassifiedExpenses = 0n;
  let unclassifiedCount = 0;
  let transfersNet = 0n;

  for (const tx of inPeriod) {
    bankBalance += tx.amount;
    switch (tx.type) {
      case "income":
        if (tx.distributable === false) unassignedIncome += tx.amount;
        else distribute(tx.amount, tx.date);
        break;
      case "expense": {
        const dept = tx.departmentId ? acc.get(tx.departmentId) : undefined;
        if (dept) {
          dept.spent -= tx.amount;
        } else {
          unclassifiedExpenses -= tx.amount;
          unclassifiedCount += 1;
        }
        break;
      }
      case "transfer":
        transfersNet += tx.amount;
        break;
    }
  }

  // --- Planned outflows ---------------------------------------------------------
  const pending: PlannedOutflowInput[] = input.plannedOutflows.filter((o) => {
    assertIsoDate(o.dueDate);
    return o.status === "pending" && o.dueDate <= horizonEnd;
  });
  let obligationsPending = 0n;
  let commitmentsPending = 0n;
  for (const o of pending) {
    const dept = acc.get(o.departmentId);
    if (o.kind === "obligation") {
      obligationsPending += o.amount;
      if (dept) dept.obligationsPending += o.amount;
    } else {
      commitmentsPending += o.amount;
      if (dept) dept.commitmentsPending += o.amount;
    }
  }

  // --- Department results ---------------------------------------------------------
  const current = versionFor(asOf, input.allocationVersions);
  const threshold = BigInt(settings.highUsageThresholdBp);
  const results: DepartmentResult[] = departments.map((d) => {
    const a = acc.get(d.id)!;
    const protectedAmount = a.obligationsPending + a.commitmentsPending + d.minimumReserve;
    const available = a.assigned - a.spent - protectedAmount;
    const used = a.spent + a.obligationsPending + a.commitmentsPending;
    const hasAssigned = a.assigned > 0n;

    let status: DepartmentStatus = "ok";
    if (available < 0n) status = "over";
    else if (hasAssigned && used * BigInt(FULL_BP) >= threshold * a.assigned) status = "high_usage";

    return {
      id: d.id,
      name: d.name,
      percentBp: current.percentBp[d.id] ?? 0,
      assigned: a.assigned,
      spent: a.spent,
      obligationsPending: a.obligationsPending,
      commitmentsPending: a.commitmentsPending,
      minimumReserve: d.minimumReserve,
      protected: protectedAmount,
      available,
      usageBp: hasAssigned ? Number((used * BigInt(FULL_BP)) / a.assigned) : null,
      status,
    };
  });

  // --- Safe-to-Spend and reconciliation ------------------------------------------
  const minimumReserves = sum(departments.map((d) => d.minimumReserve));
  const safeToSpend = bankBalance - obligationsPending - commitmentsPending - minimumReserves;
  const difference = safeToSpend - sum(results.map((r) => r.available));
  const other = difference - unassignedIncome + unclassifiedExpenses - transfersNet;

  return {
    asOf,
    periodStart,
    openingBalance,
    departments: results,
    safeToSpend: {
      bankBalance,
      obligationsPending,
      commitmentsPending,
      minimumReserves,
      safeToSpend,
    },
    reconciliation: {
      difference,
      unassignedIncome,
      unclassifiedExpenses,
      unclassifiedCount,
      transfersNet,
      other,
    },
    alerts: computeAlerts({
      asOf,
      settings,
      bankBalance,
      safeToSpend,
      pending,
      departments: results,
      unclassifiedExpenses,
      unclassifiedCount,
    }),
  };
}
