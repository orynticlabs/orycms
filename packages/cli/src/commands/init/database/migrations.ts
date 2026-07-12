import { createHash } from "node:crypto";
import type {
  DatabaseWizardResult,
  FirebaseWizardResult,
  MariadbWizardResult,
  MongodbWizardResult,
  MysqlWizardResult,
  PostgresqlWizardResult,
  SqliteWizardResult,
  SupabaseWizardResult,
} from "./wizard";

// ── Public types ───────────────────────────────────────────────────────────────

export interface Migration {
  id: string;
  name: string;
  up: string;
  down?: string;
}

export interface AppliedMigration {
  id: string;
  name: string;
  appliedAt: string;
  executionTimeMs: number;
  checksum: string;
}

export interface MigrationStatusEntry {
  id: string;
  name: string;
  state: "pending" | "applied";
  appliedAt?: string;
}

export interface MigrateResult {
  applied: AppliedMigration[];
  skipped: number;
  failed?: { id: string; name: string; error: string };
}

export interface RollbackResult {
  id: string;
  name: string;
}

export interface MigrationStatusResult {
  total: number;
  applied: number;
  pending: number;
  entries: MigrationStatusEntry[];
}

// ── MigrationAdapter interface ─────────────────────────────────────────────────

/**
 * All provider-specific database interactions go through this interface.
 * Tests inject a mock; production code uses createAdapter().
 */
export interface MigrationAdapter {
  /** Create the migrations tracking table/collection if absent. */
  ensureTable(): Promise<void>;
  /** Return all applied migration records, oldest-first. */
  getApplied(): Promise<AppliedMigration[]>;
  /** Persist a successful migration. */
  recordApplied(
    id: string,
    name: string,
    executionTimeMs: number,
    checksum: string,
  ): Promise<void>;
  /** Remove a migration record (used during rollback). */
  removeRecord(id: string): Promise<void>;
  /** Execute the migration payload (SQL for relational DBs, JSON command for Mongo, etc.). */
  execute(payload: string): Promise<void>;
  /** Whether this provider wraps DDL in a real transaction. */
  readonly supportsTransactions: boolean;
  /**
   * Run `ops` atomically when supportsTransactions is true.
   * Falls back to sequential execution otherwise.
   */
  executeTransaction(ops: Array<() => Promise<void>>): Promise<void>;
  /** Release the underlying connection. */
  close(): Promise<void>;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function checksumOf(payload: string): string {
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

function assertNoDuplicates(migrations: Migration[]): void {
  const seen = new Set<string>();
  for (const m of migrations) {
    if (seen.has(m.id)) throw new Error(`Duplicate migration ID: "${m.id}"`);
    seen.add(m.id);
  }
}

// ── Provider-specific adapter factories (private) ─────────────────────────────

// ── pg-family: PostgreSQL, Neon (connectionString already built by caller) ──

async function createPgAdapter(connectionString: string): Promise<MigrationAdapter> {
  const { Client } = await import("pg");
  const client = new Client({ connectionString });
  await client.connect();

  return {
    async ensureTable() {
      await client.query(`
        CREATE TABLE IF NOT EXISTS orycms_migrations (
          id                TEXT        PRIMARY KEY,
          name              TEXT        NOT NULL,
          applied_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
          execution_time_ms INT         NOT NULL,
          checksum          TEXT        NOT NULL
        )
      `);
    },

    async getApplied() {
      const { rows } = await client.query<{
        id: string;
        name: string;
        applied_at: string;
        execution_time_ms: string;
        checksum: string;
      }>(
        "SELECT id, name, applied_at, execution_time_ms, checksum" +
          " FROM orycms_migrations ORDER BY applied_at ASC",
      );
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        appliedAt: r.applied_at,
        executionTimeMs: Number(r.execution_time_ms),
        checksum: r.checksum,
      }));
    },

    async recordApplied(id, name, ms, cs) {
      await client.query(
        "INSERT INTO orycms_migrations (id, name, execution_time_ms, checksum)" +
          " VALUES ($1, $2, $3, $4)",
        [id, name, ms, cs],
      );
    },

    async removeRecord(id) {
      await client.query("DELETE FROM orycms_migrations WHERE id = $1", [id]);
    },

    async execute(sql) {
      await client.query(sql);
    },

    supportsTransactions: true,

    async executeTransaction(ops) {
      await client.query("BEGIN");
      try {
        for (const op of ops) await op();
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    },

    async close() {
      await client.end();
    },
  };
}

