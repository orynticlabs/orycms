import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Pool } from "pg";

// Exercises content.engine.ts's own identifier quoting directly, independent of the
// schema validator that normally refuses a hostile table/field name before it is
// ever saved. getOryCMSCollection is mocked so a hostile definition can reach the
// engine the way it would if validation were ever bypassed upstream — this is the
// defence-in-depth layer, not the primary one.

const getOryCMSCollection = vi.fn();

vi.mock("@/schema", () => ({
  getOryCMSCollection: (...args: unknown[]) => getOryCMSCollection(...args),
}));

const {
  listOryCMSContentEntries,
  getOryCMSContentEntry,
  createOryCMSContentEntry,
  updateOryCMSContentEntry,
  deleteOryCMSContentEntry,
} = await import("../content.engine");

const HOSTILE_TABLE = 'posts"; DROP TABLE orycms_users; --';
const HOSTILE_FIELD = 'title"; DROP TABLE orycms_users; --';

function hostileCollection(overrides: Record<string, unknown> = {}) {
  return {
    name: "Posts",
    slug: "posts",
    tableName: HOSTILE_TABLE,
    labels: { singular: "Post", plural: "Posts" },
    fields: [{ name: HOSTILE_FIELD, type: "text" }],
    ...overrides,
  };
}

function makePool(impl: (sql: string, params?: unknown[]) => unknown): Pool {
  return { query: vi.fn(impl) } as unknown as Pool;
}

function assertFullyQuoted(sql: string, hostileName: string): void {
  const escaped = hostileName.replace(/"/g, '""');
  expect(sql).toContain(`"${escaped}"`);
}

beforeEach(() => {
  getOryCMSCollection.mockReset();
  getOryCMSCollection.mockReturnValue(hostileCollection());
});

describe("content.engine.ts — identifier quoting (defence in depth)", () => {
  it("quotes a hostile table name in the list query", async () => {
    let capturedSql = "";
    const pool = makePool((sql) => {
      capturedSql = sql;
      return sql.includes("COUNT") ? { rows: [{ count: "0" }] } : { rows: [] };
    });

    await listOryCMSContentEntries("posts", {}, pool);

    assertFullyQuoted(capturedSql, HOSTILE_TABLE);
  });

  it("quotes a hostile table name in the get-by-id query", async () => {
    let capturedSql = "";
    const pool = makePool((sql) => {
      capturedSql = sql;
      return { rows: [] };
    });

    await getOryCMSContentEntry("posts", "some-id", pool).catch(() => undefined);

    assertFullyQuoted(capturedSql, HOSTILE_TABLE);
  });

  it("quotes a hostile table name and a hostile field name in the insert", async () => {
    let capturedSql = "";
    const pool = makePool((sql) => {
      capturedSql = sql;
      return { rows: [{ id: "e1", createdAt: "now", updatedAt: "now" }] };
    });

    await createOryCMSContentEntry("posts", { data: { [HOSTILE_FIELD]: "value" } }, pool);

    assertFullyQuoted(capturedSql, HOSTILE_TABLE);
    assertFullyQuoted(capturedSql, HOSTILE_FIELD);
  });

  it("quotes a hostile table name and a hostile field name in the update", async () => {
    let callIdx = 0;
    const pool = makePool((sql) => {
      callIdx++;
      if (callIdx === 1) return { rows: [{ id: "e1", createdAt: "now", updatedAt: "now" }] };
      return { rows: [{ id: "e1", createdAt: "now", updatedAt: "now" }] };
    });
    const queryMock = pool.query as ReturnType<typeof vi.fn>;

    await updateOryCMSContentEntry("posts", "e1", { data: { [HOSTILE_FIELD]: "value" } }, pool);

    const updateSql = queryMock.mock.calls[1][0] as string;
    assertFullyQuoted(updateSql, HOSTILE_TABLE);
    assertFullyQuoted(updateSql, HOSTILE_FIELD);
  });

  it("quotes a hostile table name in the delete query", async () => {
    let callIdx = 0;
    const pool = makePool((sql) => {
      callIdx++;
      if (callIdx === 1) return { rows: [{ id: "e1", createdAt: "now", updatedAt: "now" }] };
      return { rows: [] };
    });
    const queryMock = pool.query as ReturnType<typeof vi.fn>;

    await deleteOryCMSContentEntry("posts", "e1", pool);

    const deleteSql = queryMock.mock.calls[1][0] as string;
    assertFullyQuoted(deleteSql, HOSTILE_TABLE);
  });
});
