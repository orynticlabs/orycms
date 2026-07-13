import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Pool, PoolClient } from "pg";
import {
  approveOryCMSMigration,
  executeOryCMSMigration,
  rollbackOryCMSMigration,
  getOryCMSMigrationHistory,
} from "../migration.engine";
import { OryCMSMigrationError } from "../migration.errors";
import type { OryCMSMigrationPreview } from "@/mapper";

// ── Pool / client mock helpers ─────────────────────────────────────────────────

const MOCK_ID = "migration-uuid-001";
const NOW = "2024-01-01T00:00:00.000Z";

function pendingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: MOCK_ID,
    collection_slug: "blog-posts",
    table_name: "blog_posts",
    status: "pending",
    operations: [],
    warnings: [],
    up_sql: 'CREATE TABLE IF NOT EXISTS "blog_posts" (id UUID PRIMARY KEY);',
    down_sql: 'DROP TABLE IF EXISTS "blog_posts";',
    destructive: false,
    unsafe: false,
    applied_by: "owner@test.com",
    applied_at: null,
    rolled_back_by: null,
    rolled_back_at: null,
    duration_ms: null,
    error: null,
    created_at: NOW,
    ...overrides,
  };
}

function makePool(impl: (sql: string, params?: unknown[]) => unknown): Pool {
  return { query: vi.fn(impl) } as unknown as Pool;
}

function makeClientPool(queryImpl: (sql: string, params?: unknown[]) => unknown): Pool {
  const client: PoolClient = {
    query: vi.fn(queryImpl),
    release: vi.fn(),
  } as unknown as PoolClient;
  return {
    query: vi.fn(queryImpl),
    connect: vi.fn().mockResolvedValue(client),
  } as unknown as Pool;
}

// ── Preview fixtures ───────────────────────────────────────────────────────────

function safePreview(overrides: Partial<OryCMSMigrationPreview> = {}): OryCMSMigrationPreview {
  return {
    collectionSlug: "blog-posts",
    tableName: "blog_posts",
    operations: [
      {
        type: "CREATE_COLLECTION",
        target: "blog_posts",
        upStatement: 'CREATE TABLE IF NOT EXISTS "blog_posts" (id UUID PRIMARY KEY);',
        downStatement: 'DROP TABLE IF EXISTS "blog_posts";',
        destructive: false,
        unsafe: false,
        warnings: [],
      },
    ],
    safety: { safe: true, blocked: [], warnings: [] },
    ...overrides,
  };
}

function unsafePreview(): OryCMSMigrationPreview {
  return {
    collectionSlug: "blog-posts",
    tableName: "blog_posts",
    operations: [
      {
        type: "CHANGE_FIELD_TYPE",
        target: "blog_posts",
        upStatement: 'ALTER TABLE "blog_posts" ALTER COLUMN "body" TYPE JSONB USING body::jsonb;',
        downStatement: undefined,
        destructive: true,
        unsafe: true,
        warnings: ["Unsafe type change"],
      },
    ],
    safety: {
      safe: false,
      blocked: [
        {
          type: "CHANGE_FIELD_TYPE",
          target: "blog_posts",
          upStatement: undefined,
          downStatement: undefined,
          destructive: true,
          unsafe: true,
          warnings: ["Unsafe type change"],
        },
      ],
      warnings: ["Unsafe type change"],
    },
  };
}

function destructivePreview(): OryCMSMigrationPreview {
  return {
    collectionSlug: "blog-posts",
    tableName: "blog_posts",
    operations: [
      {
        type: "REMOVE_FIELD",
        target: "blog_posts",
        upStatement: 'ALTER TABLE "blog_posts" DROP COLUMN "body";',
        downStatement: 'ALTER TABLE "blog_posts" ADD COLUMN "body" TEXT;',
        destructive: true,
        unsafe: false,
        warnings: ["Column body will be dropped"],
      },
    ],
    safety: { safe: true, blocked: [], warnings: ["Column body will be dropped"] },
  };
}

// ── approveOryCMSMigration ─────────────────────────────────────────────────────

