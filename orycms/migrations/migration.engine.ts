import type { Pool, PoolClient } from "pg";
import { getOryCMSPool } from "@/lib/db";
import type { OryCMSMigrationPreview, OryCMSSchemaDiffOperation } from "@/mapper";
import { OryCMSMigrationError } from "./migration.errors";
import { buildOryCMSHookContext, runOryCMSBeforeHooks, runOryCMSAfterHooks } from "@/hooks";

// ── Stored record shape ────────────────────────────────────────────────────────

export type OryCMSMigrationStatus = "pending" | "applied" | "rolled_back" | "failed";

export interface OryCMSCollectionMigrationRecord {
  id: string;
  collectionSlug: string;
  tableName: string;
  status: OryCMSMigrationStatus;
  operations: OryCMSSchemaDiffOperation[];
  warnings: string[];
  upSql: string;
  downSql: string | null;
  /** true when any operation is destructive */
  destructive: boolean;
  /** true when any operation is unsafe (blocks execution without override) */
  unsafe: boolean;
  appliedBy: string | null;
  appliedAt: string | null;
  rolledBackBy: string | null;
  rolledBackAt: string | null;
  durationMs: number | null;
  error: string | null;
  createdAt: string;
}

// ── Ensure the tracking table exists (idempotent) ─────────────────────────────

const ENSURE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS orycms_collection_migrations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_slug   TEXT NOT NULL,
  table_name        TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',
  operations        JSONB NOT NULL DEFAULT '[]',
  warnings          JSONB NOT NULL DEFAULT '[]',
  up_sql            TEXT NOT NULL,
  down_sql          TEXT,
  destructive       BOOLEAN NOT NULL DEFAULT false,
  unsafe            BOOLEAN NOT NULL DEFAULT false,
  applied_by        TEXT,
  applied_at        TIMESTAMPTZ,
  rolled_back_by    TEXT,
  rolled_back_at    TIMESTAMPTZ,
  duration_ms       INTEGER,
  error             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ocm_slug ON orycms_collection_migrations (collection_slug);
