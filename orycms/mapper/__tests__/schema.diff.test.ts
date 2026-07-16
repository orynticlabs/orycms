import { describe, expect, it } from "vitest";
import { mapOryCMSCollectionToDatabaseSchema } from "../collection.mapper";
import {
  compareOryCMSCollectionSchema,
  validateOryCMSMigrationSafety,
  type OryCMSActualPostgreSQLSchema,
} from "../schema.diff";
import type { OryCMSCollectionDefinition } from "@/schema";

const BASE_COLLECTION: OryCMSCollectionDefinition = {
  name: "Blog Posts",
  slug: "blog-posts",
  tableName: "blog_posts",
  labels: { singular: "Post", plural: "Posts" },
  fields: [
    { name: "title", type: "text", required: true, unique: true },
    { name: "body", type: "textarea" },
  ],
  timestamps: { enabled: true },
};

function expected(collection: OryCMSCollectionDefinition = BASE_COLLECTION) {
  return mapOryCMSCollectionToDatabaseSchema(collection, "postgresql");
}

function actual(
  overrides: Partial<OryCMSActualPostgreSQLSchema> = {},
): OryCMSActualPostgreSQLSchema {
  return {
    tableName: "blog_posts",
    exists: true,
    fields: [
      { name: "id", nativeType: "uuid", nullable: false },
      { name: "title", nativeType: "character varying(255)", nullable: false },
      { name: "createdAt", nativeType: "timestamp with time zone", nullable: false },
      { name: "updatedAt", nativeType: "timestamp with time zone", nullable: false },
    ],
    indexes: [{ name: "idx_blog_posts_title_unique", fields: ["title"], unique: true }],
    foreignKeys: [],
    ...overrides,
  };
}

describe("schema diff and migration safety", () => {
  it("detects safe added fields and missing indexes", () => {
    const operations = compareOryCMSCollectionSchema(expected(), actual());

    expect(operations.map((operation) => operation.type)).toEqual(
      expect.arrayContaining(["ADD_FIELD"]),
    );
    expect(operations.find((operation) => operation.fieldName === "body")).toMatchObject({
      type: "ADD_FIELD",
      destructive: false,
      unsafe: false,
    });
    expect(validateOryCMSMigrationSafety(operations).safe).toBe(true);
  });

  it("warns clearly for removed fields", () => {
    const operations = compareOryCMSCollectionSchema(
      expected(),
      actual({
        fields: [
          ...actual().fields,
          { name: "body", nativeType: "text", nullable: true },
          { name: "legacyTitle", nativeType: "text", nullable: true },
        ],
      }),
    );

    const removal = operations.find((operation) => operation.type === "REMOVE_FIELD");
    expect(removal).toMatchObject({
      fieldName: "legacyTitle",
      destructive: true,
      unsafe: false,
    });
    expect(removal?.warnings[0]).toContain("removes stored data");
    expect(validateOryCMSMigrationSafety(operations).safe).toBe(true);
  });

  it("blocks unsafe type changes", () => {
    const operations = compareOryCMSCollectionSchema(
      expected(),
      actual({
        fields: [
          { name: "id", nativeType: "uuid", nullable: false },
          { name: "title", nativeType: "numeric(10,2)", nullable: false },
          { name: "body", nativeType: "text", nullable: true },
          { name: "createdAt", nativeType: "timestamp with time zone", nullable: false },
          { name: "updatedAt", nativeType: "timestamp with time zone", nullable: false },
        ],
      }),
    );

    const typeChange = operations.find((operation) => operation.type === "CHANGE_FIELD_TYPE");
    expect(typeChange).toMatchObject({
      fieldName: "title",
      destructive: true,
      unsafe: true,
    });
    expect(validateOryCMSMigrationSafety(operations).safe).toBe(false);
    expect(validateOryCMSMigrationSafety(operations).blocked).toContain(typeChange);
  });

  it("detects required, unique, index, and relation changes", () => {
    const collection: OryCMSCollectionDefinition = {
      ...BASE_COLLECTION,
      fields: [
        { name: "title", type: "text", required: true, unique: false },
        {
          name: "authorId",
          type: "relation",
          target: "authors",
          cardinality: "one",
          required: true,
        },
      ],
    };
    const operations = compareOryCMSCollectionSchema(
      expected(collection),
      actual({
        fields: [
          { name: "id", nativeType: "uuid", nullable: false },
          { name: "title", nativeType: "character varying(255)", nullable: true },
          { name: "authorId", nativeType: "uuid", nullable: false },
          { name: "createdAt", nativeType: "timestamp with time zone", nullable: false },
          { name: "updatedAt", nativeType: "timestamp with time zone", nullable: false },
        ],
        indexes: [{ name: "idx_blog_posts_title_unique", fields: ["title"], unique: true }],
        foreignKeys: [],
      }),
    );

    expect(operations.map((operation) => operation.type)).toEqual(
      expect.arrayContaining([
        "SET_FIELD_REQUIRED",
        "DROP_UNIQUE_CONSTRAINT",
        "ADD_INDEX",
        "ADD_FOREIGN_KEY",
      ]),
    );
  });

  it("detects draft, timestamp, and SEO system field changes", () => {
    const collection: OryCMSCollectionDefinition = {
      ...BASE_COLLECTION,
      draft: { enabled: true },
      seo: { enabled: true },
    };
    const operations = compareOryCMSCollectionSchema(
      expected(collection),
      actual({
        fields: [
          { name: "id", nativeType: "uuid", nullable: false },
          { name: "title", nativeType: "character varying(255)", nullable: false },
          { name: "body", nativeType: "text", nullable: true },
        ],
      }),
    );

    expect(operations.map((operation) => operation.type)).toEqual(
      expect.arrayContaining(["ENABLE_DRAFTS", "ENABLE_TIMESTAMPS", "ENABLE_SEO"]),
    );
  });

  it("detects rename candidates without marking them unsafe", () => {
    const operations = compareOryCMSCollectionSchema(
      expected(),
      actual({
        fields: [
          { name: "id", nativeType: "uuid", nullable: false },
          { name: "headline", nativeType: "character varying(255)", nullable: false },
          { name: "body", nativeType: "text", nullable: true },
          { name: "createdAt", nativeType: "timestamp with time zone", nullable: false },
          { name: "updatedAt", nativeType: "timestamp with time zone", nullable: false },
        ],
      }),
    );

    expect(operations.find((operation) => operation.type === "RENAME_FIELD")).toMatchObject({
      from: "headline",
      to: "title",
      unsafe: false,
    });
  });
});
