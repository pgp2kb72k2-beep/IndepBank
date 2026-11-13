import "server-only";
import { and, eq, type InferInsertModel, type InferSelectModel, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { writeAudit } from "./audit";
import type { Db, Tx } from "./db-types";
import { NotFoundError } from "./errors";
import { assertCan, type Role } from "./permissions";

/** Who is acting, and on which organization. Built only from a verified session. */
export interface OrgContext {
  userId: string;
  organizationId: string;
  role: Role;
}

/** Any business table: it has an `id` and belongs to an organization. */
export type OrgTable = PgTable & { id: PgColumn; organizationId: PgColumn };

type Row<T extends OrgTable> = InferSelectModel<T>;
type NewRow<T extends OrgTable> = Omit<T["$inferInsert"], "organizationId" | "id">;
/** Any subset of a row's fields (id and organizationId are always ignored). */
type Patch<T extends OrgTable> = Partial<Omit<Row<T>, "organizationId" | "id">>;

/**
 * The only way application code touches business tables.
 *
 * Every query is filtered by `ctx.organizationId`, every write checks the role and
 * is recorded in the audit log inside the same transaction. Rows of other
 * organizations behave exactly like rows that do not exist.
 */
export interface Scope {
  ctx: OrgContext;
  owns(table: OrgTable): SQL;
  findMany<T extends OrgTable>(table: T, where?: SQL): Promise<Row<T>[]>;
  findById<T extends OrgTable>(table: T, entity: string, id: string): Promise<Row<T>>;
  create<T extends OrgTable>(table: T, entity: string, values: NoInfer<NewRow<T>>): Promise<Row<T>>;
  update<T extends OrgTable>(
    table: T,
    entity: string,
    id: string,
    patch: Patch<T>,
  ): Promise<Row<T>>;
  remove<T extends OrgTable>(table: T, entity: string, id: string): Promise<void>;
  transaction<R>(fn: (scope: Scope) => Promise<R>): Promise<R>;
}

export function scoped(ctx: OrgContext, database: Db | Tx = db): Scope {
  const owns = (table: OrgTable): SQL => eq(table.organizationId, ctx.organizationId);
  const byId = (table: OrgTable, id: string): SQL => and(owns(table), eq(table.id, id))!;

  return {
    ctx,

    /** Filter for hand-written queries on business tables. */
    owns,

    async findMany<T extends OrgTable>(table: T, where?: SQL): Promise<Row<T>[]> {
      assertCan(ctx, "read");
      const rows = await database
        .select()
        .from(table as PgTable)
        .where(and(owns(table), where));
      return rows as Row<T>[];
    },

    async findById<T extends OrgTable>(table: T, entity: string, id: string): Promise<Row<T>> {
      assertCan(ctx, "read");
      const [row] = await database
        .select()
        .from(table as PgTable)
        .where(byId(table, id));
      if (!row) throw new NotFoundError(entity);
      return row as Row<T>;
    },

    async create<T extends OrgTable>(table: T, entity: string, values: NewRow<T>): Promise<Row<T>> {
      assertCan(ctx, "write");
      return database.transaction(async (tx) => {
        const [row] = (await tx
          .insert(table)
          // organizationId always comes from the context, never from the caller.
          .values({ ...values, organizationId: ctx.organizationId } as InferInsertModel<T>)
          .returning()) as Row<T>[];
        const created = row as Row<T> & { id: string };
        await writeAudit(tx, audit("create", entity, created.id, undefined, created));
        return created;
      });
    },

    async update<T extends OrgTable>(
      table: T,
      entity: string,
      id: string,
      patch: Patch<T>,
    ): Promise<Row<T>> {
      assertCan(ctx, "write");
      const safePatch = { ...patch } as Record<string, unknown>;
      delete safePatch.organizationId;
      delete safePatch.id;
      return database.transaction(async (tx) => {
        const [before] = await tx
          .select()
          .from(table as PgTable)
          .where(byId(table, id))
          .for("update");
        if (!before) throw new NotFoundError(entity);
        if (Object.keys(safePatch).length === 0) return before as Row<T>; // nothing to change
        const [after] = (await tx
          .update(table)
          .set(safePatch as Partial<InferInsertModel<T>>)
          .where(byId(table, id))
          .returning()) as Row<T>[];
        await writeAudit(tx, audit("update", entity, id, before, after));
        return after as Row<T>;
      });
    },

    async remove<T extends OrgTable>(table: T, entity: string, id: string): Promise<void> {
      assertCan(ctx, "write");
      await database.transaction(async (tx) => {
        const [before] = await tx
          .select()
          .from(table as PgTable)
          .where(byId(table, id))
          .for("update");
        if (!before) throw new NotFoundError(entity);
        await tx.delete(table).where(byId(table, id));
        await writeAudit(tx, audit("delete", entity, id, before, undefined));
      });
    },

    /** Runs several scoped operations atomically (one transaction, one audit trail). */
    async transaction<R>(fn: (scope: Scope) => Promise<R>): Promise<R> {
      return database.transaction((tx) => fn(scoped(ctx, tx)));
    },
  };

  function audit(
    action: "create" | "update" | "delete",
    entity: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ) {
    return {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action,
      entity,
      entityId,
      before,
      after,
    };
  }
}