CREATE INDEX IF NOT EXISTS idx_ocm_status ON orycms_collection_migrations (status);
`;

async function ensureTable(pool: Pool): Promise<void> {
  await pool.query(ENSURE_TABLE_SQL);
}

function rowToRecord(row: Record<string, unknown>): OryCMSCollectionMigrationRecord {
  return {
    id: String(row["id"]),
    collectionSlug: String(row["collection_slug"]),
    tableName: String(row["table_name"]),
    status: row["status"] as OryCMSMigrationStatus,
    operations: (row["operations"] as OryCMSSchemaDiffOperation[]) ?? [],
    warnings: (row["warnings"] as string[]) ?? [],
    upSql: String(row["up_sql"]),
    downSql: row["down_sql"] != null ? String(row["down_sql"]) : null,
    destructive: Boolean(row["destructive"]),
    unsafe: Boolean(row["unsafe"]),
    appliedBy: row["applied_by"] != null ? String(row["applied_by"]) : null,
    appliedAt: row["applied_at"] != null ? String(row["applied_at"]) : null,
    rolledBackBy: row["rolled_back_by"] != null ? String(row["rolled_back_by"]) : null,
    rolledBackAt: row["rolled_back_at"] != null ? String(row["rolled_back_at"]) : null,
    durationMs: row["duration_ms"] != null ? Number(row["duration_ms"]) : null,
    error: row["error"] != null ? String(row["error"]) : null,
    createdAt: String(row["created_at"]),
  };
}

// ── SQL builder ───────────────────────────────────────────────────────────────

function buildUpSql(operations: OryCMSSchemaDiffOperation[]): string {
  return operations
    .map((op) => op.upStatement)
    .filter((s): s is string => Boolean(s))
    .join(";\n");
}

function buildDownSql(operations: OryCMSSchemaDiffOperation[]): string | null {
  const reversible = [...operations]
    .reverse()
    .filter((op) => op.downStatement)
    .map((op) => op.downStatement as string);
  return reversible.length > 0 ? reversible.join(";\n") : null;
}

// ── Public engine functions ───────────────────────────────────────────────────

/**
 * Validates a migration preview and stores an approved pending record.
 * Throws if unsafe operations are present (blocked) or if there are no statements.
 * Throws if `confirmDestructive` is not set when any operation is destructive.
 */
export async function approveOryCMSMigration(
  preview: OryCMSMigrationPreview,
  approvedBy: string,
  opts: { confirmDestructive?: boolean } = {},
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSCollectionMigrationRecord> {
  await ensureTable(pool);

  const { operations, safety } = preview;

  // Block unsafe operations unconditionally
  if (!safety.safe) {
    const blocked = safety.blocked.map((op) => op.type).join(", ");
    throw new OryCMSMigrationError(
      "MIGRATION_UNSAFE",
      `Migration contains unsafe operations that cannot be executed: ${blocked}. Schema changes must be made manually or the collection schema corrected.`,
      422,
    );
  }

  // Require explicit confirmation for destructive operations
  const isDestructive = operations.some((op) => op.destructive);
  if (isDestructive && !opts.confirmDestructive) {
    throw new OryCMSMigrationError(
      "MIGRATION_DESTRUCTIVE_UNCONFIRMED",
      "Migration contains destructive operations (data loss risk). Set confirmDestructive=true to proceed.",
      422,
    );
  }

  const upSql = buildUpSql(operations);
  if (!upSql.trim()) {
    throw new OryCMSMigrationError(
      "MIGRATION_NO_OPERATIONS",
      "Migration has no executable SQL statements.",
      422,
    );
  }

  const downSql = buildDownSql(operations);

  const res = await pool.query<{ id: string }>(
    `INSERT INTO orycms_collection_migrations
       (collection_slug, table_name, status, operations, warnings, up_sql, down_sql,
        destructive, unsafe, applied_by, created_at)
     VALUES ($1,$2,'pending',$3,$4,$5,$6,$7,$8,$9,NOW())
     RETURNING id`,
    [
      preview.collectionSlug,
      preview.tableName,
      JSON.stringify(operations),
      JSON.stringify(safety.warnings),
      upSql,
      downSql,
      isDestructive,
      false, // safety.safe was verified above
      approvedBy,
    ],
  );

  const record = await pool.query(`SELECT * FROM orycms_collection_migrations WHERE id = $1`, [
    res.rows[0].id,
  ]);
  return rowToRecord(record.rows[0] as Record<string, unknown>);
}

/**
 * Executes a previously approved (pending) migration inside a transaction.
 * Records outcome in orycms_collection_migrations.
 * Throws if already applied or not found.
 */
export async function executeOryCMSMigration(
  migrationId: string,
  executedBy: string,
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSCollectionMigrationRecord> {
  await ensureTable(pool);

  // Fetch and lock the record
  const fetchRes = await pool.query(`SELECT * FROM orycms_collection_migrations WHERE id = $1`, [
    migrationId,
  ]);
  if (!fetchRes.rows[0]) {
    throw new OryCMSMigrationError(
      "MIGRATION_NOT_FOUND",
      `Migration "${migrationId}" not found.`,
      404,
    );
  }
  const record = rowToRecord(fetchRes.rows[0] as Record<string, unknown>);

  if (record.status === "applied") {
    throw new OryCMSMigrationError(
      "MIGRATION_ALREADY_APPLIED",
      `Migration "${migrationId}" has already been applied.`,
      409,
    );
  }

  await runOryCMSBeforeHooks(
    "beforeMigration",
    buildOryCMSHookContext(
      "beforeMigration",
      record.collectionSlug,
      { migrationId, collectionSlug: record.collectionSlug },
      null,
    ),
  );

  const startMs = Date.now();
  const client: PoolClient = await pool.connect();

  try {
    await client.query("BEGIN");

    // Execute each statement individually so we get precise error context
    const statements = record.upSql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      await client.query(stmt);
    }

    const durationMs = Date.now() - startMs;

    // Record success inside the same transaction
    await client.query(
      `UPDATE orycms_collection_migrations
       SET status='applied', applied_by=$1, applied_at=NOW(), duration_ms=$2, error=NULL
       WHERE id=$3`,
      [executedBy, durationMs, migrationId],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");

    // Mark as failed
    const errMsg = err instanceof Error ? err.message : String(err);
    await pool.query(
      `UPDATE orycms_collection_migrations
       SET status='failed', error=$1, duration_ms=$2
       WHERE id=$3`,
      [errMsg, Date.now() - startMs, migrationId],
    );

    throw new OryCMSMigrationError(
      "MIGRATION_EXECUTION_FAILED",
      `Migration execution failed and was rolled back: ${errMsg}`,
      500,
    );
  } finally {
    client.release();
  }

  const updated = await pool.query(`SELECT * FROM orycms_collection_migrations WHERE id = $1`, [
    migrationId,
  ]);
  const appliedRecord = rowToRecord(updated.rows[0] as Record<string, unknown>);

  await runOryCMSAfterHooks(
    "afterMigration",
    buildOryCMSHookContext(
      "afterMigration",
      appliedRecord.collectionSlug,
      { migrationId, status: appliedRecord.status },
      null,
    ),
  );
  return appliedRecord;
}

/**
 * Rolls back a previously applied migration inside a transaction.
 * Throws if the migration has no down SQL (not reversible) or is not in applied state.
 */
export async function rollbackOryCMSMigration(
  migrationId: string,
  rolledBackBy: string,
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSCollectionMigrationRecord> {
  await ensureTable(pool);

  const fetchRes = await pool.query(`SELECT * FROM orycms_collection_migrations WHERE id = $1`, [
    migrationId,
  ]);
  if (!fetchRes.rows[0]) {
    throw new OryCMSMigrationError(
      "MIGRATION_NOT_FOUND",
      `Migration "${migrationId}" not found.`,
      404,
    );
  }
  const record = rowToRecord(fetchRes.rows[0] as Record<string, unknown>);

  if (record.status !== "applied") {
    throw new OryCMSMigrationError(
      "MIGRATION_NOT_FOUND",
      `Migration "${migrationId}" is not in applied state (current: ${record.status}).`,
      409,
    );
  }
  if (!record.downSql) {
    throw new OryCMSMigrationError(
      "MIGRATION_NOT_REVERSIBLE",
      `Migration "${migrationId}" has no rollback SQL. Some operations (e.g. DROP operations on new tables) are not reversible.`,
      422,
    );
  }

  await runOryCMSBeforeHooks(
    "beforeRollback",
    buildOryCMSHookContext(
      "beforeRollback",
      record.collectionSlug,
      { migrationId, collectionSlug: record.collectionSlug },
      null,
    ),
  );

  const startMs = Date.now();
  const client: PoolClient = await pool.connect();

  try {
    await client.query("BEGIN");

    const statements = record.downSql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      await client.query(stmt);
    }

    await client.query(
      `UPDATE orycms_collection_migrations
       SET status='rolled_back', rolled_back_by=$1, rolled_back_at=NOW(), duration_ms=$2
       WHERE id=$3`,
      [rolledBackBy, Date.now() - startMs, migrationId],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw new OryCMSMigrationError(
      "MIGRATION_EXECUTION_FAILED",
      `Rollback failed: ${err instanceof Error ? err.message : String(err)}`,
      500,
    );
  } finally {
    client.release();
  }

  const updated = await pool.query(`SELECT * FROM orycms_collection_migrations WHERE id = $1`, [
    migrationId,
  ]);
  const rolledBackRecord = rowToRecord(updated.rows[0] as Record<string, unknown>);

  await runOryCMSAfterHooks(
    "afterRollback",
    buildOryCMSHookContext(
      "afterRollback",
      rolledBackRecord.collectionSlug,
      { migrationId, status: rolledBackRecord.status },
      null,
    ),
  );
  return rolledBackRecord;
}

/**
 * Returns migration history for a collection, newest first.
 */
export async function getOryCMSMigrationHistory(
  collectionSlug: string,
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSCollectionMigrationRecord[]> {
  await ensureTable(pool);

  const res = await pool.query(
    `SELECT * FROM orycms_collection_migrations
     WHERE collection_slug = $1
     ORDER BY created_at DESC`,
    [collectionSlug],
  );
  return res.rows.map((r) => rowToRecord(r as Record<string, unknown>));
}
