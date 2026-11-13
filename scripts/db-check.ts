import { Pool } from "pg";
import { parseEnv } from "../src/env";

async function main() {
  const { DATABASE_URL } = parseEnv(process.env);
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    const { rows } = await pool.query<{ version: string }>("select version()");
    console.log(`Database OK: ${rows[0]?.version.split(",")[0]}`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Database check failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
