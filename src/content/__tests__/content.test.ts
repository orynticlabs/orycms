import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Pool } from "pg";
import {
  listOryCMSContentEntries,
  getOryCMSContentEntry,
  createOryCMSContentEntry,
  updateOryCMSContentEntry,
  deleteOryCMSContentEntry,
  publishOryCMSContentEntry,
  unpublishOryCMSContentEntry,
} from "../content.engine";
import { validateOryCMSContentData, stripOryCMSPrivateFields } from "../content.validator";
import { OryCMSContentError } from "../content.errors";
import { registerOryCMSCollection, clearOryCMSRegistry } from "@/schema/schema.engine";
import type { OryCMSCollectionDefinition } from "@/schema/collection.schema";

// ── Test collections ──────────────────────────────────────────────────────────

const POSTS_COLLECTION: OryCMSCollectionDefinition = {
  name: "Blog Posts",
  slug: "blog-posts",
  tableName: "blog_posts",
  labels: { singular: "Post", plural: "Posts" },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "body", type: "textarea" },
    {
      name: "status",
      type: "select",
      required: true,
      options: [
        { label: "Draft", value: "draft" },
        { label: "Pub", value: "published" },
      ],
    },
    { name: "secret", type: "text", private: true },
  ],
  timestamps: { enabled: true },
};

const DRAFT_COLLECTION: OryCMSCollectionDefinition = {
  name: "Articles",
  slug: "articles",
  tableName: "articles",
  labels: { singular: "Article", plural: "Articles" },
  fields: [{ name: "title", type: "text", required: true }],
  draft: { enabled: true },
  timestamps: { enabled: true },
};

// ── Mock pool factory ─────────────────────────────────────────────────────────

const NOW = "2024-01-01T00:00:00.000Z";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry-uuid",
    title: "Hello",
    body: "World",
    status: "draft",
    secret: "hidden",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makePool(impl: (sql: string, params?: unknown[]) => unknown): Pool {
  return { query: vi.fn(impl) } as unknown as Pool;
}

// ── Setup/teardown ────────────────────────────────────────────────────────────

beforeEach(() => {
  clearOryCMSRegistry();
  registerOryCMSCollection(POSTS_COLLECTION);
  registerOryCMSCollection(DRAFT_COLLECTION);
});

afterEach(() => {
  clearOryCMSRegistry();
});

// ── validateOryCMSContentData ─────────────────────────────────────────────────

describe("validateOryCMSContentData", () => {
  it("passes valid data", () => {
    expect(() =>
      validateOryCMSContentData(POSTS_COLLECTION, { title: "Hi", status: "draft" }, true),
    ).not.toThrow();
  });

  it("throws FIELD_UNKNOWN for unrecognised keys", () => {
    expect(() =>
      validateOryCMSContentData(
        POSTS_COLLECTION,
        { title: "Hi", status: "draft", ghost: "x" },
        false,
      ),
    ).toThrow(expect.objectContaining({ code: "FIELD_UNKNOWN", field: "ghost" }));
  });

  it("throws FIELD_REQUIRED on create when required field missing", () => {
    expect(() => validateOryCMSContentData(POSTS_COLLECTION, { body: "text" }, true)).toThrow(
      expect.objectContaining({ code: "FIELD_REQUIRED", field: "title" }),
    );
  });

  it("does not enforce required fields on partial update", () => {
    expect(() =>
      validateOryCMSContentData(POSTS_COLLECTION, { body: "text" }, false),
    ).not.toThrow();
  });

  it("throws FIELD_INVALID for wrong number type", () => {
    const numCol = registerOryCMSCollection({
      name: "Numbers",
      slug: "numbers",
      labels: { singular: "N", plural: "N" },
      fields: [{ name: "count", type: "number" }],
    });
    expect(() => validateOryCMSContentData(numCol, { count: "not-a-number" }, false)).toThrow(
      expect.objectContaining({ code: "FIELD_INVALID", field: "count" }),
    );
  });

  it("throws FIELD_INVALID for invalid select value", () => {
    expect(() =>
      validateOryCMSContentData(POSTS_COLLECTION, { title: "Hi", status: "unknown-value" }, false),
    ).toThrow(expect.objectContaining({ code: "FIELD_INVALID", field: "status" }));
  });

  it("throws FIELD_INVALID for invalid email format", () => {
    const emailCol = registerOryCMSCollection({
      name: "Contacts",
      slug: "contacts",
      labels: { singular: "C", plural: "C" },
      fields: [{ name: "email", type: "email", required: true }],
    });
    expect(() => validateOryCMSContentData(emailCol, { email: "not-an-email" }, false)).toThrow(
      expect.objectContaining({ code: "FIELD_INVALID", field: "email" }),
    );
  });
});