function pgConnectionString(c: PostgresqlWizardResult): string {
  const ssl = c.ssl ? "?sslmode=require" : "";
  return `postgresql://${encodeURIComponent(c.user)}:${encodeURIComponent(c.password)}@${c.host}:${c.port}/${c.database}${ssl}`;
}

// Supabase exposes a direct Postgres endpoint at db.PROJECT.supabase.co:5432
function supabaseConnectionString(c: SupabaseWizardResult): string {
  const projectRef = new URL(c.url).hostname.replace(/\.supabase\.co$/, "");
  return `postgresql://postgres:${encodeURIComponent(c.serviceKey)}@db.${projectRef}.supabase.co:5432/postgres`;
}

// ── mysql-family: MySQL, MariaDB ──────────────────────────────────────────────

async function createMysqlAdapter(
  c: MysqlWizardResult | MariadbWizardResult,
): Promise<MigrationAdapter> {
  const { createConnection } = await import("mysql2/promise");
  const conn = await createConnection({
    host: c.host,
    port: c.port,
    user: c.user,
    password: c.password,
    database: c.database,
    multipleStatements: true,
  });

  return {
    async ensureTable() {
      await conn.execute(
        [
          "CREATE TABLE IF NOT EXISTS orycms_migrations (",
          "  id                VARCHAR(255) PRIMARY KEY,",
          "  name              VARCHAR(255) NOT NULL,",
          "  applied_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,",
          "  execution_time_ms INT          NOT NULL,",
          "  checksum          VARCHAR(64)  NOT NULL",
          ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        ].join("\n"),
      );
    },

    async getApplied() {
      const result = (await conn.execute(
        "SELECT id, name, applied_at, execution_time_ms, checksum" +
          " FROM orycms_migrations ORDER BY applied_at ASC",
      )) as [unknown[], unknown[]];
      const rows = result[0] as Array<{
        id: string;
        name: string;
        applied_at: Date | string;
        execution_time_ms: number;
        checksum: string;
      }>;
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        appliedAt: r.applied_at instanceof Date ? r.applied_at.toISOString() : String(r.applied_at),
        executionTimeMs: Number(r.execution_time_ms),
        checksum: r.checksum,
      }));
    },

    async recordApplied(id, name, ms, cs) {
      await conn.execute(
        "INSERT INTO orycms_migrations (id, name, execution_time_ms, checksum) VALUES (?, ?, ?, ?)",
        [id, name, ms, cs],
      );
    },

    async removeRecord(id) {
      await conn.execute("DELETE FROM orycms_migrations WHERE id = ?", [id]);
    },

    async execute(sql) {
      await conn.execute(sql);
    },

    // MySQL DDL auto-commits, so wrapping in a transaction won't protect against
    // partial DDL. Sequential execution is the honest choice here.
    supportsTransactions: false,

    async executeTransaction(ops) {
      for (const op of ops) await op();
    },

    async close() {
      await conn.end();
    },
  };
}

// ── SQLite ────────────────────────────────────────────────────────────────────

async function createSqliteAdapter(filePath: string): Promise<MigrationAdapter> {
  const { default: Database } = await import("better-sqlite3");
  const db = new Database(filePath);

  return {
    async ensureTable() {
      db.exec(
        [
          "CREATE TABLE IF NOT EXISTS orycms_migrations (",
          "  id                TEXT    PRIMARY KEY,",
          "  name              TEXT    NOT NULL,",
          "  applied_at        TEXT    NOT NULL DEFAULT (datetime('now')),",
          "  execution_time_ms INTEGER NOT NULL,",
          "  checksum          TEXT    NOT NULL",
          ")",
        ].join("\n"),
      );
    },

    async getApplied() {
      const rows = db
        .prepare(
          "SELECT id, name, applied_at, execution_time_ms, checksum" +
            " FROM orycms_migrations ORDER BY applied_at ASC",
        )
        .all() as Array<{
        id: string;
        name: string;
        applied_at: string;
        execution_time_ms: number;
        checksum: string;
      }>;
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        appliedAt: r.applied_at,
        executionTimeMs: r.execution_time_ms,
        checksum: r.checksum,
      }));
    },

    async recordApplied(id, name, ms, cs) {
      db.prepare(
        "INSERT INTO orycms_migrations (id, name, execution_time_ms, checksum) VALUES (?, ?, ?, ?)",
      ).run(id, name, ms, cs);
    },

    async removeRecord(id) {
      db.prepare("DELETE FROM orycms_migrations WHERE id = ?").run(id);
    },

    async execute(sql) {
      db.exec(sql);
    },

    // SQLite supports DDL inside transactions (full ACID).
    supportsTransactions: true,

    async executeTransaction(ops) {
      db.exec("BEGIN");
      try {
        for (const op of ops) await op();
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },

    async close() {
      db.close();
    },
  };
}

