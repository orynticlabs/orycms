import { Pool } from "pg";

// ponytail: global singleton survives HMR in Next.js dev; one Pool per process
const g = globalThis as { _oryPool?: Pool };

export function getOryCMSPool(): Pool {
  if (!g._oryPool) {
    g._oryPool = new Pool({
      connectionString: process.env.ORYCMS_DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? true : undefined,
      max: 10,
    });
  }
  return g._oryPool;
}
