import { describe, it, expect } from "vitest";
import { getOryCMSCoreCollections } from "../core.collections";

describe("getOryCMSCoreCollections", () => {
  const collections = getOryCMSCoreCollections();

  // ── count and identity ─────────────────────────────────────────────────────

  it("returns exactly 9 core collections", () => {
    expect(collections).toHaveLength(9);
  });

  it("slugs match the expected set in dependency order", () => {
    expect(collections.map((c) => c.slug)).toEqual([
      "orycms-migrations",
      "orycms-roles",
      "orycms-permissions",
      "orycms-settings",
      "orycms-collections",
      "orycms-users",
      "orycms-role-permissions",
      "orycms-sessions",
      "orycms-collection-fields",
    ]);
  });

  it("table names are snake_case versions of slugs", () => {
    for (const c of collections) {
      expect(c.tableName).toBe(c.slug.replace(/-/g, "_"));
    }
  });

  // ── helper ─────────────────────────────────────────────────────────────────

  function bySlug(slug: string) {
    const c = collections.find((x) => x.slug === slug);
    if (!c) throw new Error(`collection "${slug}" not found`);
    return c;
  }

  function field(slug: string, fieldName: string) {
    const c = bySlug(slug);
    const f = c.fields.find((x) => x.name === fieldName);
    if (!f) throw new Error(`field "${fieldName}" not found in "${slug}"`);
    return f;
  }

  // ── orycms-migrations ──────────────────────────────────────────────────────

  describe("orycms-migrations", () => {
    it("has migrationId as required unique text field", () => {
      const f = field("orycms-migrations", "migrationId");
      expect(f.type).toBe("text");
      expect(f.required).toBe(true);
      expect(f.unique).toBe(true);
    });

    it("has appliedAt as required date-with-time field", () => {
      const f = field("orycms-migrations", "appliedAt");
      expect(f.type).toBe("date");
      expect(f.required).toBe(true);
      if (f.type === "date") expect(f.includeTime).toBe(true);
    });

    it("has durationMs as integer number", () => {
      const f = field("orycms-migrations", "durationMs");
      expect(f.type).toBe("number");
      if (f.type === "number") expect(f.integer).toBe(true);
    });
  });

  // ── orycms-roles ──────────────────────────────────────────────────────────

  describe("orycms-roles", () => {
    it("has name as required unique text field", () => {
      const f = field("orycms-roles", "name");
      expect(f.type).toBe("text");
      expect(f.required).toBe(true);
      expect(f.unique).toBe(true);
    });
  });

  // ── orycms-permissions ────────────────────────────────────────────────────

  describe("orycms-permissions", () => {
    it("has name as required unique text field", () => {
      const f = field("orycms-permissions", "name");
      expect(f.unique).toBe(true);
      expect(f.required).toBe(true);
    });

    it("has resource and action as required text fields", () => {
      expect(field("orycms-permissions", "resource").required).toBe(true);
      expect(field("orycms-permissions", "action").required).toBe(true);
    });
  });

  // ── orycms-settings ───────────────────────────────────────────────────────

  describe("orycms-settings", () => {
    it("has key as required unique text field", () => {
      const f = field("orycms-settings", "key");
      expect(f.required).toBe(true);
      expect(f.unique).toBe(true);
    });

    it("has value as required json field", () => {
      const f = field("orycms-settings", "value");
      expect(f.type).toBe("json");
      expect(f.required).toBe(true);
    });
  });

  // ── orycms-collections ────────────────────────────────────────────────────

  describe("orycms-collections", () => {
    it("has collectionSlug as required unique text field", () => {
      const f = field("orycms-collections", "collectionSlug");
      expect(f.type).toBe("text");
      expect(f.required).toBe(true);
      expect(f.unique).toBe(true);
    });

    it("has schemaJson as json field", () => {
      expect(field("orycms-collections", "schemaJson").type).toBe("json");
    });
  });

  // ── orycms-users ──────────────────────────────────────────────────────────

  describe("orycms-users", () => {
    it("has email as required unique email field", () => {
      const f = field("orycms-users", "email");
      expect(f.type).toBe("email");
      expect(f.required).toBe(true);
      expect(f.unique).toBe(true);
    });

    it("has passwordHash as required private password field", () => {
      const f = field("orycms-users", "passwordHash");
      expect(f.type).toBe("password");
      expect(f.required).toBe(true);
      expect(f.private).toBe(true);
    });

    it("has status select with active/inactive/pending options", () => {
      const f = field("orycms-users", "status");
      expect(f.type).toBe("select");
      expect(f.required).toBe(true);
      if (f.type === "select") {
        const values = f.options.map((o) => o.value);
        expect(values).toContain("active");
        expect(values).toContain("inactive");
        expect(values).toContain("pending");
      }
    });

    it("has status defaulting to pending", () => {
      const f = field("orycms-users", "status");
      expect(f.defaultValue).toBe("pending");
    });

    it("has roleId as relation to orycms-roles with cardinality one", () => {
      const f = field("orycms-users", "roleId");
      expect(f.type).toBe("relation");
      if (f.type === "relation") {
        expect(f.target).toBe("orycms-roles");
        expect(f.cardinality).toBe("one");
      }
    });
  });

  // ── orycms-role-permissions ───────────────────────────────────────────────

  describe("orycms-role-permissions", () => {
    it("has roleId as required cascade-delete relation to orycms-roles", () => {
      const f = field("orycms-role-permissions", "roleId");
      expect(f.type).toBe("relation");
      expect(f.required).toBe(true);
      if (f.type === "relation") {
        expect(f.target).toBe("orycms-roles");
        expect(f.cascadeDelete).toBe(true);
      }
    });

    it("has permissionId as required cascade-delete relation to orycms-permissions", () => {
      const f = field("orycms-role-permissions", "permissionId");
      expect(f.type).toBe("relation");
      expect(f.required).toBe(true);
      if (f.type === "relation") {
        expect(f.target).toBe("orycms-permissions");
        expect(f.cascadeDelete).toBe(true);
      }
    });
  });

  // ── orycms-sessions ───────────────────────────────────────────────────────

  describe("orycms-sessions", () => {
    it("has userId as required cascade-delete relation to orycms-users", () => {
      const f = field("orycms-sessions", "userId");
      expect(f.type).toBe("relation");
      expect(f.required).toBe(true);
      if (f.type === "relation") {
        expect(f.target).toBe("orycms-users");
        expect(f.cascadeDelete).toBe(true);
      }
    });

    it("has tokenHash as required unique text field", () => {
      const f = field("orycms-sessions", "tokenHash");
      expect(f.type).toBe("text");
      expect(f.required).toBe(true);
      expect(f.unique).toBe(true);
    });

    it("has expiresAt as required date-with-time field", () => {
      const f = field("orycms-sessions", "expiresAt");
      expect(f.type).toBe("date");
      expect(f.required).toBe(true);
      if (f.type === "date") expect(f.includeTime).toBe(true);
    });
  });

  // ── orycms-collection-fields ──────────────────────────────────────────────

  describe("orycms-collection-fields", () => {
    it("has collectionId as required cascade-delete relation to orycms-collections", () => {
      const f = field("orycms-collection-fields", "collectionId");
      expect(f.type).toBe("relation");
      expect(f.required).toBe(true);
      if (f.type === "relation") {
        expect(f.target).toBe("orycms-collections");
        expect(f.cascadeDelete).toBe(true);
      }
    });

    it("fieldType select covers all 13 OryCMS field types", () => {
      const f = field("orycms-collection-fields", "fieldType");
      expect(f.type).toBe("select");
      if (f.type === "select") {
        const values = f.options.map((o) => o.value);
        const expectedTypes = [
          "text",
          "textarea",
          "richText",
          "number",
          "boolean",
          "date",
          "email",
          "password",
          "select",
          "relation",
          "media",
          "json",
          "slug",
        ];
        for (const t of expectedTypes) {
          expect(values).toContain(t);
        }
        expect(values).toHaveLength(13);
      }
    });
  });

  // ── relation target integrity ─────────────────────────────────────────────

  it("all relation targets reference slugs present in the core collection list", () => {
    const slugSet = new Set(collections.map((c) => c.slug));
    for (const c of collections) {
      for (const f of c.fields) {
        if (f.type === "relation") {
          expect(slugSet, `${c.slug}.${f.name} → "${f.target}"`).toContain(f.target);
        }
      }
    }
  });
});
