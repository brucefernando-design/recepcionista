import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres.doqxdedbjhtcmsjlxrdl:Escritorio1411@aws-0-us-east-1.pooler.supabase.com:6543/postgres";

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!global._pgPool) {
    global._pgPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return global._pgPool;
}

export async function query(text: string, params?: any[]) {
  const pool = getPool();
  return pool.query(text, params);
}