// ── stripOryCMSPrivateFields ──────────────────────────────────────────────────

describe("stripOryCMSPrivateFields", () => {
  it("removes private fields", () => {
    const result = stripOryCMSPrivateFields(POSTS_COLLECTION, { title: "Hi", secret: "x" });
    expect(result).not.toHaveProperty("secret");
    expect(result).toHaveProperty("title");
  });

  it("returns original object when no private fields", () => {
    const data = { title: "Hi" };
    const result = stripOryCMSPrivateFields(POSTS_COLLECTION, data);
    expect(result).toHaveProperty("title");
    expect(result).not.toHaveProperty("secret");
  });
});

// ── listOryCMSContentEntries ──────────────────────────────────────────────────

describe("listOryCMSContentEntries", () => {
  it("returns paginated entries without private fields", async () => {
    let callIdx = 0;
    const pool = makePool(() => {
      callIdx++;
      if (callIdx === 1) return { rows: [{ count: "2" }] };
      return { rows: [row(), row({ id: "entry-2" })] };
    });

    const result = await listOryCMSContentEntries("blog-posts", {}, pool);

    expect(result.data).toHaveLength(2);
    expect(result.meta.total).toBe(2);
    expect(result.data[0]).not.toHaveProperty("data.secret");
  });

  it("throws COLLECTION_NOT_FOUND for unknown slug", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await expect(listOryCMSContentEntries("no-such", {}, pool)).rejects.toMatchObject({
      code: "COLLECTION_NOT_FOUND",
      statusCode: 404,
    });
  });

  it("applies draft filter when includeDrafts is false and collection has drafts", async () => {
    let capturedSql = "";
    const pool = makePool((sql: string) => {
      capturedSql += sql;
      return { rows: [{ count: "0" }] };
    });
    await listOryCMSContentEntries("articles", { includeDrafts: false }, pool);
    expect(capturedSql).toContain("_isDraft");
  });

  it("does not apply draft filter when includeDrafts is true", async () => {
    let capturedSql = "";
    const pool = makePool((sql: string) => {
      capturedSql += sql;
      return { rows: [{ count: "0" }] };
    });
    await listOryCMSContentEntries("articles", { includeDrafts: true }, pool);
    // COUNT query should not contain _isDraft filter
    const countSql = capturedSql.split("SELECT *")[0];
    expect(countSql).not.toContain("_isDraft");
  });

  it("respects page and limit", async () => {
    let capturedParams: unknown[] = [];
    let callIdx = 0;
    const pool = makePool((_sql: string, params?: unknown[]) => {
      callIdx++;
      if (callIdx === 2) capturedParams = params ?? [];
      return { rows: [{ count: "100" }] };
    });
    await listOryCMSContentEntries("blog-posts", { page: 3, limit: 10 }, pool);
    // LIMIT=10 OFFSET=20
    expect(capturedParams).toContain(10);
    expect(capturedParams).toContain(20);
  });
});

// ── getOryCMSContentEntry ─────────────────────────────────────────────────────

