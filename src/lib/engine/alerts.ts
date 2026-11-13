import { daysBetween } from "./dates";
import type {
  Alert,
  AlertSeverity,
  Cents,
  DepartmentResult,
  EngineSettings,
  IsoDate,
  PlannedOutflowInput,
} from "./types";

export interface AlertContext {
  asOf: IsoDate;
  settings: EngineSettings;
  bankBalance: Cents;
  safeToSpend: Cents;
  /** Pending planned outflows within the horizon (overdue included). */
  pending: readonly PlannedOutflowInput[];
  departments: readonly DepartmentResult[];
  unclassifiedExpenses: Cents;
  unclassifiedCount: number;
}

const SEVERITY_RANK: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
const NO_DATE = "~"; // sorts after any YYYY-MM-DD (plain code-unit comparison)

/** Plain string comparison. localeCompare would ignore punctuation such as "~". */
const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function computeAlerts(ctx: AlertContext): Alert[] {
  const alerts: Alert[] = [];
  const byDueDate = [...ctx.pending].sort((a, b) => compare(a.dueDate, b.dueDate));

  for (const item of byDueDate) {
    const base = {
      plannedOutflowId: item.id,
      departmentId: item.departmentId,
      amount: item.amount,
      dueDate: item.dueDate,
      daysUntilDue: daysBetween(ctx.asOf, item.dueDate),
    };

    if (base.daysUntilDue < 0) {
      alerts.push({ code: "overdue", severity: "critical", ...base });
      continue;
    }
    if (base.daysUntilDue <= ctx.settings.upcomingDueDays) {
      alerts.push({ code: "upcoming_due", severity: "info", ...base });
    }

    // Can today's balance pay this item after everything due strictly before it?
    const dueBefore = byDueDate
      .filter((p) => p.dueDate < item.dueDate)
      .reduce((sum, p) => sum + p.amount, 0n);
    const coverage = ctx.bankBalance - dueBefore;
    if (coverage < item.amount) {
      alerts.push({
        code: "uncovered_due",
        severity: "critical",
        ...base,
        shortfall: item.amount - coverage,
      });
    }
  }

  for (const dept of ctx.departments) {
    if (dept.status === "over") {
      alerts.push({
        code: "department_over",
        severity: "warning",
        departmentId: dept.id,
        amount: -dept.available,
      });
    } else if (dept.status === "high_usage") {
      // "Over" already implies high usage: only one of the two is shown.
      alerts.push({
        code: "high_usage",
        severity: "warning",
        departmentId: dept.id,
        usageBp: dept.usageBp!,
      });
    }
  }

  if (ctx.safeToSpend < 0n) {
    alerts.push({ code: "safe_to_spend_negative", severity: "critical", amount: -ctx.safeToSpend });
  }

  if (ctx.unclassifiedCount > 0) {
    alerts.push({
      code: "unclassified_expenses",
      severity: "info",
      amount: ctx.unclassifiedExpenses,
      count: ctx.unclassifiedCount,
    });
  }

  // Stable sort: severity, then due date (undated last), then code.
  return alerts.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      compare(a.dueDate ?? NO_DATE, b.dueDate ?? NO_DATE) ||
      compare(a.code, b.code),
  );
}
