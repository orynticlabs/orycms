import { DATABASE_PROVIDERS } from "./index";
import type {
  DatabaseWizardResult,
  FirebaseWizardResult,
  MariadbWizardResult,
  MongodbWizardResult,
  MysqlWizardResult,
  NeonWizardResult,
  PostgresqlWizardResult,
  SqliteWizardResult,
  SupabaseWizardResult,
} from "./wizard";

// ── Public types ──────────────────────────────────────────────────────────────

export type ConnectionTestResult =
  | { ok: true; message: string; latencyMs: number }
  | { ok: false; error: string; code?: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(Object.assign(new Error("Connection timed out"), { code: "ETIMEDOUT" })),
        ms,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

// ── Per-provider connectors (lazy dynamic imports — no I/O at module load) ────

async function connectPostgresql(c: PostgresqlWizardResult): Promise<void> {
  const { Client } = await import("pg");
  const client = new Client({
    host: c.host,
    port: c.port,
    user: c.user,
    password: c.password,
    database: c.database,
    ssl: c.ssl,
  });
  await client.connect();
  await client.query("SELECT 1");
  await client.end();
}

async function connectMysql(c: MysqlWizardResult | MariadbWizardResult): Promise<void> {
  const { createConnection } = await import("mysql2/promise");
  const conn = await createConnection({
    host: c.host,
    port: c.port,
    user: c.user,
    password: c.password,
    database: c.database,
  });
  await conn.execute("SELECT 1");
  await conn.end();
}

async function connectSqlite(c: SqliteWizardResult): Promise<void> {
  const { default: Database } = await import("better-sqlite3");
  // better-sqlite3 is synchronous; throws on open failure
  const db = new Database(c.filePath);
  db.prepare("SELECT 1").get();
  db.close();
}

async function connectMongodb(c: MongodbWizardResult): Promise<void> {
  const { default: mongoose } = await import("mongoose");
  const conn = await mongoose.createConnection(c.uri).asPromise();
  await conn.close();
}

async function connectSupabase(c: SupabaseWizardResult, timeoutMs: number): Promise<void> {
  const res = await fetch(`${c.url}/rest/v1/`, {
    headers: {
      apikey: c.serviceKey,
      Authorization: `Bearer ${c.serviceKey}`,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw Object.assign(new Error(`Supabase responded with HTTP ${res.status}`), {
      code: `HTTP_${res.status}`,
    });
  }
}

// ponytail: Neon is Postgres under the hood; @neondatabase/serverless exposes a
// pg-compatible Client so the same pattern works.
async function connectNeon(c: NeonWizardResult): Promise<void> {
  const { Client } = await import("@neondatabase/serverless");
  const client = new Client({ connectionString: c.databaseUrl });
  await client.connect();
  await client.query("SELECT 1");
  await client.end();
}

// counter avoids multiple-app errors if connectFirebase is called more than once
let _appSeq = 0;

async function connectFirebase(c: FirebaseWizardResult): Promise<void> {
  const { initializeApp, cert, deleteApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const app = initializeApp(
    {
      credential: cert({
        projectId: c.projectId,
        privateKey: c.privateKey,
        clientEmail: c.clientEmail,
      }),
    },
    `orycms-conn-${++_appSeq}`,
  );
  try {
    await getFirestore(app).listCollections();
  } finally {
    await deleteApp(app);
  }
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

async function connect(config: DatabaseWizardResult, timeoutMs: number): Promise<void> {
  switch (config.provider) {
    case "postgresql":
      return connectPostgresql(config);
    case "mysql":
    case "mariadb":
      return connectMysql(config);
    case "sqlite":
      return connectSqlite(config);
    case "mongodb":
      return connectMongodb(config);
    case "supabase":
      return connectSupabase(config, timeoutMs);
    case "neon":
      return connectNeon(config);
    case "firebase":
      return connectFirebase(config);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Attempt a minimal read-only connection to the database described by `config`.
 * SELECT 1 / ping / health-check only — no tables created, no data modified.
 *
 * Never throws; always returns a typed success/failure object.
 */
export async function testDatabaseConnection(
  config: DatabaseWizardResult,
  options?: { timeoutMs?: number },
): Promise<ConnectionTestResult> {
  const timeoutMs = options?.timeoutMs ?? 5_000;
  const start = Date.now();

  try {
    await withTimeout(connect(config, timeoutMs), timeoutMs);
    return {
      ok: true,
      message: `Connected to ${DATABASE_PROVIDERS[config.provider].name} successfully`,
      latencyMs: Date.now() - start,
    };
  } catch (error: unknown) {
    const code = (error as { code?: string }).code;

    if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") {
      const pkgs = DATABASE_PROVIDERS[config.provider].requiredPackages().join(" ");
      return {
        ok: false,
        error: `Driver not installed. Run: npm install ${pkgs}`,
        code: "PKG_NOT_FOUND",
      };
    }

    return { ok: false, error: getDatabaseConnectionError(error), code };
  }
}

/**
 * Translate a raw connection error into a human-readable message.
 * Safe to call with any thrown value, including non-Error objects.
 */
export function getDatabaseConnectionError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);

  const e = error as Error & { code?: string; sqlState?: string };

  switch (e.code) {
    case "ECONNREFUSED":
      return "Connection refused — is the database server running?";
    case "ETIMEDOUT":
    case "CONNECT_TIMEOUT":
      return "Connection timed out — check the host and port, or a firewall may be blocking";
    case "ENOTFOUND":
      return "Host not found — check the hostname or DNS configuration";
    case "ENOENT":
      return "File not found — check the database file path";
    case "EACCES":
    case "EPERM":
      return "Permission denied — check file or directory permissions";
    // MySQL / MariaDB driver codes
    case "ER_ACCESS_DENIED_ERROR":
      return "Access denied — check the username and password";
    case "ER_BAD_DB_ERROR":
      return "Database does not exist — check the database name";
    // PostgreSQL SQLSTATE codes (pg surfaces them as `code`)
    case "28P01":
      return "Password authentication failed — check the password";
    case "3D000":
      return "Database does not exist — check the database name";
    case "PKG_NOT_FOUND":
    case "UNSUPPORTED":
      return error.message;
  }

  if (e.sqlState === "28000" || e.sqlState === "28P01") {
    return "Authentication failed — check the username and password";
  }

  if (error.name === "MongoServerSelectionError") {
    return `MongoDB server selection failed — ${error.message}`;
  }

  return error.message;
}