describe("getOryCMSContentEntry", () => {
  it("returns entry with private fields stripped", async () => {
    const pool = makePool(() => ({ rows: [row()] }));
    const entry = await getOryCMSContentEntry("blog-posts", "entry-uuid", pool);
    expect(entry.id).toBe("entry-uuid");
    expect(entry.data).not.toHaveProperty("secret");
  });

  it("throws ENTRY_NOT_FOUND for missing id", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await expect(getOryCMSContentEntry("blog-posts", "missing", pool)).rejects.toMatchObject({
      code: "ENTRY_NOT_FOUND",
      statusCode: 404,
    });
  });

  it("throws COLLECTION_NOT_FOUND for unknown collection", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await expect(getOryCMSContentEntry("ghost", "id", pool)).rejects.toMatchObject({
      code: "COLLECTION_NOT_FOUND",
    });
  });
});

// ── createOryCMSContentEntry ──────────────────────────────────────────────────

describe("createOryCMSContentEntry", () => {
  it("inserts and returns created entry", async () => {
    const pool = makePool(() => ({ rows: [row()] }));
    const entry = await createOryCMSContentEntry(
      "blog-posts",
      { data: { title: "Hi", status: "draft" } },
      pool,
    );
    expect(entry.id).toBe("entry-uuid");
    expect(pool.query as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1);
  });

  it("throws FIELD_REQUIRED when required field missing", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await expect(
      createOryCMSContentEntry("blog-posts", { data: { body: "text" } }, pool),
    ).rejects.toMatchObject({ code: "FIELD_REQUIRED" });
  });

  it("throws FIELD_UNKNOWN for unrecognised fields", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await expect(
      createOryCMSContentEntry(
        "blog-posts",
        { data: { title: "Hi", status: "draft", ghost: "x" } },
        pool,
      ),
    ).rejects.toMatchObject({ code: "FIELD_UNKNOWN" });
  });

  it("includes _isDraft column for draft-enabled collections", async () => {
    let capturedSql = "";
    const pool = makePool((sql: string) => {
      capturedSql = sql;
      return { rows: [{ id: "u", title: "Hi", createdAt: NOW, updatedAt: NOW }] };
    });
    await createOryCMSContentEntry("articles", { data: { title: "Hi" }, asDraft: true }, pool);
    expect(capturedSql).toContain("_isDraft");
  });
});

// ── updateOryCMSContentEntry ──────────────────────────────────────────────────

describe("updateOryCMSContentEntry", () => {
  it("updates and returns entry", async () => {
    let callIdx = 0;
    const pool = makePool(() => {
      callIdx++;
      if (callIdx === 1) return { rows: [row()] }; // getOryCMSContentEntry check
      return { rows: [row({ title: "Updated" })] };
    });

    const entry = await updateOryCMSContentEntry(
      "blog-posts",
      "entry-uuid",
      { data: { title: "Updated" } },
      pool,
    );
    expect(entry.data).toMatchObject({ title: "Updated" });
  });

  it("throws FIELD_UNKNOWN for unknown fields", async () => {
    const pool = makePool(() => ({ rows: [row()] }));
    await expect(
      updateOryCMSContentEntry("blog-posts", "entry-uuid", { data: { ghost: "x" } }, pool),
    ).rejects.toMatchObject({ code: "FIELD_UNKNOWN" });
  });

  it("throws ENTRY_NOT_FOUND when entry missing", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await expect(
      updateOryCMSContentEntry("blog-posts", "missing", { data: { title: "x" } }, pool),
    ).rejects.toMatchObject({ code: "ENTRY_NOT_FOUND" });
  });

  it("throws FIELD_REQUIRED when data is empty", async () => {
    const pool = makePool(() => ({ rows: [row()] }));
    await expect(
      updateOryCMSContentEntry("blog-posts", "entry-uuid", { data: {} }, pool),
    ).rejects.toMatchObject({ code: "FIELD_REQUIRED" });
  });
});

// ── deleteOryCMSContentEntry ──────────────────────────────────────────────────

