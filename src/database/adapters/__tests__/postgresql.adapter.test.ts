import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQuery, mockEnd, MockPool } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  const mockEnd = vi.fn();
  // Must be a regular function — arrow functions can't be used as constructors (Vitest 4)
  const MockPool = vi.fn(function (this: Record<string, unknown>) {
    this["query"] = mockQuery;
    this["end"] = mockEnd;
  });
  return { mockQuery, mockEnd, MockPool };
});

vi.mock("pg", () => ({ Pool: MockPool }));

import {
  createOryCMSPostgreSQLAdapter,
  createMigrationFromCollectionPlan,
} from "../postgresql.adapter";
import type { OryCMSDatabaseConnectionConfig } from "../../adapter.types";
import type { OryCMSCollectionMigrationPlan } from "@/mapper/mapper.types";

const TEST_URL = "postgresql://user:pass@localhost:5432/testdb";
const NEON_URL = "postgresql://user:pass@ep-example.us-east-2.aws.neon.tech/mydb?sslmode=require";
const SUPABASE_URL = "postgresql://postgres:pass@db.example.supabase.co:5432/postgres";

const cfg = (url: string): OryCMSDatabaseConnectionConfig => ({ url });

describe("createOryCMSPostgreSQLAdapter", () => {
  let adapter: ReturnType<typeof createOryCMSPostgreSQLAdapter>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [] });
    adapter = createOryCMSPostgreSQLAdapter();
  });

  // ── connect ────────────────────────────────────────────────────────────────

  describe("connect", () => {
    it("creates a Pool with the provided URL and verifies connection", async () => {
      await adapter.connect(cfg(TEST_URL));
      expect(MockPool).toHaveBeenCalledWith(
        expect.objectContaining({ connectionString: TEST_URL }),
      );
      expect(mockQuery).toHaveBeenCalledWith("SELECT 1");
    });

    it("falls back to ORYCMS_DATABASE_URL when cfg has no url", async () => {
      process.env.ORYCMS_DATABASE_URL = TEST_URL;
      await adapter.connect({});
      expect(MockPool).toHaveBeenCalledWith(
        expect.objectContaining({ connectionString: TEST_URL }),
      );
      delete process.env.ORYCMS_DATABASE_URL;
    });

    it("auto-enables SSL for Neon URLs", async () => {
      await adapter.connect(cfg(NEON_URL));
      expect(MockPool).toHaveBeenCalledWith(expect.objectContaining({ ssl: true }));
    });

    it("auto-enables SSL for Supabase URLs", async () => {
      await adapter.connect(cfg(SUPABASE_URL));
      expect(MockPool).toHaveBeenCalledWith(expect.objectContaining({ ssl: true }));
    });

    it("respects explicit ssl: false even for cloud URLs", async () => {
      await adapter.connect({ url: NEON_URL, ssl: false });
      expect(MockPool).toHaveBeenCalledWith(expect.objectContaining({ ssl: false }));
    });

    it("merges factory defaults with connect config (connect wins)", async () => {
      const a = createOryCMSPostgreSQLAdapter({ poolSize: 5 });
      await a.connect(cfg(TEST_URL));
      expect(MockPool).toHaveBeenCalledWith(expect.objectContaining({ max: 5 }));
    });

    it("connect config poolSize overrides factory default", async () => {
      const a = createOryCMSPostgreSQLAdapter({ poolSize: 5 });
      await a.connect({ url: TEST_URL, poolSize: 20 });
      expect(MockPool).toHaveBeenCalledWith(expect.objectContaining({ max: 20 }));
    });
  });

  // ── disconnect ─────────────────────────────────────────────────────────────

  describe("disconnect", () => {
    it("calls pool.end", async () => {
      await adapter.connect(cfg(TEST_URL));
      await adapter.disconnect();
      expect(mockEnd).toHaveBeenCalled();
    });

    it("is a no-op when not connected", async () => {
      await expect(adapter.disconnect()).resolves.toBeUndefined();
    });
  });

  // ── testConnection ─────────────────────────────────────────────────────────

  describe("testConnection", () => {
    it("returns healthy when query succeeds", async () => {
      await adapter.connect(cfg(TEST_URL));
      mockQuery.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] });
      const result = await adapter.testConnection();
      expect(result.status).toBe("healthy");
      expect(typeof result.latencyMs).toBe("number");
    });

    it("returns unreachable when query fails", async () => {
      await adapter.connect(cfg(TEST_URL));
      mockQuery.mockRejectedValueOnce(new Error("connection refused"));
      const result = await adapter.testConnection();
      expect(result.status).toBe("unreachable");
      expect(result.message).toContain("connection refused");
    });

    it("returns unreachable when not connected", async () => {
      const result = await adapter.testConnection();
      expect(result.status).toBe("unreachable");
      expect(result.message).toContain("call connect()");
    });
  });

  // ── createRecord ───────────────────────────────────────────────────────────

  describe("createRecord", () => {
    it("issues a parameterized INSERT RETURNING *", async () => {
      await adapter.connect(cfg(TEST_URL));
      const row = { id: "uuid-1", title: "Hello" };
      mockQuery.mockResolvedValueOnce({ rows: [row] });

      const result = await adapter.createRecord("posts", { title: "Hello" });

      expect(mockQuery).toHaveBeenCalledWith(
        'INSERT INTO "posts" ("title") VALUES ($1) RETURNING *',
        ["Hello"],
      );
      expect(result).toEqual(row);
    });

    it("handles multiple fields with correct placeholders", async () => {
      await adapter.connect(cfg(TEST_URL));
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "uuid-1", title: "A", slug: "a" }] });
      await adapter.createRecord("posts", { title: "A", slug: "a" });
      expect(mockQuery).toHaveBeenCalledWith(
        'INSERT INTO "posts" ("title", "slug") VALUES ($1, $2) RETURNING *',
        ["A", "a"],
      );
    });

    it("throws when data is empty", async () => {
      await adapter.connect(cfg(TEST_URL));
      await expect(adapter.createRecord("posts", {})).rejects.toThrow(
        "requires at least one field",
      );
    });
  });

  // ── findRecords ────────────────────────────────────────────────────────────

  describe("findRecords", () => {
    beforeEach(async () => {
      await adapter.connect(cfg(TEST_URL));
    });

    it("selects all without options", async () => {
      await adapter.findRecords("posts");
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM "posts"', []);
    });

    it("applies eq filter with parameterized value", async () => {
      await adapter.findRecords("posts", {
        filters: [{ field: "status", operator: "eq", value: "published" }],
      });
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM "posts" WHERE "status" = $1', [
        "published",
      ]);
    });

    it("applies contains filter with ILIKE wildcards", async () => {
      await adapter.findRecords("posts", {
        filters: [{ field: "title", operator: "contains", value: "hello" }],
      });
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM "posts" WHERE "title" ILIKE $1', [
        "%hello%",
      ]);
    });

    it("applies in filter with ANY", async () => {
      await adapter.findRecords("posts", {
        filters: [{ field: "status", operator: "in", value: ["draft", "published"] }],
      });
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM "posts" WHERE "status" = ANY($1)', [
        ["draft", "published"],
      ]);
    });

    it("applies sort", async () => {
      await adapter.findRecords("posts", {
        sort: [{ field: "createdAt", direction: "desc" }],
      });
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM "posts" ORDER BY "createdAt" DESC', []);
    });

    it("applies pagination with correct offset", async () => {
      await adapter.findRecords("posts", { pagination: { page: 2, limit: 10 } });
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM "posts" LIMIT $1 OFFSET $2', [10, 10]);
    });

    it("combines filter + sort + pagination with correct indices", async () => {
      await adapter.findRecords("posts", {
        filters: [{ field: "status", operator: "eq", value: "published" }],
        sort: [{ field: "createdAt", direction: "asc" }],
        pagination: { page: 3, limit: 5 },
      });
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM "posts" WHERE "status" = $1 ORDER BY "createdAt" ASC LIMIT $2 OFFSET $3',
        ["published", 5, 10],
      );
    });
  });

  // ── findRecordById ─────────────────────────────────────────────────────────

  describe("findRecordById", () => {
    it("returns the matching row", async () => {
      await adapter.connect(cfg(TEST_URL));
      const row = { id: "uuid-1", title: "Hello" };
      mockQuery.mockResolvedValueOnce({ rows: [row] });

      const result = await adapter.findRecordById("posts", "uuid-1");
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM "posts" WHERE "id" = $1', ["uuid-1"]);
      expect(result).toEqual(row);
    });

    it("returns null when not found", async () => {
      await adapter.connect(cfg(TEST_URL));
      mockQuery.mockResolvedValueOnce({ rows: [] });
      expect(await adapter.findRecordById("posts", "missing")).toBeNull();
    });
  });

  // ── updateRecord ───────────────────────────────────────────────────────────

  describe("updateRecord", () => {
    it("issues a parameterized UPDATE RETURNING *", async () => {
      await adapter.connect(cfg(TEST_URL));
      const row = { id: "uuid-1", title: "Updated" };
      mockQuery.mockResolvedValueOnce({ rows: [row] });

      const result = await adapter.updateRecord("posts", "uuid-1", { title: "Updated" });
      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE "posts" SET "title" = $1 WHERE "id" = $2 RETURNING *',
        ["Updated", "uuid-1"],
      );
      expect(result).toEqual(row);
    });

    it("throws when record not found", async () => {
      await adapter.connect(cfg(TEST_URL));
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await expect(adapter.updateRecord("posts", "missing", { title: "x" })).rejects.toThrow(
        'not found in "posts"',
      );
    });

    it("throws when data is empty", async () => {
      await adapter.connect(cfg(TEST_URL));
      await expect(adapter.updateRecord("posts", "uuid-1", {})).rejects.toThrow(
        "requires at least one field",
      );
    });
  });

  // ── deleteRecord ───────────────────────────────────────────────────────────

  describe("deleteRecord", () => {
    it("issues a parameterized DELETE", async () => {
      await adapter.connect(cfg(TEST_URL));
      await adapter.deleteRecord("posts", "uuid-1");
      expect(mockQuery).toHaveBeenCalledWith('DELETE FROM "posts" WHERE "id" = $1', ["uuid-1"]);
    });
  });

  // ── runMigration ───────────────────────────────────────────────────────────

  describe("runMigration", () => {
    it("executes migration.up and returns a success result", async () => {
      await adapter.connect(cfg(TEST_URL));
      const migration = {
        id: "mig-001",
        name: "Create users",
        up: 'CREATE TABLE "users" (id UUID);',
      };
      const result = await adapter.runMigration(migration);
      expect(mockQuery).toHaveBeenCalledWith(migration.up);
      expect(result.success).toBe(true);
      expect(result.migrationId).toBe("mig-001");
      expect(typeof result.durationMs).toBe("number");
    });

    it("returns a failure result without throwing", async () => {
      await adapter.connect(cfg(TEST_URL));
      mockQuery.mockRejectedValueOnce(new Error("syntax error"));
      const result = await adapter.runMigration({
        id: "mig-002",
        name: "Bad SQL",
        up: "INVALID SQL",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("syntax error");
    });
  });

  // ── collection operations ──────────────────────────────────────────────────

  describe("collection operations", () => {
    beforeEach(async () => {
      await adapter.connect(cfg(TEST_URL));
    });

    it("createCollection with no schema creates id-only table", async () => {
      await adapter.createCollection("articles");
      const sql = mockQuery.mock.calls.at(-1)![0] as string;
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS "articles"');
      expect(sql).toContain('"id" UUID PRIMARY KEY');
    });

    it("createCollection with schema includes typed columns", async () => {
      await adapter.createCollection("articles", {
        fields: [{ name: "title", type: "TEXT", required: true, unique: false }],
      });
      const sql = mockQuery.mock.calls.at(-1)![0] as string;
      expect(sql).toContain('"title" TEXT NOT NULL');
    });

    it("createCollection with unique field adds UNIQUE", async () => {
      await adapter.createCollection("articles", {
        fields: [{ name: "slug", type: "TEXT", unique: true }],
      });
      const sql = mockQuery.mock.calls.at(-1)![0] as string;
      expect(sql).toContain('"slug" TEXT UNIQUE');
    });

    it("updateCollection issues ADD COLUMN per field", async () => {
      await adapter.updateCollection("articles", {
        fields: [{ name: "slug", type: "TEXT" }],
      });
      expect(mockQuery).toHaveBeenCalledWith(
        'ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "slug" TEXT',
      );
    });

    it("deleteCollection drops the table", async () => {
      await adapter.deleteCollection("articles");
      expect(mockQuery).toHaveBeenCalledWith('DROP TABLE IF EXISTS "articles"');
    });
  });
});

