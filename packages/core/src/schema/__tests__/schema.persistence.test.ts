import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool, PoolClient } from "pg";
import {
  clearOryCMSRegistry,
  getOryCMSCollection,
  listOryCMSCollections,
  registerOryCMSCollection,
} from "../schema.engine";
import {
  deleteOryCMSPersistedCollection,
  listOryCMSPersistedCollections,
  loadOryCMSCollectionsIntoRegistry,
  OryCMSCollectionPersistenceError,
  saveOryCMSCollectionSchema,
  updateOryCMSPersistedCollection,
} from "../schema.persistence";
import type { OryCMSCollectionDefinition } from "../collection.schema";

const POSTS_COLLECTION: OryCMSCollectionDefinition = {
  name: "Blog Posts",
  slug: "blog-posts",
  tableName: "blog_posts",
  labels: { singular: "Post", plural: "Posts", menu: "Blog" },
  description: "Editorial posts",
  fields: [
    { name: "title", type: "text", required: true, unique: true },
    {
      name: "status",
      type: "select",
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Published", value: "published" },
      ],
    },
  ],
  timestamps: { enabled: true },
  draft: { enabled: true },
  seo: { enabled: true, titleField: "title" },
  access: { create: ["Owner", "Admin"] },
};

type QueryResult = { rows: unknown[] };

function result(rows: unknown[] = []): QueryResult {
  return { rows };
}

function makePool({
  poolQuery,
  clientQuery,
}: {
  poolQuery?: (sql: string, params?: unknown[]) => QueryResult;
  clientQuery: (sql: string, params?: unknown[]) => QueryResult;
}) {
  const client = {
    query: vi.fn((sql: string, params?: unknown[]) => clientQuery(sql, params)),
    release: vi.fn(),
  } as unknown as PoolClient & {
    query: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
  };
  const pool = {
    query: vi.fn((sql: string, params?: unknown[]) => poolQuery?.(sql, params) ?? result()),
    connect: vi.fn(async () => client),
  } as unknown as Pool & { query: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn> };

  return { pool, client };
}

describe("collection schema persistence", () => {
  beforeEach(() => {
    clearOryCMSRegistry();
  });

  it("persists a new collection and fields inside a transaction", async () => {
    const { pool, client } = makePool({
      clientQuery: (sql) => {
        if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return result();
        if (sql.includes("SELECT id FROM orycms_collections")) return result();
        if (sql.includes("INSERT INTO orycms_collections"))
          return result([{ id: "collection-id" }]);
        if (sql.includes("INSERT INTO orycms_collection_fields")) return result();
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    });

    await expect(saveOryCMSCollectionSchema(POSTS_COLLECTION, pool)).resolves.toEqual(
      POSTS_COLLECTION,
    );

    expect(client.query).toHaveBeenCalledWith("BEGIN");
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.query).not.toHaveBeenCalledWith("ROLLBACK");
    expect(
      client.query.mock.calls.filter(([sql]) =>
        String(sql).includes("INSERT INTO orycms_collection_fields"),
      ),
    ).toHaveLength(POSTS_COLLECTION.fields.length);
    expect(getOryCMSCollection("blog-posts")).toEqual(POSTS_COLLECTION);
  });

  it("updates collection and replaces field rows in a transaction", async () => {
    const updated = { ...POSTS_COLLECTION, name: "Articles" };
    const { pool, client } = makePool({
      clientQuery: (sql) => {
        if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return result();
        if (sql.includes("SELECT id FROM orycms_collections"))
          return result([{ id: "collection-id" }]);
        if (sql.includes("UPDATE orycms_collections")) return result();
        if (sql.includes("DELETE FROM orycms_collection_fields")) return result();
        if (sql.includes("INSERT INTO orycms_collection_fields")) return result();
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    });

    await expect(updateOryCMSPersistedCollection("blog-posts", updated, pool)).resolves.toEqual(
      updated,
    );

    expect(client.query).toHaveBeenCalledWith("BEGIN");
    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes("DELETE FROM orycms_collection_fields"),
      ),
    ).toBe(true);
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(getOryCMSCollection("blog-posts")?.name).toBe("Articles");
  });

  it("deletes persisted collection rows and removes the registry entry", async () => {
    registerOryCMSCollection(POSTS_COLLECTION);
    const { pool, client } = makePool({
      clientQuery: (sql) => {
        if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return result();
        if (sql.includes("SELECT id FROM orycms_collections"))
          return result([{ id: "collection-id" }]);
        if (sql.includes("DELETE FROM orycms_collection_fields")) return result();
        if (sql.includes("DELETE FROM orycms_collections")) return result();
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    });

    await deleteOryCMSPersistedCollection("blog-posts", pool);

    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(getOryCMSCollection("blog-posts")).toBeNull();
  });

  it("prevents duplicate slugs before saving", async () => {
    const { pool, client } = makePool({
      poolQuery: (sql) => {
        if (sql.includes("SELECT id, name")) {
          return result([
            { id: "existing-id", collectionSlug: "blog-posts", schemaJson: POSTS_COLLECTION },
          ]);
        }
        if (sql.includes("SELECT name")) return result();
        return result();
      },
      clientQuery: (sql) => {
        if (sql === "BEGIN" || sql === "ROLLBACK") return result();
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    });

    await expect(saveOryCMSCollectionSchema(POSTS_COLLECTION, pool)).rejects.toMatchObject({
      code: "SCHEMA_VALIDATION_ERROR",
    });
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
  });

  it("loads persisted schemas into the registry after restart", async () => {
    const { pool } = makePool({
      poolQuery: (sql) => {
        if (sql.includes("SELECT id, name")) {
          return result([
            { id: "collection-id", collectionSlug: "blog-posts", schemaJson: POSTS_COLLECTION },
          ]);
        }
        if (sql.includes("SELECT name")) return result();
        return result();
      },
      clientQuery: () => result(),
    });

    expect(listOryCMSCollections()).toHaveLength(0);
    await expect(loadOryCMSCollectionsIntoRegistry(pool)).resolves.toEqual([POSTS_COLLECTION]);
    expect(getOryCMSCollection("blog-posts")).toEqual(POSTS_COLLECTION);
  });

  it("rolls back the transaction when field persistence fails", async () => {
    const { pool, client } = makePool({
      clientQuery: (sql) => {
        if (sql === "BEGIN" || sql === "ROLLBACK") return result();
        if (sql.includes("SELECT id FROM orycms_collections")) return result();
        if (sql.includes("INSERT INTO orycms_collections"))
          return result([{ id: "collection-id" }]);
        if (sql.includes("INSERT INTO orycms_collection_fields")) {
          throw new Error("field insert failed");
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    });

    await expect(saveOryCMSCollectionSchema(POSTS_COLLECTION, pool)).rejects.toThrow(
      "field insert failed",
    );
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.query).not.toHaveBeenCalledWith("COMMIT");
    expect(getOryCMSCollection("blog-posts")).toBeNull();
  });

  it("lists persisted collections from schemaJson", async () => {
    const { pool } = makePool({
      poolQuery: (sql) => {
        if (sql.includes("SELECT id, name")) {
          return result([
            { id: "collection-id", collectionSlug: "blog-posts", schemaJson: POSTS_COLLECTION },
          ]);
        }
        if (sql.includes("SELECT name")) return result();
        return result();
      },
      clientQuery: () => result(),
    });

    await expect(listOryCMSPersistedCollections(pool)).resolves.toEqual([POSTS_COLLECTION]);
  });
});