describe("deleteOryCMSContentEntry", () => {
  it("deletes entry", async () => {
    let callIdx = 0;
    const pool = makePool(() => {
      callIdx++;
      if (callIdx === 1) return { rows: [row()] };
      return { rows: [] };
    });
    await expect(
      deleteOryCMSContentEntry("blog-posts", "entry-uuid", pool),
    ).resolves.toBeUndefined();
    expect(callIdx).toBe(2);
  });

  it("throws ENTRY_NOT_FOUND when entry missing", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await expect(deleteOryCMSContentEntry("blog-posts", "missing", pool)).rejects.toMatchObject({
      code: "ENTRY_NOT_FOUND",
    });
  });
});

// ── publishOryCMSContentEntry ─────────────────────────────────────────────────

describe("publishOryCMSContentEntry", () => {
  it("publishes a draft entry", async () => {
    let callIdx = 0;
    const pool = makePool(() => {
      callIdx++;
      if (callIdx === 1) return { rows: [{ ...row(), _isDraft: true }] };
      return { rows: [{ ...row(), _isDraft: false, _publishedAt: NOW }] };
    });
    const entry = await publishOryCMSContentEntry("articles", "entry-uuid", pool);
    expect(entry.status).toBe("published");
    expect(entry.publishedAt).toBeDefined();
  });

  it("throws ALREADY_PUBLISHED when already published", async () => {
    const pool = makePool(() => ({ rows: [{ ...row(), _isDraft: false }] }));
    await expect(publishOryCMSContentEntry("articles", "entry-uuid", pool)).rejects.toMatchObject({
      code: "ALREADY_PUBLISHED",
      statusCode: 409,
    });
  });

  it("throws when collection has no draft workflow (status always published, so ALREADY_PUBLISHED)", async () => {
    // blog-posts has no draft config → rowToEntry always returns status "published"
    // so publish hits ALREADY_PUBLISHED before WRITE_FORBIDDEN
    const pool = makePool(() => ({ rows: [row()] }));
    await expect(publishOryCMSContentEntry("blog-posts", "entry-uuid", pool)).rejects.toMatchObject(
      {
        code: "ALREADY_PUBLISHED",
      },
    );
  });
});

// ── unpublishOryCMSContentEntry ───────────────────────────────────────────────

describe("unpublishOryCMSContentEntry", () => {
  it("unpublishes a published entry", async () => {
    let callIdx = 0;
    const pool = makePool(() => {
      callIdx++;
      if (callIdx === 1) return { rows: [{ ...row(), _isDraft: false }] };
      return { rows: [{ ...row(), _isDraft: true }] };
    });
    const entry = await unpublishOryCMSContentEntry("articles", "entry-uuid", pool);
    expect(entry.status).toBe("draft");
  });

  it("throws NOT_PUBLISHED when entry is already a draft", async () => {
    const pool = makePool(() => ({ rows: [{ ...row(), _isDraft: true }] }));
    await expect(unpublishOryCMSContentEntry("articles", "entry-uuid", pool)).rejects.toMatchObject(
      {
        code: "NOT_PUBLISHED",
        statusCode: 409,
      },
    );
  });

  it("throws WRITE_FORBIDDEN when collection has no draft workflow", async () => {
    const pool = makePool(() => ({ rows: [row()] }));
    await expect(
      unpublishOryCMSContentEntry("blog-posts", "entry-uuid", pool),
    ).rejects.toMatchObject({
      code: "WRITE_FORBIDDEN",
    });
  });
});

// ── OryCMSContentError ────────────────────────────────────────────────────────

describe("OryCMSContentError", () => {
  it("is an instance of Error", () => {
    const e = new OryCMSContentError("ENTRY_NOT_FOUND", "msg", 404);
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe("ENTRY_NOT_FOUND");
    expect(e.statusCode).toBe(404);
    expect(e.name).toBe("OryCMSContentError");
  });
});
