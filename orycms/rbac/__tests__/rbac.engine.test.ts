import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Pool } from "pg";
import {
  syncOryCMSDefaultRoles,
  syncOryCMSDefaultPermissions,
  getOryCMSUserPermissions,
  hasOryCMSPermission,
  requireOryCMSPermission,
  clearOryCMSPermissionCache,
  ORYCMS_DEFAULT_PERMISSIONS,
} from "../rbac.engine";
import { OryCMSAuthError } from "@/auth";

// ── Pool helpers ──────────────────────────────────────────────────────────────

function makePool(impl: (sql: string, params?: unknown[]) => unknown): Pool {
  return { query: vi.fn(impl) } as unknown as Pool;
}

// Row of DB permissions for a role
function permRows(role: keyof typeof ORYCMS_DEFAULT_PERMISSIONS) {
  return Object.entries(ORYCMS_DEFAULT_PERMISSIONS[role]).flatMap(([resource, actions]) =>
    actions.map((action) => ({ resource, action })),
  );
}

// ── syncOryCMSDefaultRoles ────────────────────────────────────────────────────

describe("syncOryCMSDefaultRoles", () => {
  it("upserts all 5 default roles", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await syncOryCMSDefaultRoles(pool);
    const calls = (pool.query as ReturnType<typeof vi.fn>).mock.calls as [string, unknown[]][];
    const roles = calls.map((c) => (c[1] as string[])[0]);
    expect(roles).toEqual(["Owner", "Admin", "Editor", "Author", "Viewer"]);
  });
});

// ── syncOryCMSDefaultPermissions ──────────────────────────────────────────────

describe("syncOryCMSDefaultPermissions", () => {
  it("inserts role-permission links for all matrix entries", async () => {
    let insertCount = 0;
    const pool = makePool((sql: string) => {
      if (sql.includes("SELECT id FROM orycms_roles")) return { rows: [{ id: "role-uuid" }] };
      if (sql.includes("INSERT INTO orycms_permissions")) {
        return { rows: [{ id: "perm-uuid" }] };
      }
      if (sql.includes("INSERT INTO orycms_role_permissions")) {
        insertCount++;
        return { rows: [] };
      }
      return { rows: [] };
    });

    await syncOryCMSDefaultPermissions(pool);
    // Each permission entry produces one role_permissions insert
    const totalPerms = Object.values(ORYCMS_DEFAULT_PERMISSIONS).reduce(
      (sum, resources) =>
        sum + Object.values(resources).reduce((s, actions) => s + actions.length, 0),
      0,
    );
    expect(insertCount).toBe(totalPerms);
  });

  it("skips role if not found in DB", async () => {
    const pool = makePool((sql: string) => {
      if (sql.includes("SELECT id FROM orycms_roles")) return { rows: [] }; // no role found
      return { rows: [] };
    });
    // Should not throw
    await expect(syncOryCMSDefaultPermissions(pool)).resolves.toBeUndefined();
  });
});

// ── getOryCMSUserPermissions ──────────────────────────────────────────────────

