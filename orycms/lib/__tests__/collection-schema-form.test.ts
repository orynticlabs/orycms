import { describe, expect, it } from "vitest";
import { adminCollectionCreatePath, adminCollectionEditPath, adminCollectionsPath } from "@/admin";
import {
  apiEndpointPreview,
  collectionDefinitionToForm,
  collectionFieldFormToSchema,
  collectionSchemaFormToDefinition,
  createEmptyCollectionField,
  createEmptyCollectionSchemaForm,
  slugifyCollectionName,
  validateCollectionSchemaForm,
} from "@/admin";
import type { OryCMSCollectionDefinition } from "@/schema";

const AUTHORS_COLLECTION: OryCMSCollectionDefinition = {
  name: "Authors",
  slug: "authors",
  labels: { singular: "Author", plural: "Authors" },
  fields: [{ name: "name", type: "text", required: true }],
};

describe("admin collection routes", () => {
  it("builds canonical collection admin routes", () => {
    expect(adminCollectionsPath()).toBe("/admin/collections");
    expect(adminCollectionCreatePath()).toBe("/admin/collections/create");
    expect(adminCollectionEditPath("blog-posts")).toBe("/admin/collections/blog-posts/edit");
  });
});

describe("collection schema form helpers", () => {
  it("slugifies collection names into kebab-case", () => {
    expect(slugifyCollectionName("Blog Posts!")).toBe("blog-posts");
    expect(slugifyCollectionName("  Product  Categories  ")).toBe("product-categories");
  });

  it("converts shared field settings and default values", () => {
    const field = {
      ...createEmptyCollectionField("title"),
      name: "title",
      label: "Title",
      type: "text" as const,
      required: true,
      unique: true,
      private: true,
      defaultValue: "Untitled",
    };

    expect(collectionFieldFormToSchema(field)).toEqual({
      name: "title",
      label: "Title",
      type: "text",
      required: true,
      unique: true,
      private: true,
      defaultValue: "Untitled",
    });
  });

  it("converts select options and relation settings", () => {
    const selectField = {
      ...createEmptyCollectionField("status"),
      name: "status",
      type: "select" as const,
      multiple: true,
      options: [
        { label: "Draft", value: "draft" },
        { label: "Published", value: "published" },
      ],
    };
    const relationField = {
      ...createEmptyCollectionField("author"),
      name: "author",
      type: "relation" as const,
      target: "authors",
      cardinality: "one" as const,
    };

    expect(collectionFieldFormToSchema(selectField)).toMatchObject({
      type: "select",
      multiple: true,
      options: [
        { label: "Draft", value: "draft" },
        { label: "Published", value: "published" },
      ],
    });
    expect(collectionFieldFormToSchema(relationField)).toMatchObject({
      type: "relation",
      target: "authors",
      cardinality: "one",
    });
  });

  it("converts a full form into an OryCMS collection definition", () => {
    const form = createEmptyCollectionSchemaForm();
    form.name = "Blog Posts";
    form.slug = "blog-posts";
    form.labels = { singular: "Post", plural: "Posts", menu: "Blog" };
    form.description = "Editorial posts";
    form.tableName = "blog_posts";
    form.draftsEnabled = true;
    form.seoEnabled = true;
    form.seoTitleField = "title";
    form.fields = [
      { ...createEmptyCollectionField("title"), name: "title", type: "text", required: true },
    ];

    expect(collectionSchemaFormToDefinition(form)).toEqual({
      name: "Blog Posts",
      slug: "blog-posts",
      labels: { singular: "Post", plural: "Posts", menu: "Blog" },
      description: "Editorial posts",
      tableName: "blog_posts",
      fields: [{ name: "title", type: "text", required: true }],
      timestamps: { enabled: true },
      draft: { enabled: true },
      seo: { enabled: true, titleField: "title" },
    });
  });

  it("round-trips an existing definition into editable form state", () => {
    const definition: OryCMSCollectionDefinition = {
      name: "Products",
      slug: "products",
      labels: { singular: "Product", plural: "Products" },
      fields: [{ name: "status", type: "select", options: [{ label: "Active", value: "active" }] }],
      draft: { enabled: true },
    };

    const form = collectionDefinitionToForm(definition);
    expect(form.fields[0].type).toBe("select");
    expect(form.fields[0].options).toEqual([{ label: "Active", value: "active" }]);
    expect(form.draftsEnabled).toBe(true);
  });

  it("validates duplicate slugs and unresolved relation targets", () => {
    const form = createEmptyCollectionSchemaForm();
    form.name = "Authors";
    form.slug = "authors";
    form.labels = { singular: "Author", plural: "Authors", menu: "" };
    form.fields = [
      {
        ...createEmptyCollectionField("author"),
        name: "author",
        type: "relation",
        target: "missing-collection",
      },
    ];

    const result = validateCollectionSchemaForm(form, [AUTHORS_COLLECTION]);
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["DUPLICATE_SLUG", "UNRESOLVED_RELATION_TARGET"]),
    );
  });

  it("shows generated content API endpoints without changing APIs", () => {
    expect(apiEndpointPreview("blog-posts")).toContain(
      "POST /api/orycms/collections/blog-posts/content",
    );
    expect(apiEndpointPreview("")[0]).toBe("GET /api/orycms/collections/[collection]/content");
  });
});
