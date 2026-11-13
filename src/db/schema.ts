/**
 * Database schema (Drizzle).
 *
 * Conventions:
 * - Money is `bigint` in minor units (cents) together with a currency code.
 * - Calendar dates (transaction date, due date) use `date` as `YYYY-MM-DD` strings,
 *   interpreted in America/Montevideo. Instants use `timestamptz`.
 * - Every business table carries `organization_id`. References between business tables
 *   are composite foreign keys (organization_id, x_id), so the database itself refuses
 *   to link rows of different organizations.
 * - Calculated values (assigned, available, Safe-to-Spend) are never stored.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

// --- Enums -------------------------------------------------------------------------

export const currency = pgEnum("currency", ["UYU", "USD"]);
export const plan = pgEnum("plan", ["basic"]);
export const role = pgEnum("role", ["owner", "admin", "viewer"]);
export const fileRetention = pgEnum("file_retention", ["discard", "encrypted_30d"]);
export const amountMode = pgEnum("amount_mode", ["single", "debit_credit"]);
export const transactionType = pgEnum("transaction_type", ["income", "expense", "transfer"]);
export const classifiedBy = pgEnum("classified_by", ["rule", "manual"]);
export const outflowKind = pgEnum("outflow_kind", ["obligation", "commitment"]);
export const outflowCategory = pgEnum("outflow_category", [
  "salaries",
  "taxes",
  "suppliers",
  "debt",
  "rent",
  "other",
]);
export const outflowStatus = pgEnum("outflow_status", ["pending", "paid", "cancelled"]);
export const recurrence = pgEnum("recurrence", ["none", "monthly"]);
export const auditAction = pgEnum("audit_action", ["create", "update", "delete"]);

// --- Helpers -----------------------------------------------------------------------

const id = () =>
  uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`);
const cents = (name: string) => bigint(name, { mode: "bigint" });
const isoDate = (name: string) => date(name, { mode: "string" });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// --- Organizations and members ----------------------------------------------------

export const organization = pgTable("organization", {
  id: id(),
  name: text("name").notNull(),
  baseCurrency: currency("base_currency").notNull(),
  plan: plan("plan").notNull().default("basic"),
  openingIncomeEnabled: boolean("opening_income_enabled").notNull().default(true),
  horizonDays: integer("horizon_days").notNull().default(30),
  upcomingDueDays: integer("upcoming_due_days").notNull().default(7),
  highUsageThresholdBp: integer("high_usage_threshold_bp").notNull().default(9000),
  importFileRetention: fileRetention("import_file_retention").notNull().default("discard"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const membership = pgTable(
  "membership",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: role("role").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("membership_org_user_uq").on(t.organizationId, t.userId),
    index("membership_user_idx").on(t.userId),
  ],
);

// --- Departments and allocation -------------------------------------------------------

export const department = pgTable(
  "department",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    icon: text("icon").notNull(),
    minimumReserve: cents("minimum_reserve")
      .notNull()
      .default(sql`0`),
    currency: currency("currency").notNull(),
    sortOrder: integer("sort_order").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique("department_org_id_uq").on(t.organizationId, t.id)],
);

export const allocationConfigVersion = pgTable(
  "allocation_config_version",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    effectiveFrom: isoDate("effective_from").notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    unique("allocation_version_org_id_uq").on(t.organizationId, t.id),
    index("allocation_version_org_idx").on(t.organizationId, t.createdAt),
  ],
);

export const allocationConfigItem = pgTable(
  "allocation_config_item",
  {
    organizationId: uuid("organization_id").notNull(),
    versionId: uuid("version_id").notNull(),
    departmentId: uuid("department_id").notNull(),
    percentBp: integer("percent_bp").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.versionId, t.departmentId] }),
    foreignKey({
      name: "allocation_item_version_fk",
      columns: [t.organizationId, t.versionId],
      foreignColumns: [allocationConfigVersion.organizationId, allocationConfigVersion.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "allocation_item_department_fk",
      columns: [t.organizationId, t.departmentId],
      foreignColumns: [department.organizationId, department.id],
    }),
  ],
);

// --- Bank accounts and imports ----------------------------------------------------------

export const bankAccount = pgTable(
  "bank_account",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    bankName: text("bank_name").notNull(),
    currency: currency("currency").notNull(),
    openingBalance: cents("opening_balance")
      .notNull()
      .default(sql`0`),
    openingBalanceDate: isoDate("opening_balance_date").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique("bank_account_org_id_uq").on(t.organizationId, t.id)],
);

export const importTemplate = pgTable("import_template", {
  id: id(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  bankName: text("bank_name").notNull(),
  columnMapping: jsonb("column_mapping").notNull(),
  dateFormat: text("date_format").notNull(),
  amountMode: amountMode("amount_mode").notNull(),
  headerRow: integer("header_row").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const importBatch = pgTable(
  "import_batch",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    bankAccountId: uuid("bank_account_id").notNull(),
    fileName: text("file_name").notNull(),
    rowCount: integer("row_count").notNull(),
    importedCount: integer("imported_count").notNull(),
    duplicateCount: integer("duplicate_count").notNull(),
    errorCount: integer("error_count").notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    unique("import_batch_org_id_uq").on(t.organizationId, t.id),
    foreignKey({
      name: "import_batch_bank_account_fk",
      columns: [t.organizationId, t.bankAccountId],
      foreignColumns: [bankAccount.organizationId, bankAccount.id],
    }),
  ],
);

// --- Planned outflows (obligations and commitments) --------------------------------------

export const plannedOutflow = pgTable(
  "planned_outflow",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    kind: outflowKind("kind").notNull(),
    category: outflowCategory("category").notNull(),
    description: text("description").notNull(),
    amount: cents("amount").notNull(),
    currency: currency("currency").notNull(),
    dueDate: isoDate("due_date").notNull(),
    departmentId: uuid("department_id").notNull(),
    status: outflowStatus("status").notNull().default("pending"),
    recurrence: recurrence("recurrence").notNull().default("none"),
    recurrenceParentId: uuid("recurrence_parent_id"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("planned_outflow_org_id_uq").on(t.organizationId, t.id),
    index("planned_outflow_org_status_due_idx").on(t.organizationId, t.status, t.dueDate),
    foreignKey({
      name: "planned_outflow_department_fk",
      columns: [t.organizationId, t.departmentId],
      foreignColumns: [department.organizationId, department.id],
    }),
    foreignKey({
      name: "planned_outflow_parent_fk",
      columns: [t.organizationId, t.recurrenceParentId],
      foreignColumns: [t.organizationId, t.id],
    }),
  ],
);

// --- Transactions ---------------------------------------------------------------------------

export const bankTransaction = pgTable(
  "bank_transaction",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    bankAccountId: uuid("bank_account_id").notNull(),
    importBatchId: uuid("import_batch_id"),
    date: isoDate("date").notNull(),
    description: text("description").notNull(),
    descriptionNormalized: text("description_normalized").notNull(),
    amount: cents("amount").notNull(),
    currency: currency("currency").notNull(),
    type: transactionType("type").notNull(),
    distributable: boolean("distributable").notNull().default(true),
    departmentId: uuid("department_id"),
    classifiedBy: classifiedBy("classified_by"),
    linkedPlannedOutflowId: uuid("linked_planned_outflow_id").unique(),
    balanceAfter: cents("balance_after"),
    dedupeHash: text("dedupe_hash").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("transaction_org_dedupe_uq").on(t.organizationId, t.dedupeHash),
    index("transaction_org_date_idx").on(t.organizationId, t.date),
    foreignKey({
      name: "transaction_bank_account_fk",
      columns: [t.organizationId, t.bankAccountId],
      foreignColumns: [bankAccount.organizationId, bankAccount.id],
    }),
    foreignKey({
      name: "transaction_import_batch_fk",
      columns: [t.organizationId, t.importBatchId],
      foreignColumns: [importBatch.organizationId, importBatch.id],
    }),
    foreignKey({
      name: "transaction_department_fk",
      columns: [t.organizationId, t.departmentId],
      foreignColumns: [department.organizationId, department.id],
    }),
    foreignKey({
      name: "transaction_planned_outflow_fk",
      columns: [t.organizationId, t.linkedPlannedOutflowId],
      foreignColumns: [plannedOutflow.organizationId, plannedOutflow.id],
    }),
  ],
);

// --- Classification rules -------------------------------------------------------------------

export const classificationRule = pgTable(
  "classification_rule",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    matchText: text("match_text").notNull(),
    departmentId: uuid("department_id").notNull(),
    priority: integer("priority").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      name: "classification_rule_department_fk",
      columns: [t.organizationId, t.departmentId],
      foreignColumns: [department.organizationId, department.id],
    }).onDelete("cascade"),
  ],
);

// --- Audit log ------------------------------------------------------------------------------

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id").references((): AnyPgColumn => user.id, { onDelete: "set null" }),
    action: auditAction("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_org_created_idx").on(t.organizationId, t.createdAt)],
);