// ── MongoDB ───────────────────────────────────────────────────────────────────

async function createMongodbAdapter(uri: string): Promise<MigrationAdapter> {
  const { default: mongoose } = await import("mongoose");
  const conn = await mongoose.createConnection(uri).asPromise();
  // Access the raw MongoDB driver via conn.db (Mongoose exposes this)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const col = (conn.db as any).collection("orycms_migrations");

  return {
    async ensureTable() {
      // MongoDB creates collections on first write — nothing to do
    },

    async getApplied() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const docs = (await col.find({}).sort({ appliedAt: 1 }).toArray()) as any[];
      return docs.map((d: AppliedMigration) => ({
        id: d.id,
        name: d.name,
        appliedAt: d.appliedAt,
        executionTimeMs: d.executionTimeMs,
        checksum: d.checksum,
      }));
    },

    async recordApplied(id, name, ms, cs) {
      await col.insertOne({
        id,
        name,
        appliedAt: new Date().toISOString(),
        executionTimeMs: ms,
        checksum: cs,
      });
    },

    async removeRecord(id) {
      await col.deleteOne({ id });
    },

    async execute(payload) {
      // MongoDB migration payloads are JSON-encoded db.command() arguments
      let cmd: Record<string, unknown>;
      try {
        cmd = JSON.parse(payload) as Record<string, unknown>;
      } catch {
        throw new Error(
          `MongoDB migration payload must be a JSON-encoded db.command() object. Got: ${payload}`,
        );
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (conn.db as any).command(cmd);
    },

    // Multi-document transactions require a replica set, which is not guaranteed
    // in all MongoDB deployments.
    supportsTransactions: false,

    async executeTransaction(ops) {
      for (const op of ops) await op();
    },

    async close() {
      await conn.close();
    },
  };
}

// ── Firebase ──────────────────────────────────────────────────────────────────

let _firebaseSeq = 0;

async function createFirebaseAdapter(c: FirebaseWizardResult): Promise<MigrationAdapter> {
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
    `orycms-migrations-${++_firebaseSeq}`,
  );
  const db = getFirestore(app);
  const col = db.collection("orycms_migrations");

  return {
    async ensureTable() {
      // Firestore collections are created on first write — nothing to do
    },

    async getApplied() {
      const snapshot = await col.orderBy("appliedAt", "asc").get();
      return snapshot.docs.map((d) => d.data() as AppliedMigration);
    },

    async recordApplied(id, name, ms, cs) {
      await col.doc(id).set({
        id,
        name,
        appliedAt: new Date().toISOString(),
        executionTimeMs: ms,
        checksum: cs,
      });
    },

    async removeRecord(id) {
      await col.doc(id).delete();
    },

    async execute(_payload) {
      // Firebase/Firestore is schemaless — the migration payload is documentation only.
      // The migration is tracked for state management; no DDL is executed.
    },

    supportsTransactions: false,

    async executeTransaction(ops) {
      for (const op of ops) await op();
    },

    async close() {
      await deleteApp(app);
    },
  };
}

// ── Adapter factory (exported for advanced use; tests should inject via options) ──

export async function createAdapter(config: DatabaseWizardResult): Promise<MigrationAdapter> {
  switch (config.provider) {
    case "postgresql":
      return createPgAdapter(pgConnectionString(config));
    case "neon":
      return createPgAdapter(config.databaseUrl);
    case "supabase":
      return createPgAdapter(supabaseConnectionString(config));
    case "mysql":
    case "mariadb":
      return createMysqlAdapter(config);
    case "sqlite":
      return createSqliteAdapter(config.filePath);
    case "mongodb":
      return createMongodbAdapter(config.uri);
    case "firebase":
      return createFirebaseAdapter(config);
  }
}

// ── run helper ─────────────────────────────────────────────────────────────────

async function runWithAdapter<T>(
  config: DatabaseWizardResult,
  options: { adapter?: MigrationAdapter } | undefined,
  fn: (adapter: MigrationAdapter) => Promise<T>,
): Promise<T> {
  const ownAdapter = options?.adapter === undefined;
  const adapter = options?.adapter ?? (await createAdapter(config));
  try {
    return await fn(adapter);
  } finally {
    if (ownAdapter) await adapter.close();
  }
}