describe("approveOryCMSMigration", () => {
  it("stores a pending record for a safe preview", async () => {
    let callIdx = 0;
    const pool = makePool(() => {
      callIdx++;
      if (callIdx === 1) return { rows: [] }; // ensureTable
      if (callIdx === 2) return { rows: [{ id: MOCK_ID }] }; // INSERT
      return { rows: [pendingRow()] }; // SELECT
    });

    const record = await approveOryCMSMigration(safePreview(), "owner@test.com", {}, pool);

    expect(record.id).toBe(MOCK_ID);
    expect(record.status).toBe("pending");
    expect(record.collectionSlug).toBe("blog-posts");
    expect(record.appliedBy).toBe("owner@test.com");
  });

  it("throws MIGRATION_UNSAFE when safety.safe is false", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await expect(
      approveOryCMSMigration(unsafePreview(), "owner@test.com", {}, pool),
    ).rejects.toMatchObject({ code: "MIGRATION_UNSAFE", statusCode: 422 });
  });

  it("throws MIGRATION_DESTRUCTIVE_UNCONFIRMED when destructive and not confirmed", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await expect(
      approveOryCMSMigration(destructivePreview(), "owner@test.com", {}, pool),
    ).rejects.toMatchObject({ code: "MIGRATION_DESTRUCTIVE_UNCONFIRMED", statusCode: 422 });
  });

  it("approves destructive migration when confirmDestructive is true", async () => {
    let callIdx = 0;
    const pool = makePool(() => {
      callIdx++;
      if (callIdx <= 1) return { rows: [] }; // ensureTable
      if (callIdx === 2) return { rows: [{ id: MOCK_ID }] }; // INSERT
      return { rows: [pendingRow({ destructive: true })] }; // SELECT
    });

    const record = await approveOryCMSMigration(
      destructivePreview(),
      "owner@test.com",
      { confirmDestructive: true },
      pool,
    );
    expect(record.destructive).toBe(true);
    expect(record.status).toBe("pending");
  });

  it("throws MIGRATION_NO_OPERATIONS when preview has no SQL", async () => {
    const pool = makePool(() => ({ rows: [] }));
    const emptyPreview = safePreview({
      operations: [
        {
          type: "CREATE_COLLECTION",
          target: "t",
          upStatement: undefined,
          downStatement: undefined,
          destructive: false,
          unsafe: false,
          warnings: [],
        },
      ],
    });
    await expect(
      approveOryCMSMigration(emptyPreview, "owner@test.com", {}, pool),
    ).rejects.toMatchObject({ code: "MIGRATION_NO_OPERATIONS" });
  });
});

// ── executeOryCMSMigration ─────────────────────────────────────────────────────

