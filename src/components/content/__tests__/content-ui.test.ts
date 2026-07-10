/**
 * Pure logic tests for OryCMS content UI helpers.
 * No DOM rendering — tests the utility functions extracted from the components.
 */
import { describe, it, expect } from "vitest";
import type { OryCMSCollectionDefinition } from "@/schema/collection.schema";
import type { OryCMSContentEntry } from "@/types/content.types";

// ── Helpers under test (extracted to be independently testable) ───────────────

/** @see OryCMSContentTable — getPrimaryField */
function getPrimaryField(collection: OryCMSCollectionDefinition): string {
  const f = collection.fields.find(
    (f) => !f.private && ["text", "email", "slug", "textarea"].includes(f.type),
  );
  return f?.name ?? "id";
}

/** @see OryCMSContentTable — formatCell */
function formatCell(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ") || "—";
  if (typeof value === "object") return JSON.stringify(value).slice(0, 60);
  return String(value).slice(0, 80);
}

/** @see OryCMSContentForm — initFormData */
function initFormData(
  collection: OryCMSCollectionDefinition,
  entry?: OryCMSContentEntry,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const field of collection.fields) {
    if (field.private) continue;
    const existing = entry?.data[field.name];
    if (existing !== undefined) {
      data[field.name] = existing;
    } else if (field.defaultValue !== undefined) {
      data[field.name] = field.defaultValue;
    } else if (field.type === "boolean") {
      data[field.name] = false;
    } else if (field.type === "select" && field.multiple) {
      data[field.name] = [];
    } else {
      data[field.name] = "";
    }
  }
  return data;
}

/** @see OryCMSContentForm — slug sanitiser */
function sanitiseSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

// ── Test collections ──────────────────────────────────────────────────────────

const BLOG_COLLECTION: OryCMSCollectionDefinition = {
  name: "Blog Posts",
  slug: "blog-posts",
  tableName: "blog_posts",
  labels: { singular: "Post", plural: "Posts" },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "body", type: "textarea" },
    { name: "slug", type: "slug", sourceField: "title" },
    { name: "featured", type: "boolean" },
    { name: "secret", type: "text", private: true },
    { name: "count", type: "number" },
    {
      name: "category",
      type: "select",
      options: [
        { label: "Tech", value: "tech" },
        { label: "Life", value: "life" },
      ],
    },
    {
      name: "tags",
      type: "select",
      multiple: true,
      options: [
        { label: "A", value: "a" },
        { label: "B", value: "b" },
      ],
    },
  ],
  draft: { enabled: true },
  timestamps: { enabled: true },
};

const EMPTY_COLLECTION: OryCMSCollectionDefinition = {
  name: "Empty",
  slug: "empty",
  labels: { singular: "Item", plural: "Items" },
  fields: [],
};