async function applyOne(
  adapter: MigrationAdapter,
  migration: Migration,
  start: number,
): Promise<AppliedMigration> {
  const cs = checksumOf(migration.up);
  if (adapter.supportsTransactions) {
    await adapter.executeTransaction([
      () => adapter.execute(migration.up),
      () => adapter.recordApplied(migration.id, migration.name, Date.now() - start, cs),
    ]);
  } else {
    await adapter.execute(migration.up);
    await adapter.recordApplied(migration.id, migration.name, Date.now() - start, cs);
  }
  return {
    id: migration.id,
    name: migration.name,
    appliedAt: new Date().toISOString(),
    executionTimeMs: Date.now() - start,
    checksum: cs,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Create a migration definition (pure, no I/O). */
export function createMigration(id: string, name: string, up: string, down?: string): Migration {
  return { id, name, up, ...(down !== undefined ? { down } : {}) };
}

/**
 * Apply all pending migrations in the provided order.
 * Stops on the first failure and reports which migration failed.
 * Skips any migration whose ID already appears in the history table.
 */
export async function migrateDatabase(
  migrations: Migration[],
  config: DatabaseWizardResult,
  options?: { adapter?: MigrationAdapter },
): Promise<MigrateResult> {
  assertNoDuplicates(migrations);
  return runWithAdapter(config, options, async (adapter) => {
    await adapter.ensureTable();
    const applied = await adapter.getApplied();
    const appliedIds = new Set(applied.map((a) => a.id));

    const pending = migrations.filter((m) => !appliedIds.has(m.id));
    const result: MigrateResult = { applied: [], skipped: appliedIds.size };

    for (const migration of pending) {
      const start = Date.now();
      try {
        result.applied.push(await applyOne(adapter, migration, start));
      } catch (err) {
        result.failed = {
          id: migration.id,
          name: migration.name,
          error: err instanceof Error ? err.message : String(err),
        };
        break;
      }
    }

    return result;
  });
}

/**
 * Roll back a single migration.
 * Without `targetId`, rolls back the most recently applied migration.
 * Requires the migration definition to have a `down` payload.
 */
export async function rollbackMigration(
  migrations: Migration[],
  config: DatabaseWizardResult,
  options?: { targetId?: string; adapter?: MigrationAdapter },
): Promise<RollbackResult> {
  assertNoDuplicates(migrations);
  return runWithAdapter(config, options, async (adapter) => {
    await adapter.ensureTable();
    const applied = await adapter.getApplied();

    if (applied.length === 0) throw new Error("No applied migrations to roll back");

    const target = options?.targetId
      ? (() => {
          const r = applied.find((a) => a.id === options.targetId);
          if (!r) throw new Error(`Migration "${options.targetId}" has not been applied`);
          return r;
        })()
      : applied[applied.length - 1];

    const def = migrations.find((m) => m.id === target.id);
    if (!def) throw new Error(`Migration definition for "${target.id}" not found`);
    if (!def.down)
      throw new Error(`Migration "${target.id}" has no rollback (down) definition`);

    if (adapter.supportsTransactions) {
      await adapter.executeTransaction([
        () => adapter.execute(def.down!),
        () => adapter.removeRecord(target.id),
      ]);
    } else {
      await adapter.execute(def.down);
      await adapter.removeRecord(target.id);
    }

    return { id: target.id, name: target.name };
  });
}

/**
 * Return the current status of every migration in the list.
 */
export async function migrationStatus(
  migrations: Migration[],
  config: DatabaseWizardResult,
  options?: { adapter?: MigrationAdapter },
): Promise<MigrationStatusResult> {
  assertNoDuplicates(migrations);
  return runWithAdapter(config, options, async (adapter) => {
    await adapter.ensureTable();
    const applied = await adapter.getApplied();
    const byId = new Map(applied.map((a) => [a.id, a]));

    const entries: MigrationStatusEntry[] = migrations.map((m) => {
      const rec = byId.get(m.id);
      return rec
        ? { id: m.id, name: m.name, state: "applied" as const, appliedAt: rec.appliedAt }
        : { id: m.id, name: m.name, state: "pending" as const };
    });

    const appliedCount = entries.filter((e) => e.state === "applied").length;
    return {
      total: entries.length,
      applied: appliedCount,
      pending: entries.length - appliedCount,
      entries,
    };
  });
}
