import { describe, it, expect } from "vitest";
import { generateOryCMSCollectionMigrationPlan } from "../migration.planner";
import type { OryCMSCollectionDefinition } from "@/schema";

// These exercise the generator directly, with a collection definition crafted by
// hand rather than produced by the schema validator. The validator refuses a name
// like this before it is ever saved (see schema.validator.test.ts), so this is a
// second, independent line of defence: even a hostile name that somehow reached
// this generator must come out fully quoted in the SQL text, never able to close
// the identifier and add anything of its own.

function baseCollection(
  overrides: Partial<OryCMSCollectionDefinition> = {},
): OryCMSCollectionDefinition {
  return {
    name: "Posts",
    slug: "posts",
    labels: { singular: "Post", plural: "Posts" },
    fields: [{ name: "title", type: "text" }],
    ...overrides,
  };
}

describe("generateOryCMSCollectionMigrationPlan — identifier quoting", () => {
  it("fully quotes a hostile table name in the CREATE TABLE statement", () => {
    const hostileTable = 'foo"; DROP TABLE orycms_users; --';
    const collection = baseCollection({ tableName: hostileTable });

    const plan = generateOryCMSCollectionMigrationPlan(collection, "postgresql");
    const createOp = plan.operations.find((op) => op.type === "CREATE_COLLECTION");

    expect(createOp).toBeDefined();
    const sql = createOp!.upStatement;
    // The only occurrence of a lone, unescaped quote is the opening/closing pair
    // the identifier is wrapped in; every quote that was part of the hostile name
    // must appear doubled.
    expect(sql).toContain('"foo""; DROP TABLE orycms_users; --"');
    expect(sql).not.toMatch(/[^"]"[^"]*DROP TABLE orycms_users[^"]*"[^"]/);
  });

  it("fully quotes a hostile field name in the CREATE TABLE statement", () => {
    const hostileField = 'title"; DROP TABLE orycms_users; --';
    const collection = baseCollection({
      fields: [{ name: hostileField, type: "text" }],
    });

    const plan = generateOryCMSCollectionMigrationPlan(collection, "postgresql");
    const createOp = plan.operations.find((op) => op.type === "CREATE_COLLECTION");

    expect(createOp!.upStatement).toContain('"title""; DROP TABLE orycms_users; --"');
  });

  it("fully quotes a hostile table name in the DROP TABLE (down) statement", () => {
    const hostileTable = 'foo" CASCADE; DROP TABLE orycms_users; --';
    const collection = baseCollection({ tableName: hostileTable });

    const plan = generateOryCMSCollectionMigrationPlan(collection, "postgresql");
    const createOp = plan.operations.find((op) => op.type === "CREATE_COLLECTION");

    expect(createOp!.downStatement).toContain('"foo"" CASCADE; DROP TABLE orycms_users; --"');
  });

  it("fully quotes a hostile index name and table name together", () => {
    const hostileTable = 'posts"; --';
    const collection = baseCollection({
      tableName: hostileTable,
      fields: [
        { name: "slug", type: "slug", sourceField: "title" },
        { name: "title", type: "text" },
      ],
    });

    const plan = generateOryCMSCollectionMigrationPlan(collection, "postgresql");
    const indexOp = plan.operations.find((op) => op.type === "ADD_INDEX");

    expect(indexOp).toBeDefined();
    expect(indexOp!.upStatement).toContain('"posts""; --"');
  });

  it("escapes with backticks for mysql, not double quotes", () => {
    const hostileTable = "foo`; DROP TABLE orycms_users; --";
    const collection = baseCollection({ tableName: hostileTable });

    const plan = generateOryCMSCollectionMigrationPlan(collection, "mysql");
    const createOp = plan.operations.find((op) => op.type === "CREATE_COLLECTION");

    expect(createOp!.upStatement).toContain("`foo``; DROP TABLE orycms_users; --`");
  });
});
