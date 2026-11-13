import type { AllocationVersion, Cents, DepartmentInput, IsoDate, PercentBp } from "./types";

export const FULL_BP = 10_000;

export type AllocationIssue =
  "empty" | "non_integer_percent" | "negative_percent" | "unknown_department" | "sum_not_100";

/** Returns every problem found; an empty array means the configuration can be saved. */
export function validateAllocation(
  percentBp: PercentBp,
  departmentIds: readonly string[],
): AllocationIssue[] {
  const entries = Object.entries(percentBp);
  if (entries.length === 0) return ["empty"];

  const issues = new Set<AllocationIssue>();
  const known = new Set(departmentIds);
  let sum = 0;
  for (const [id, bp] of entries) {
    if (!Number.isInteger(bp)) issues.add("non_integer_percent");
    if (bp < 0) issues.add("negative_percent");
    if (!known.has(id)) issues.add("unknown_department");
    sum += bp;
  }
  if (sum !== FULL_BP) issues.add("sum_not_100");
  return [...issues];
}

/**
 * Splits `amount` between departments by percentage, working in whole cents.
 * Each share is floored; the rounding remainder goes to the department with the
 * highest percentage (ties: lowest sortOrder), so shares always add up to `amount`.
 * Negative amounts are split symmetrically.
 */
export function allocateAmount(
  amount: Cents,
  percentBp: PercentBp,
  departments: readonly DepartmentInput[],
): Map<string, Cents> {
  const issues = validateAllocation(
    percentBp,
    departments.map((d) => d.id),
  );
  if (issues.length > 0) throw new Error(`Invalid allocation: ${issues.join(", ")}`);

  const sign = amount < 0n ? -1n : 1n;
  const abs = amount * sign;
  const ordered = [...departments].sort((a, b) => a.sortOrder - b.sortOrder);

  const shares = new Map<string, Cents>();
  let distributed = 0n;
  let recipient = "";
  let recipientBp = -1;
  for (const dept of ordered) {
    const bp = percentBp[dept.id] ?? 0;
    const share = (abs * BigInt(bp)) / BigInt(FULL_BP);
    shares.set(dept.id, share);
    distributed += share;
    // Strictly greater keeps the first (lowest sortOrder) on ties.
    if (bp > recipientBp) {
      recipient = dept.id;
      recipientBp = bp;
    }
  }
  shares.set(recipient, shares.get(recipient)! + (abs - distributed));

  for (const [id, share] of shares) shares.set(id, share * sign);
  return shares;
}

/**
 * Allocation version in force on `date`: among versions with effectiveFrom <= date,
 * the last one in creation order. "Recalculate current period" is therefore just a
 * new version whose effectiveFrom is the first day of the month.
 */
export function versionFor(
  date: IsoDate,
  versions: readonly AllocationVersion[],
): AllocationVersion {
  const applicable = versions.filter((v) => v.effectiveFrom <= date);
  const version = applicable[applicable.length - 1];
  if (!version) throw new Error(`No allocation configuration in force on ${date}`);
  return version;
}