describe("getOryCMSUserPermissions", () => {
  beforeEach(() => clearOryCMSPermissionCache());

  it("returns a Set of 'resource:action' strings from DB", async () => {
    const pool = makePool(() => ({
      rows: [
        { resource: "content", action: "read" },
        { resource: "content", action: "publish" },
      ],
    }));
    const perms = await getOryCMSUserPermissions("Editor", pool);
    expect(perms.has("content:read")).toBe(true);
    expect(perms.has("content:publish")).toBe(true);
  });

  it("caches the result — second call does not hit DB", async () => {
    const pool = makePool(() => ({ rows: [{ resource: "content", action: "read" }] }));
    await getOryCMSUserPermissions("Viewer", pool);
    await getOryCMSUserPermissions("Viewer", pool);
    // DB query called only once despite two invocations
    expect((pool.query as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it("clearOryCMSPermissionCache forces fresh DB query", async () => {
    const pool = makePool(() => ({ rows: [{ resource: "media", action: "read" }] }));
    await getOryCMSUserPermissions("Viewer", pool);
    clearOryCMSPermissionCache();
    await getOryCMSUserPermissions("Viewer", pool);
    expect((pool.query as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });
});

// ── hasOryCMSPermission ───────────────────────────────────────────────────────

describe("hasOryCMSPermission", () => {
  beforeEach(() => clearOryCMSPermissionCache());

  function poolFor(role: keyof typeof ORYCMS_DEFAULT_PERMISSIONS): Pool {
    const rows = permRows(role);
    return makePool(() => ({ rows }));
  }

  it("Owner has full access via 'manage' on every resource", async () => {
    const pool = poolFor("Owner");
    expect(await hasOryCMSPermission("Owner", "settings", "delete", pool)).toBe(true);
    expect(await hasOryCMSPermission("Owner", "roles", "manage", pool)).toBe(true);
    expect(await hasOryCMSPermission("Owner", "migrations", "create", pool)).toBe(true);
  });

  it("Admin has manage on collections but only read on roles", async () => {
    const pool = poolFor("Admin");
    expect(await hasOryCMSPermission("Admin", "collections", "create", pool)).toBe(true);
    expect(await hasOryCMSPermission("Admin", "roles", "read", pool)).toBe(true);
    expect(await hasOryCMSPermission("Admin", "roles", "manage", pool)).toBe(false);
  });

  it("Editor can publish content", async () => {
    const pool = poolFor("Editor");
    expect(await hasOryCMSPermission("Editor", "content", "publish", pool)).toBe(true);
    expect(await hasOryCMSPermission("Editor", "content", "create", pool)).toBe(true);
  });

  it("Editor cannot access migrations or settings", async () => {
    const pool = poolFor("Editor");
    expect(await hasOryCMSPermission("Editor", "migrations", "read", pool)).toBe(false);
    expect(await hasOryCMSPermission("Editor", "settings", "read", pool)).toBe(false);
  });

  it("Author can create/read/update content but not delete or publish", async () => {
    const pool = poolFor("Author");
    expect(await hasOryCMSPermission("Author", "content", "create", pool)).toBe(true);
    expect(await hasOryCMSPermission("Author", "content", "read", pool)).toBe(true);
    expect(await hasOryCMSPermission("Author", "content", "update", pool)).toBe(true);
    expect(await hasOryCMSPermission("Author", "content", "delete", pool)).toBe(false);
    expect(await hasOryCMSPermission("Author", "content", "publish", pool)).toBe(false);
  });

  it("Viewer has read-only access to content, media, collections, seo", async () => {
    const pool = poolFor("Viewer");
    expect(await hasOryCMSPermission("Viewer", "content", "read", pool)).toBe(true);
    expect(await hasOryCMSPermission("Viewer", "media", "read", pool)).toBe(true);
    expect(await hasOryCMSPermission("Viewer", "collections", "read", pool)).toBe(true);
    expect(await hasOryCMSPermission("Viewer", "seo", "read", pool)).toBe(true);
    expect(await hasOryCMSPermission("Viewer", "content", "create", pool)).toBe(false);
    expect(await hasOryCMSPermission("Viewer", "users", "read", pool)).toBe(false);
  });

  it("returns false for null roleName", async () => {
    const pool = makePool(() => ({ rows: [] }));
    expect(await hasOryCMSPermission(null, "content", "read", pool)).toBe(false);
  });

  it("manage permission implies all actions on same resource", async () => {
    const pool = makePool(() => ({ rows: [{ resource: "content", action: "manage" }] }));
    expect(await hasOryCMSPermission("Owner", "content", "publish", pool)).toBe(true);
    expect(await hasOryCMSPermission("Owner", "content", "delete", pool)).toBe(true);
  });
});

// ── requireOryCMSPermission ───────────────────────────────────────────────────

describe("requireOryCMSPermission", () => {
  beforeEach(() => clearOryCMSPermissionCache());

  it("resolves when permission is granted", async () => {
    const pool = makePool(() => ({ rows: [{ resource: "content", action: "manage" }] }));
    await expect(
      requireOryCMSPermission({ roleName: "Owner" }, "content", "publish", pool),
    ).resolves.toBeUndefined();
  });

  it("throws OryCMSAuthError FORBIDDEN (403) when permission is missing", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await expect(
      requireOryCMSPermission({ roleName: "Viewer" }, "collections", "create", pool),
    ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
  });

  it("thrown error is an OryCMSAuthError instance", async () => {
    const pool = makePool(() => ({ rows: [] }));
    try {
      await requireOryCMSPermission({ roleName: "Viewer" }, "settings", "manage", pool);
    } catch (err) {
      expect(err).toBeInstanceOf(OryCMSAuthError);
    }
  });

  it("throws FORBIDDEN for null role", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await expect(
      requireOryCMSPermission({ roleName: null }, "content", "read", pool),
    ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
  });
});
