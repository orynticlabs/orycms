import { describe, it, expect } from "vitest";
import { validateOryCMSCollectionSchema } from "../schema.validator";
import type { OryCMSCollectionDefinition } from "../collection.schema";

function base(overrides: Partial<OryCMSCollectionDefinition> = {}): unknown {
  return {
    name: "Posts",
    slug: "posts",
    labels: { singular: "Post", plural: "Posts" },
    fields: [{ name: "title", type: "text" }],
    ...overrides,
  };
}

function codesOf(result: ReturnType<typeof validateOryCMSCollectionSchema>): string[] {
  return result.issues.map((issue) => issue.code);
}

describe("validateOryCMSCollectionSchema — table name", () => {
  it("accepts a definition with no tableName override (derives one from the slug)", () => {
    const result = validateOryCMSCollectionSchema(base());
    expect(result.valid).toBe(true);
  });

  it("accepts a safe explicit tableName", () => {
    const result = validateOryCMSCollectionSchema(base({ tableName: "my_posts_table" }));
    expect(result.valid).toBe(true);
  });

  it.each([
    ['foo"; DROP TABLE orycms_users; --', "embedded double quote and semicolon"],
    ["foo`; DROP TABLE orycms_users; --", "embedded backtick"],
    ["foo bar", "embedded space"],
    ["foo-bar", "embedded hyphen"],
    ["foo/*comment*/bar", "SQL comment marker"],
    ["1foo", "starts with a digit"],
    ["", "empty string"],
    ["café", "unicode letter outside A-Z"],
    ["a".repeat(64), "64 characters, one over the limit"],
  ])("refuses a tableName of %j (%s)", (hostile) => {
    const result = validateOryCMSCollectionSchema(base({ tableName: hostile }));
    expect(result.valid).toBe(false);
    expect(codesOf(result)).toContain("INVALID_TABLE_NAME_FORMAT");
  });

  it("accepts a tableName of exactly 63 characters", () => {
    const result = validateOryCMSCollectionSchema(base({ tableName: "a".repeat(63) }));
    expect(result.valid).toBe(true);
  });

  it("refuses a tableName under the reserved orycms_ prefix", () => {
    const result = validateOryCMSCollectionSchema(base({ tableName: "orycms_evil" }));
    expect(result.valid).toBe(false);
    expect(codesOf(result)).toContain("RESERVED_TABLE_NAME");
  });

  it("refuses a slug that itself resolves to an orycms_-prefixed table name", () => {
    // No explicit tableName — "orycms-evil" would resolve to "orycms_evil".
    const result = validateOryCMSCollectionSchema(
      base({ slug: "orycms-evil", tableName: undefined }),
    );
    expect(result.valid).toBe(false);
    expect(codesOf(result)).toContain("RESERVED_TABLE_NAME");
  });

  it("allows the orycms_ prefix when allowCoreTablePrefix is set (this library's own collections)", () => {
    const result = validateOryCMSCollectionSchema(base({ tableName: "orycms_migrations" }), {
      allowCoreTablePrefix: true,
    });
    expect(result.valid).toBe(true);
  });

  it("refuses a tableName already used by another registered collection", () => {
    const result = validateOryCMSCollectionSchema(base({ tableName: "shared_table" }), {
      registeredTableNames: new Set(["shared_table"]),
    });
    expect(result.valid).toBe(false);
    expect(codesOf(result)).toContain("DUPLICATE_TABLE_NAME");
  });

  it("the duplicate-table-name check is case-insensitive", () => {
    const result = validateOryCMSCollectionSchema(base({ tableName: "Shared_Table" }), {
      registeredTableNames: new Set(["shared_table"]),
    });
    expect(result.valid).toBe(false);
    expect(codesOf(result)).toContain("DUPLICATE_TABLE_NAME");
  });

  it("does not flag a tableName as duplicate against itself when updating the same collection", () => {
    // registeredTableNames excludes the collection's own current table name,
    // mirroring how the persistence layer builds this set (see schema.persistence.ts).
    const result = validateOryCMSCollectionSchema(base({ tableName: "my_table" }), {
      registeredTableNames: new Set(),
    });
    expect(result.valid).toBe(true);
  });
});

describe("validateOryCMSCollectionSchema — field names", () => {
  it.each([
    ['title"; DROP TABLE orycms_users; --', "embedded double quote and semicolon"],
    ["title bar", "embedded space"],
    ["1title", "starts with a digit"],
    ["café", "unicode letter outside A-Z"],
    ["a".repeat(64), "64 characters, one over the limit"],
  ])("refuses a field name of %j (%s)", (hostile) => {
    const result = validateOryCMSCollectionSchema(
      base({ fields: [{ name: hostile, type: "text" }] }),
    );
    expect(result.valid).toBe(false);
    expect(codesOf(result)).toContain("INVALID_FIELD_NAME_FORMAT");
  });

  it("refuses an empty-string field name (reported as missing, not as a format error)", () => {
    const result = validateOryCMSCollectionSchema(base({ fields: [{ name: "", type: "text" }] }));
    expect(result.valid).toBe(false);
    expect(codesOf(result)).toContain("MISSING_FIELD_NAME");
  });

  it.each(["id", "createdAt", "updatedAt", "_isDraft", "_publishedAt", "_seoTitle"])(
    "refuses a field named %j (clashes with a system column)",
    (systemName) => {
      const result = validateOryCMSCollectionSchema(
        base({ fields: [{ name: systemName, type: "text" }] }),
      );
      expect(result.valid).toBe(false);
      expect(codesOf(result)).toContain("SYSTEM_FIELD_NAME");
    },
  );

  it("accepts ordinary camelCase and snake_case field names", () => {
    const result = validateOryCMSCollectionSchema(
      base({
        fields: [
          { name: "firstName", type: "text" },
          { name: "last_name", type: "text" },
          { name: "_private", type: "text" },
        ],
      }),
    );
    expect(result.valid).toBe(true);
  });

  it("does not reject common words that are SQL reserved words when safely quoted (e.g. 'order', 'key')", () => {
    // Quoting (not a reserved-word blocklist) is what keeps these safe — see
    // sql-identifier.test.ts and migration.planner.test.ts for the quoting proof.
    const result = validateOryCMSCollectionSchema(
      base({
        fields: [
          { name: "order", type: "text" },
          { name: "key", type: "text" },
        ],
      }),
    );
    expect(result.valid).toBe(true);
  });
});
