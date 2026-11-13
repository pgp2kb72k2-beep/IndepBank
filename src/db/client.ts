import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pool?: Pool };

// Reuse the pool across hot reloads in development.
const pool = globalForDb.pool ?? new Pool({ connectionString: env().DATABASE_URL, max: 10 });
if (env().NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