function makeEntry(data: Record<string, unknown>): OryCMSContentEntry {
  return {
    id: "entry-uuid",
    collectionSlug: "blog-posts",
    status: "draft",
    locale: "default",
    data,
    timestamps: { createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
  };
}

// ── getPrimaryField ───────────────────────────────────────────────────────────

describe("getPrimaryField", () => {
  it("returns first non-private text/email/slug/textarea field", () => {
    expect(getPrimaryField(BLOG_COLLECTION)).toBe("title");
  });

  it("falls back to 'id' when no suitable field", () => {
    expect(getPrimaryField(EMPTY_COLLECTION)).toBe("id");
  });

  it("skips private fields", () => {
    const col: OryCMSCollectionDefinition = {
      ...EMPTY_COLLECTION,
      fields: [
        { name: "token", type: "text", private: true },
        { name: "email", type: "email" },
      ],
    };
    expect(getPrimaryField(col)).toBe("email");
  });

  it("returns 'id' when only non-text fields exist", () => {
    const col: OryCMSCollectionDefinition = {
      ...EMPTY_COLLECTION,
      fields: [
        { name: "active", type: "boolean" },
        { name: "count", type: "number" },
      ],
    };
    expect(getPrimaryField(col)).toBe("id");
  });
});

// ── formatCell ────────────────────────────────────────────────────────────────

describe("formatCell", () => {
  it("returns '—' for null", () => expect(formatCell(null)).toBe("—"));
  it("returns '—' for undefined", () => expect(formatCell(undefined)).toBe("—"));
  it("returns 'Yes' for true", () => expect(formatCell(true)).toBe("Yes"));
  it("returns 'No' for false", () => expect(formatCell(false)).toBe("No"));
  it("joins arrays with comma", () => expect(formatCell(["a", "b", "c"])).toBe("a, b, c"));
  it("returns '—' for empty array", () => expect(formatCell([])).toBe("—"));
  it("stringifies objects", () => expect(formatCell({ x: 1 })).toBe('{"x":1}'));
  it("converts numbers to string", () => expect(formatCell(42)).toBe("42"));
  it("truncates long strings to 80 chars", () => {
    const long = "a".repeat(100);
    expect(formatCell(long)).toHaveLength(80);
  });
  it("truncates long JSON objects to 60 chars", () => {
    const obj = { key: "a".repeat(100) };
    expect(formatCell(obj).length).toBeLessThanOrEqual(60);
  });
});

// ── initFormData ──────────────────────────────────────────────────────────────

describe("initFormData", () => {
  it("initialises text fields to empty string", () => {
    const data = initFormData(BLOG_COLLECTION);
    expect(data.title).toBe("");
    expect(data.body).toBe("");
  });

  it("initialises boolean fields to false", () => {
    const data = initFormData(BLOG_COLLECTION);
    expect(data.featured).toBe(false);
  });

  it("initialises multi-select fields to empty array", () => {
    const data = initFormData(BLOG_COLLECTION);
    expect(data.tags).toEqual([]);
  });

  it("excludes private fields", () => {
    const data = initFormData(BLOG_COLLECTION);
    expect(data).not.toHaveProperty("secret");
  });

  it("uses defaultValue when no existing entry value", () => {
    const col: OryCMSCollectionDefinition = {
      ...EMPTY_COLLECTION,
      fields: [{ name: "status", type: "text", defaultValue: "draft" }],
    };
    const data = initFormData(col);
    expect(data.status).toBe("draft");
  });

  it("uses existing entry values over defaults", () => {
    const entry = makeEntry({ title: "Hello World", featured: true, tags: ["a"] });
    const data = initFormData(BLOG_COLLECTION, entry);
    expect(data.title).toBe("Hello World");
    expect(data.featured).toBe(true);
    expect(data.tags).toEqual(["a"]);
  });

  it("fills missing fields with defaults when entry is partial", () => {
    const entry = makeEntry({ title: "Partial" });
    const data = initFormData(BLOG_COLLECTION, entry);
    expect(data.title).toBe("Partial");
    expect(data.featured).toBe(false); // boolean default
    expect(data.tags).toEqual([]); // multi-select default
  });

  it("uses null/empty for fields absent in a partial entry", () => {
    const entry = makeEntry({});
    const data = initFormData(BLOG_COLLECTION, entry);
    expect(data.title).toBe(""); // not in entry.data → empty string default
  });

  it("returns empty object for collection with no fields", () => {
    expect(initFormData(EMPTY_COLLECTION)).toEqual({});
  });
});

// ── sanitiseSlug ─────────────────────────────────────────────────────────────

describe("sanitiseSlug", () => {
  it("lowercases input", () => expect(sanitiseSlug("HELLO")).toBe("hello"));
  it("replaces spaces with hyphens", () => expect(sanitiseSlug("hello world")).toBe("hello-world"));
  it("collapses multiple spaces into a single hyphen", () =>
    expect(sanitiseSlug("a  b")).toBe("a-b"));
  it("strips non-alphanumeric non-hyphen characters", () =>
    expect(sanitiseSlug("hello!@#world")).toBe("helloworld"));
  it("preserves existing hyphens", () => expect(sanitiseSlug("my-slug")).toBe("my-slug"));
  it("handles mixed case and spaces", () =>
    expect(sanitiseSlug("My Blog Post")).toBe("my-blog-post"));
  it("returns empty string for empty input", () => expect(sanitiseSlug("")).toBe(""));
});

// ── Column selection logic ────────────────────────────────────────────────────

describe("column selection", () => {
  /** Mirrors the logic in OryCMSContentTable */
  function getColumns(collection: OryCMSCollectionDefinition): string[] {
    const primaryField = getPrimaryField(collection);
    return [
      primaryField,
      ...collection.fields
        .filter(
          (f) =>
            !f.private &&
            f.name !== primaryField &&
            !["textarea", "richText", "json", "password"].includes(f.type),
        )
        .slice(0, 2)
        .map((f) => f.name),
    ];
  }

  it("starts with the primary field", () => {
    const cols = getColumns(BLOG_COLLECTION);
    expect(cols[0]).toBe("title");
  });

  it("excludes private fields from secondary columns", () => {
    const cols = getColumns(BLOG_COLLECTION);
    expect(cols).not.toContain("secret");
  });

  it("caps secondary columns at 2", () => {
    const cols = getColumns(BLOG_COLLECTION);
    expect(cols.length).toBeLessThanOrEqual(3);
  });

  it("excludes textarea, richText, json, password from columns", () => {
    const col: OryCMSCollectionDefinition = {
      ...EMPTY_COLLECTION,
      fields: [
        { name: "title", type: "text" },
        { name: "body", type: "textarea" },
        { name: "meta", type: "json" },
        { name: "rich", type: "richText" },
        { name: "status", type: "text" },
      ],
    };
    const cols = getColumns(col);
    expect(cols).not.toContain("body");
    expect(cols).not.toContain("meta");
    expect(cols).not.toContain("rich");
  });

  it("falls back to 'id' column when no suitable field", () => {
    const cols = getColumns(EMPTY_COLLECTION);
    expect(cols[0]).toBe("id");
  });
});