// ── createMigrationFromCollectionPlan ─────────────────────────────────────────

describe("createMigrationFromCollectionPlan", () => {
  const plan: OryCMSCollectionMigrationPlan = {
    migrationId: "orycms_posts_20240101000000",
    generatedAt: "2024-01-01T00:00:00Z",
    collectionSlug: "posts",
    collectionName: "Posts",
    tableName: "posts",
    adapterType: "postgresql",
    schema: {
      collectionSlug: "posts",
      tableName: "posts",
      adapterType: "postgresql",
      fields: [],
      indexes: [],
    },
    operations: [
      {
        type: "CREATE_COLLECTION",
        target: "posts",
        upStatement: 'CREATE TABLE IF NOT EXISTS "posts" (id UUID);',
        downStatement: 'DROP TABLE IF EXISTS "posts";',
        reversible: true,
      },
      {
        type: "ADD_INDEX",
        target: "posts",
        upStatement: 'CREATE INDEX IF NOT EXISTS "idx_posts_slug" ON "posts" ("slug");',
        downStatement: 'DROP INDEX IF EXISTS "idx_posts_slug";',
        reversible: true,
      },
    ],
    warnings: [],
  };

  it("concatenates upStatements in order", () => {
    const m = createMigrationFromCollectionPlan(plan);
    expect(m.up).toBe(
      'CREATE TABLE IF NOT EXISTS "posts" (id UUID);\nCREATE INDEX IF NOT EXISTS "idx_posts_slug" ON "posts" ("slug");',
    );
  });

  it("reverses reversible downStatements for rollback", () => {
    const m = createMigrationFromCollectionPlan(plan);
    expect(m.down).toBe('DROP INDEX IF EXISTS "idx_posts_slug";\nDROP TABLE IF EXISTS "posts";');
  });

  it("sets id and name from the plan", () => {
    const m = createMigrationFromCollectionPlan(plan);
    expect(m.id).toBe("orycms_posts_20240101000000");
    expect(m.name).toBe("Posts (posts)");
  });

  it("omits operations with no upStatement", () => {
    const planWithEmpty: OryCMSCollectionMigrationPlan = {
      ...plan,
      operations: [
        { type: "CREATE_COLLECTION", target: "posts", reversible: false },
        {
          type: "ADD_INDEX",
          target: "posts",
          upStatement: "CREATE INDEX idx;",
          reversible: false,
        },
      ],
    };
    const m = createMigrationFromCollectionPlan(planWithEmpty);
    expect(m.up).toBe("CREATE INDEX idx;");
  });
});
