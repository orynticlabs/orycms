/**
 * Migration engine tests.
 *
 * All engine-logic tests (apply, rollback, status, duplicates, failures,
 * transaction wiring) use an in-memory mock adapter — no module mocking needed.
 *
 * Provider-specific adapter tests (SQL dialect, transaction flag) mock the
 * underlying DB packages with vi.hoisted + vi.mock.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMigration,
  migrateDatabase,
  rollbackMigration,
  migrationStatus,
  createAdapter,
} from "../database/migrations";
import type {
  Migration,
  MigrationAdapter,
  AppliedMigration,
} from "../database/migrations";
import type {
  PostgresqlWizardResult,
  MysqlWizardResult,
  SqliteWizardResult,
} from "../database/wizard";

// ── In-memory mock adapter ─────────────────────────────────────────────────────

interface MockAdapterState {
  store: AppliedMigration[];
  executed: string[];
  transactions: number;
  closed: boolean;
}

function makeAdapter(opts?: {
  initialApplied?: AppliedMigration[];
  executeError?: Error;
  recordError?: Error;
  ensureError?: Error;
  supportsTransactions?: boolean;
}): MigrationAdapter & { state: MockAdapterState } {
  const store: AppliedMigration[] = structuredClone(opts?.initialApplied ?? []);
  const state: MockAdapterState = { store, executed: [], transactions: 0, closed: false };

  return {
    state,

    async ensureTable() {
      if (opts?.ensureError) throw opts.ensureError;
    },

    async getApplied() {
      return structuredClone(store);
    },

    async recordApplied(id, name, ms, cs) {
      if (opts?.recordError) throw opts.recordError;
      store.push({ id, name, appliedAt: new Date().toISOString(), executionTimeMs: ms, checksum: cs });
    },

    async removeRecord(id) {
      const idx = store.findIndex((a) => a.id === id);
      if (idx >= 0) store.splice(idx, 1);
    },

    async execute(sql) {
      if (opts?.executeError) throw opts.executeError;
      state.executed.push(sql);
    },

    get supportsTransactions() {
      return opts?.supportsTransactions ?? true;
    },

    async executeTransaction(ops) {
      state.transactions++;
      for (const op of ops) await op();
    },

    async close() {
      state.closed = true;
    },
  };
}

// ── Fixtures ───────────────────────────────────────────────────────────────────

const M1 = createMigration("001", "create users", "CREATE TABLE users (id INT)", "DROP TABLE users");
const M2 = createMigration("002", "create posts", "CREATE TABLE posts (id INT)", "DROP TABLE posts");
const M3 = createMigration("003", "add index", "CREATE INDEX idx ON users(id)"); // no down

// A DatabaseWizardResult is required by the public API even when injecting an adapter;
// createAdapter() is never called in these tests.
const CFG: SqliteWizardResult = { provider: "sqlite", filePath: ":memory:" };

function appliedRecord(m: Migration): AppliedMigration {
  return {
    id: m.id,
    name: m.name,
    appliedAt: "2024-01-01T00:00:00.000Z",
    executionTimeMs: 1,
    checksum: "aabbccdd11223344",
  };
}

// ── createMigration ────────────────────────────────────────────────────────────

describe("createMigration", () => {
  it("returns an object with the correct id, name, up", () => {
    const m = createMigration("id1", "my migration", "SELECT 1");
    expect(m).toMatchObject({ id: "id1", name: "my migration", up: "SELECT 1" });
  });

  it("includes down when provided", () => {
    const m = createMigration("id1", "migration", "CREATE TABLE t (x INT)", "DROP TABLE t");
    expect(m.down).toBe("DROP TABLE t");
  });

  it("omits down when not provided", () => {
    const m = createMigration("id1", "migration", "CREATE TABLE t (x INT)");
    expect("down" in m).toBe(false);
  });
});

// ── migrateDatabase — basic logic ─────────────────────────────────────────────

describe("migrateDatabase — apply", () => {
  it("applies all pending migrations in order", async () => {
    const adapter = makeAdapter();
    const result = await migrateDatabase([M1, M2], CFG, { adapter });

    expect(result.applied).toHaveLength(2);
    expect(result.applied[0].id).toBe("001");
    expect(result.applied[1].id).toBe("002");
    expect(result.skipped).toBe(0);
  });

  it("skips already-applied migrations", async () => {
    const adapter = makeAdapter({ initialApplied: [appliedRecord(M1)] });
    const result = await migrateDatabase([M1, M2], CFG, { adapter });

    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].id).toBe("002");
    expect(result.skipped).toBe(1);
  });

  it("returns 0 applied when all are already applied", async () => {
    const adapter = makeAdapter({ initialApplied: [appliedRecord(M1), appliedRecord(M2)] });
    const result = await migrateDatabase([M1, M2], CFG, { adapter });

    expect(result.applied).toHaveLength(0);
    expect(result.skipped).toBe(2);
    expect(result.failed).toBeUndefined();
  });

  it("returns 0 applied for an empty migrations list", async () => {
    const adapter = makeAdapter();
    const result = await migrateDatabase([], CFG, { adapter });
    expect(result.applied).toHaveLength(0);
    expect(result.skipped).toBe(0);
  });

  it("executes the up SQL via the adapter", async () => {
    const adapter = makeAdapter();
    await migrateDatabase([M1, M2], CFG, { adapter });
    expect(adapter.state.executed).toEqual([M1.up, M2.up]);
  });

  it("records applied migrations in the tracking store", async () => {
    const adapter = makeAdapter();
    await migrateDatabase([M1], CFG, { adapter });
    expect(adapter.state.store).toHaveLength(1);
    expect(adapter.state.store[0].id).toBe("001");
  });

  it("applied entries include a non-empty checksum", async () => {
    const adapter = makeAdapter();
    const result = await migrateDatabase([M1], CFG, { adapter });
    expect(result.applied[0].checksum).toBeTruthy();
    expect(result.applied[0].checksum).toHaveLength(16); // sha256 slice(0,16)
  });

  it("same up SQL always produces the same checksum", async () => {
    const a = makeAdapter();
    const b = makeAdapter();
    await migrateDatabase([M1], CFG, { adapter: a });
    await migrateDatabase([M1], CFG, { adapter: b });
    expect(a.state.store[0].checksum).toBe(b.state.store[0].checksum);
  });

  it("different up SQL produces different checksums", async () => {
    const a = makeAdapter();
    const b = makeAdapter();
    await migrateDatabase([M1], CFG, { adapter: a });
    await migrateDatabase([M2], CFG, { adapter: b });
    expect(a.state.store[0].checksum).not.toBe(b.state.store[0].checksum);
  });
});

// ── migrateDatabase — failure handling ────────────────────────────────────────

describe("migrateDatabase — failure", () => {
  it("stops on the first failure and reports it", async () => {
    const err = new Error("syntax error near CREATE");
    const adapter = makeAdapter({ executeError: err });
    const result = await migrateDatabase([M1, M2], CFG, { adapter });

    expect(result.applied).toHaveLength(0);
    expect(result.failed).toBeDefined();
    expect(result.failed?.id).toBe("001");
    expect(result.failed?.error).toContain("syntax error");
  });

  it("does not execute subsequent migrations after a failure", async () => {
    const adapter = makeAdapter({ executeError: new Error("boom") });
    await migrateDatabase([M1, M2, M3], CFG, { adapter });
    // Only attempted M1 (which failed); M2 and M3 were not attempted
    expect(adapter.state.executed).toHaveLength(0);
  });

  it("applies migrations before the failure and reports them", async () => {
    let callCount = 0;
    const adapter: MigrationAdapter & { state: MockAdapterState } = {
      ...makeAdapter(),
      async execute(sql) {
        callCount++;
        if (callCount === 2) throw new Error("migration 2 failed");
        adapter.state.executed.push(sql);
      },
    };

    const result = await migrateDatabase([M1, M2, M3], CFG, { adapter });
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].id).toBe("001");
    expect(result.failed?.id).toBe("002");
  });

  it("does not record a failed migration in the store", async () => {
    const adapter = makeAdapter({ executeError: new Error("boom") });
    await migrateDatabase([M1], CFG, { adapter });
    expect(adapter.state.store).toHaveLength(0);
  });
});

// ── migrateDatabase — duplicate ID guard ──────────────────────────────────────

describe("migrateDatabase — duplicate IDs", () => {
  it("throws synchronously for duplicate migration IDs", async () => {
    const adapter = makeAdapter();
    await expect(
      migrateDatabase([M1, M1], CFG, { adapter }),
    ).rejects.toThrow('Duplicate migration ID: "001"');
  });

  it("throws before touching the adapter", async () => {
    const adapter = makeAdapter();
    await expect(migrateDatabase([M2, M2], CFG, { adapter })).rejects.toThrow();
    expect(adapter.state.executed).toHaveLength(0);
  });
});

// ── migrateDatabase — transaction wiring ──────────────────────────────────────

describe("migrateDatabase — transactions", () => {
  it("calls executeTransaction once per pending migration when supportsTransactions:true", async () => {
    const adapter = makeAdapter({ supportsTransactions: true });
    await migrateDatabase([M1, M2], CFG, { adapter });
    expect(adapter.state.transactions).toBe(2);
  });

  it("does NOT call executeTransaction when supportsTransactions:false", async () => {
    const adapter = makeAdapter({ supportsTransactions: false });
    await migrateDatabase([M1, M2], CFG, { adapter });
    expect(adapter.state.transactions).toBe(0);
  });

  it("still executes the SQL and records when supportsTransactions:false", async () => {
    const adapter = makeAdapter({ supportsTransactions: false });
    const result = await migrateDatabase([M1], CFG, { adapter });
    expect(result.applied).toHaveLength(1);
    expect(adapter.state.executed).toHaveLength(1);
  });

  it("rolls back atomically when recordApplied fails inside a transaction", async () => {
    // In a real DB adapter this would ROLLBACK; in the mock, the store entry is never pushed.
    const adapter = makeAdapter({ recordError: new Error("store write failed") });
    const result = await migrateDatabase([M1], CFG, { adapter });
    expect(result.failed?.id).toBe("001");
    expect(adapter.state.store).toHaveLength(0);
  });
});

// ── rollbackMigration ─────────────────────────────────────────────────────────

describe("rollbackMigration", () => {
  it("rolls back the most recently applied migration", async () => {
    const adapter = makeAdapter({ initialApplied: [appliedRecord(M1), appliedRecord(M2)] });
    const result = await rollbackMigration([M1, M2], CFG, { adapter });

    expect(result.id).toBe("002");
    expect(adapter.state.store).toHaveLength(1);
    expect(adapter.state.store[0].id).toBe("001");
  });

  it("executes the down SQL", async () => {
    const adapter = makeAdapter({ initialApplied: [appliedRecord(M1)] });
    await rollbackMigration([M1], CFG, { adapter });
    expect(adapter.state.executed).toContain(M1.down);
  });

  it("rolls back the specified targetId", async () => {
    const adapter = makeAdapter({ initialApplied: [appliedRecord(M1), appliedRecord(M2)] });
    const result = await rollbackMigration([M1, M2], CFG, { adapter: adapter, targetId: "001" });

    expect(result.id).toBe("001");
    expect(adapter.state.store.find((r) => r.id === "001")).toBeUndefined();
    expect(adapter.state.store.find((r) => r.id === "002")).toBeDefined();
  });

  it("throws when no migrations have been applied", async () => {
    const adapter = makeAdapter();
    await expect(rollbackMigration([M1], CFG, { adapter })).rejects.toThrow(
      "No applied migrations to roll back",
    );
  });

  it("throws when the specified targetId has not been applied", async () => {
    const adapter = makeAdapter({ initialApplied: [appliedRecord(M1)] });
    await expect(
      rollbackMigration([M1], CFG, { adapter, targetId: "999" }),
    ).rejects.toThrow('"999" has not been applied');
  });

  it("throws when the migration has no down definition", async () => {
    const adapter = makeAdapter({ initialApplied: [appliedRecord(M3)] });
    await expect(rollbackMigration([M3], CFG, { adapter })).rejects.toThrow(
      'has no rollback (down) definition',
    );
  });

  it("throws for duplicate migration IDs", async () => {
    const adapter = makeAdapter({ initialApplied: [appliedRecord(M1)] });
    await expect(rollbackMigration([M1, M1], CFG, { adapter })).rejects.toThrow(
      'Duplicate migration ID',
    );
  });

  it("uses executeTransaction when supportsTransactions:true", async () => {
    const adapter = makeAdapter({ initialApplied: [appliedRecord(M1)], supportsTransactions: true });
    await rollbackMigration([M1], CFG, { adapter });
    expect(adapter.state.transactions).toBe(1);
  });

  it("does not use executeTransaction when supportsTransactions:false", async () => {
    const adapter = makeAdapter({
      initialApplied: [appliedRecord(M1)],
      supportsTransactions: false,
    });
    await rollbackMigration([M1], CFG, { adapter });
    expect(adapter.state.transactions).toBe(0);
    expect(adapter.state.executed).toContain(M1.down);
  });

  it("removes the record even without transaction support", async () => {
    const adapter = makeAdapter({
      initialApplied: [appliedRecord(M1)],
      supportsTransactions: false,
    });
    await rollbackMigration([M1], CFG, { adapter });
    expect(adapter.state.store).toHaveLength(0);
  });
});

// ── migrationStatus ────────────────────────────────────────────────────────────

describe("migrationStatus", () => {
  it("reports all migrations as pending when none are applied", async () => {
    const adapter = makeAdapter();
    const result = await migrationStatus([M1, M2, M3], CFG, { adapter });

    expect(result.total).toBe(3);
    expect(result.applied).toBe(0);
    expect(result.pending).toBe(3);
    expect(result.entries.every((e) => e.state === "pending")).toBe(true);
  });

  it("reports all migrations as applied when all are applied", async () => {
    const adapter = makeAdapter({
      initialApplied: [appliedRecord(M1), appliedRecord(M2), appliedRecord(M3)],
    });
    const result = await migrationStatus([M1, M2, M3], CFG, { adapter });

    expect(result.applied).toBe(3);
    expect(result.pending).toBe(0);
  });

  it("correctly mixes pending and applied", async () => {
    const adapter = makeAdapter({ initialApplied: [appliedRecord(M1)] });
    const result = await migrationStatus([M1, M2, M3], CFG, { adapter });

    expect(result.applied).toBe(1);
    expect(result.pending).toBe(2);
    expect(result.entries.find((e) => e.id === "001")?.state).toBe("applied");
    expect(result.entries.find((e) => e.id === "002")?.state).toBe("pending");
  });

  it("includes appliedAt only for applied migrations", async () => {
    const adapter = makeAdapter({ initialApplied: [appliedRecord(M1)] });
    const result = await migrationStatus([M1, M2], CFG, { adapter });

    expect(result.entries.find((e) => e.id === "001")?.appliedAt).toBeTruthy();
    expect(result.entries.find((e) => e.id === "002")?.appliedAt).toBeUndefined();
  });

  it("returns total:0 for empty migrations list", async () => {
    const adapter = makeAdapter();
    const result = await migrationStatus([], CFG, { adapter });
    expect(result.total).toBe(0);
    expect(result.entries).toHaveLength(0);
  });

  it("throws for duplicate migration IDs", async () => {
    const adapter = makeAdapter();
    await expect(migrationStatus([M1, M1], CFG, { adapter })).rejects.toThrow(
      'Duplicate migration ID',
    );
  });

  it("total === applied + pending", async () => {
    const adapter = makeAdapter({ initialApplied: [appliedRecord(M1)] });
    const r = await migrationStatus([M1, M2, M3], CFG, { adapter });
    expect(r.total).toBe(r.applied + r.pending);
  });
});

// ── Provider-specific adapter tests (module mocks) ────────────────────────────
//
// These tests exercise createAdapter() directly to verify that:
//   - pg adapters use $N placeholders and support transactions
//   - mysql2 adapters use ? placeholders and have supportsTransactions:false
//   - sqlite adapters use exec/exec pattern and have supportsTransactions:true

const {
  pgConnect, pgQuery, pgEnd, PgClient,
  mysqlExecute, mysqlEnd, mysqlCreateConnection,
  sqliteExec, sqlitePrepareRun, sqlitePrepareAll, SqliteDatabase,
} = vi.hoisted(() => {
  const pgConnect = vi.fn().mockResolvedValue(undefined);
  const pgQuery = vi.fn().mockResolvedValue({ rows: [] });
  const pgEnd = vi.fn().mockResolvedValue(undefined);
  const PgClient = vi.fn(function (this: Record<string, unknown>) {
    this["connect"] = pgConnect;
    this["query"] = pgQuery;
    this["end"] = pgEnd;
  });

  const mysqlExecute = vi.fn().mockResolvedValue([[], []]);
  const mysqlEnd = vi.fn().mockResolvedValue(undefined);
  const mysqlCreateConnection = vi
    .fn()
    .mockResolvedValue({ execute: mysqlExecute, end: mysqlEnd });

  const sqliteExec = vi.fn();
  const sqlitePrepareRun = vi.fn().mockReturnValue({ changes: 1 });
  const sqlitePrepareAll = vi.fn().mockReturnValue([]);
  const SqliteDatabase = vi.fn(function (this: Record<string, unknown>) {
    this["exec"] = sqliteExec;
    this["prepare"] = vi.fn().mockReturnValue({
      run: sqlitePrepareRun,
      all: sqlitePrepareAll,
      get: vi.fn().mockReturnValue({}),
    });
    this["close"] = vi.fn();
  });

  return {
    pgConnect, pgQuery, pgEnd, PgClient,
    mysqlExecute, mysqlEnd, mysqlCreateConnection,
    sqliteExec, sqlitePrepareRun, sqlitePrepareAll, SqliteDatabase,
  };
});

vi.mock("pg", () => ({ Client: PgClient }));
vi.mock("mysql2/promise", () => ({ createConnection: mysqlCreateConnection }));
vi.mock("better-sqlite3", () => ({ default: SqliteDatabase }));

beforeEach(() => {
  vi.clearAllMocks();
  pgConnect.mockResolvedValue(undefined);
  pgQuery.mockResolvedValue({ rows: [] });
  pgEnd.mockResolvedValue(undefined);
  mysqlExecute.mockResolvedValue([[], []]);
  mysqlEnd.mockResolvedValue(undefined);
  mysqlCreateConnection.mockResolvedValue({ execute: mysqlExecute, end: mysqlEnd });
  sqliteExec.mockReset();
  sqlitePrepareAll.mockReturnValue([]);
  sqlitePrepareRun.mockReturnValue({ changes: 1 });
});

afterEach(() => vi.restoreAllMocks());

const PG_CFG: PostgresqlWizardResult = {
  provider: "postgresql",
  host: "localhost",
  port: 5432,
  user: "admin",
  password: "pass",
  database: "mydb",
  ssl: false,
};

const MYSQL_CFG: MysqlWizardResult = {
  provider: "mysql",
  host: "localhost",
  port: 3306,
  user: "root",
  password: "pass",
  database: "mydb",
};

const SQLITE_CFG: SqliteWizardResult = {
  provider: "sqlite",
  filePath: "./test.sqlite",
};

describe("provider adapters — PostgreSQL", () => {
  it("ensureTable creates the orycms_migrations table", async () => {
    const adapter = await createAdapter(PG_CFG);
    await adapter.ensureTable();
    expect(pgQuery).toHaveBeenCalledWith(expect.stringContaining("CREATE TABLE IF NOT EXISTS orycms_migrations"));
    await adapter.close();
  });

  it("recordApplied uses $1..$4 placeholders", async () => {
    const adapter = await createAdapter(PG_CFG);
    await adapter.recordApplied("id1", "name1", 100, "abc");
    expect(pgQuery).toHaveBeenCalledWith(
      expect.stringContaining("$1"),
      expect.arrayContaining(["id1"]),
    );
    await adapter.close();
  });

  it("removeRecord uses $1 placeholder", async () => {
    const adapter = await createAdapter(PG_CFG);
    await adapter.removeRecord("id1");
    expect(pgQuery).toHaveBeenCalledWith(expect.stringContaining("$1"), ["id1"]);
    await adapter.close();
  });

  it("supportsTransactions is true", async () => {
    const adapter = await createAdapter(PG_CFG);
    expect(adapter.supportsTransactions).toBe(true);
    await adapter.close();
  });

  it("executeTransaction issues BEGIN / COMMIT", async () => {
    const adapter = await createAdapter(PG_CFG);
    await adapter.executeTransaction([async () => {}]);
    const calls = pgQuery.mock.calls.map((c) => String(c[0]).trim());
    expect(calls).toContain("BEGIN");
    expect(calls).toContain("COMMIT");
    await adapter.close();
  });

  it("executeTransaction issues ROLLBACK on failure", async () => {
    const adapter = await createAdapter(PG_CFG);
    await expect(
      adapter.executeTransaction([
        async () => {
          throw new Error("migration failed");
        },
      ]),
    ).rejects.toThrow();
    const calls = pgQuery.mock.calls.map((c) => String(c[0]).trim());
    expect(calls).toContain("ROLLBACK");
    await adapter.close();
  });
});

describe("provider adapters — MySQL", () => {
  it("ensureTable creates the orycms_migrations table", async () => {
    const adapter = await createAdapter(MYSQL_CFG);
    await adapter.ensureTable();
    expect(mysqlExecute).toHaveBeenCalledWith(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS orycms_migrations"),
    );
    await adapter.close();
  });

  it("recordApplied uses ? placeholders", async () => {
    const adapter = await createAdapter(MYSQL_CFG);
    await adapter.recordApplied("id1", "name1", 50, "abc");
    expect(mysqlExecute).toHaveBeenCalledWith(
      expect.stringContaining("?"),
      expect.arrayContaining(["id1"]),
    );
    await adapter.close();
  });

  it("supportsTransactions is false (MySQL DDL auto-commits)", async () => {
    const adapter = await createAdapter(MYSQL_CFG);
    expect(adapter.supportsTransactions).toBe(false);
    await adapter.close();
  });

  it("executeTransaction runs ops sequentially without BEGIN/COMMIT", async () => {
    const adapter = await createAdapter(MYSQL_CFG);
    const log: string[] = [];
    await adapter.executeTransaction([
      async () => { log.push("op1"); },
      async () => { log.push("op2"); },
    ]);
    expect(log).toEqual(["op1", "op2"]);
    // no BEGIN was sent
    expect(mysqlExecute).not.toHaveBeenCalledWith(expect.stringContaining("BEGIN"), expect.anything());
    await adapter.close();
  });
});

describe("provider adapters — SQLite", () => {
  it("ensureTable calls db.exec with CREATE TABLE IF NOT EXISTS", async () => {
    const adapter = await createAdapter(SQLITE_CFG);
    await adapter.ensureTable();
    expect(sqliteExec).toHaveBeenCalledWith(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS orycms_migrations"),
    );
    await adapter.close();
  });

  it("supportsTransactions is true (SQLite supports DDL in transactions)", async () => {
    const adapter = await createAdapter(SQLITE_CFG);
    expect(adapter.supportsTransactions).toBe(true);
    await adapter.close();
  });

  it("executeTransaction wraps in BEGIN / COMMIT", async () => {
    const adapter = await createAdapter(SQLITE_CFG);
    await adapter.executeTransaction([async () => {}]);
    const execCalls = sqliteExec.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(execCalls).toContain("BEGIN");
    expect(execCalls).toContain("COMMIT");
    await adapter.close();
  });

  it("executeTransaction issues ROLLBACK on failure", async () => {
    const adapter = await createAdapter(SQLITE_CFG);
    await expect(
      adapter.executeTransaction([
        async () => {
          throw new Error("sqlite error");
        },
      ]),
    ).rejects.toThrow();
    const execCalls = sqliteExec.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(execCalls).toContain("ROLLBACK");
    await adapter.close();
  });

  it("execute calls db.exec with the provided SQL", async () => {
    const adapter = await createAdapter(SQLITE_CFG);
    await adapter.execute("CREATE TABLE foo (id INTEGER)");
    expect(sqliteExec).toHaveBeenCalledWith("CREATE TABLE foo (id INTEGER)");
    await adapter.close();
  });
});
