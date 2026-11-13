import "server-only";
import { auditLog } from "@/db/schema";
import type { Tx } from "./db-types";

export type AuditAction = "create" | "update" | "delete";

export interface AuditEntry {
  organizationId: string;
  userId: string | null;
  action: AuditAction;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}

/** JSON-safe copy: bigint → string, Date → ISO string. */
export function toAuditJson(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  return JSON.parse(
    JSON.stringify(value, (_key, v: unknown) => (typeof v === "bigint" ? v.toString() : v)),
  );
}

/** Must be called inside the same transaction as the change it records. */
export async function writeAudit(tx: Tx, entry: AuditEntry): Promise<void> {
  await tx.insert(auditLog).values({
    organizationId: entry.organizationId,
    userId: entry.userId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    before: toAuditJson(entry.before),
    after: toAuditJson(entry.after),
  });
}