describe("executeOryCMSMigration", () => {
  it("executes SQL inside a transaction and marks record applied", async () => {
    const appliedRow = pendingRow({ status: "applied", applied_at: NOW, duration_ms: 10 });
    let poolCallIdx = 0;
    const mockClient: PoolClient = {
      query: vi.fn((sql: string) => {
        if (sql.includes("UPDATE") || sql === "BEGIN" || sql === "COMMIT")
          return Promise.resolve({ rows: [] });
        return Promise.resolve({ rows: [] });
      }),
      release: vi.fn(),
    } as unknown as PoolClient;

    const pool: Pool = {
      query: vi.fn(() => {
        poolCallIdx++;
        if (poolCallIdx === 1) return Promise.resolve({ rows: [] }); // ensureTable
        if (poolCallIdx === 2) return Promise.resolve({ rows: [pendingRow()] }); // fetch
        return Promise.resolve({ rows: [appliedRow] }); // final SELECT
      }),
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as Pool;

    const record = await executeOryCMSMigration(MOCK_ID, "owner@test.com", pool);

    expect(record.status).toBe("applied");
    expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
    expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
  });

  it("throws MIGRATION_NOT_FOUND when id does not exist", async () => {
    const pool = makeClientPool((sql: string) => {
      if (sql.includes("CREATE TABLE")) return { rows: [] };
      return { rows: [] };
    });
    await expect(
      executeOryCMSMigration("unknown-id", "owner@test.com", pool),
    ).rejects.toMatchObject({ code: "MIGRATION_NOT_FOUND", statusCode: 404 });
  });

  it("throws MIGRATION_ALREADY_APPLIED when status is applied", async () => {
    let poolCallIdx = 0;
    const pool = makeClientPool(() => {
      poolCallIdx++;
      if (poolCallIdx === 1) return { rows: [] };
      return { rows: [pendingRow({ status: "applied" })] };
    });
    await expect(executeOryCMSMigration(MOCK_ID, "owner@test.com", pool)).rejects.toMatchObject({
      code: "MIGRATION_ALREADY_APPLIED",
      statusCode: 409,
    });
  });

  it("rolls back the transaction and marks failed when SQL errors", async () => {
    let poolCallIdx = 0;
    let markedFailed = false;
    let clientCallIdx = 0;

    const mockClient: PoolClient = {
      query: vi.fn(async (sql: string) => {
        clientCallIdx++;
        if (sql === "BEGIN") return { rows: [] };
        if (sql === "ROLLBACK") return { rows: [] };
        // Any real SQL statement — simulate error
        throw new Error("syntax error in SQL");
      }),
      release: vi.fn(),
    } as unknown as PoolClient;

    const pool: Pool = {
      query: vi.fn(async (sql: string) => {
        poolCallIdx++;
        if (poolCallIdx === 1) return { rows: [] }; // ensureTable
        if (poolCallIdx === 2) return { rows: [pendingRow()] }; // fetch
        if (typeof sql === "string" && sql.includes("status='failed'")) {
          markedFailed = true;
          return { rows: [] };
        }
        return { rows: [] };
      }),
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as Pool;

    await expect(executeOryCMSMigration(MOCK_ID, "owner@test.com", pool)).rejects.toMatchObject({
      code: "MIGRATION_EXECUTION_FAILED",
    });

    expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    expect(markedFailed).toBe(true);
  });
});

// ── rollbackOryCMSMigration ───────────────────────────────────────────────────

describe("rollbackOryCMSMigration", () => {
  it("executes down SQL inside a transaction and marks rolled_back", async () => {
    const appliedRow = pendingRow({ status: "applied" });
    const rolledBackRow = pendingRow({ status: "rolled_back", rolled_back_at: NOW });
    let poolCallIdx = 0;
    const mockClient: PoolClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    } as unknown as PoolClient;

    const pool: Pool = {
      query: vi.fn(() => {
        poolCallIdx++;
        if (poolCallIdx === 1) return Promise.resolve({ rows: [] }); // ensureTable
        if (poolCallIdx === 2) return Promise.resolve({ rows: [appliedRow] }); // fetch
        return Promise.resolve({ rows: [rolledBackRow] }); // final SELECT
      }),
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as Pool;

    const record = await rollbackOryCMSMigration(MOCK_ID, "owner@test.com", pool);
    expect(record.status).toBe("rolled_back");
    expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
    expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
  });

  it("throws MIGRATION_NOT_FOUND when id does not exist", async () => {
    const pool = makeClientPool((sql: string) => {
      if (sql.includes("CREATE TABLE")) return { rows: [] };
      return { rows: [] };
    });
    await expect(rollbackOryCMSMigration("unknown", "owner@test.com", pool)).rejects.toMatchObject({
      code: "MIGRATION_NOT_FOUND",
    });
  });

  it("throws MIGRATION_NOT_FOUND when not in applied state", async () => {
    let poolCallIdx = 0;
    const pool = makeClientPool(() => {
      poolCallIdx++;
      if (poolCallIdx === 1) return { rows: [] };
      return { rows: [pendingRow({ status: "pending" })] };
    });
    await expect(rollbackOryCMSMigration(MOCK_ID, "owner@test.com", pool)).rejects.toMatchObject({
      code: "MIGRATION_NOT_FOUND",
    });
  });

  it("throws MIGRATION_NOT_REVERSIBLE when down_sql is null", async () => {
    let poolCallIdx = 0;
    const pool = makeClientPool(() => {
      poolCallIdx++;
      if (poolCallIdx === 1) return { rows: [] };
      return { rows: [pendingRow({ status: "applied", down_sql: null })] };
    });
    await expect(rollbackOryCMSMigration(MOCK_ID, "owner@test.com", pool)).rejects.toMatchObject({
      code: "MIGRATION_NOT_REVERSIBLE",
      statusCode: 422,
    });
  });
});

// ── getOryCMSMigrationHistory ─────────────────────────────────────────────────

describe("getOryCMSMigrationHistory", () => {
  it("returns migration records for a collection slug", async () => {
    let callIdx = 0;
    const pool = makePool(() => {
      callIdx++;
      if (callIdx === 1) return { rows: [] }; // ensureTable
      return { rows: [pendingRow({ status: "applied" }), pendingRow({ id: "uuid-2" })] };
    });

    const history = await getOryCMSMigrationHistory("blog-posts", pool);
    expect(history).toHaveLength(2);
    expect(history[0].collectionSlug).toBe("blog-posts");
    expect(history[0].status).toBe("applied");
  });

  it("returns empty array when no migrations exist", async () => {
    let callIdx = 0;
    const pool = makePool(() => {
      callIdx++;
      if (callIdx === 1) return { rows: [] };
      return { rows: [] };
    });
    const history = await getOryCMSMigrationHistory("no-such", pool);
    expect(history).toEqual([]);
  });
});

// ── OryCMSMigrationError ──────────────────────────────────────────────────────

describe("OryCMSMigrationError", () => {
  it("carries code, statusCode, and name", () => {
    const e = new OryCMSMigrationError("MIGRATION_UNSAFE", "blocked", 422);
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe("MIGRATION_UNSAFE");
    expect(e.statusCode).toBe(422);
    expect(e.name).toBe("OryCMSMigrationError");
  });
});
