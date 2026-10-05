import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OryCMSRoute } from "../dispatcher";

// Mirrors settings.test.ts: auth and RBAC are mocked, the real roles and audit
// repositories run, and only the pool they ask for is faked. No database is touched.

const protectOryCMSAdminRoute = vi.fn();
const requireOryCMSPermission = vi.fn();
const getOryCMSUserPermissions = vi.fn();
const fakeQuery = vi.fn();
const fakePool = { query: (...args: unknown[]) => fakeQuery(...args) };

class OryCMSAuthError extends Error {
  code: string;
  statusCode: number;
  constructor(code: string, message: string, statusCode = 401) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

vi.mock("@/auth", () => ({
  protectOryCMSAdminRoute: (...args: unknown[]) => protectOryCMSAdminRoute(...args),
  OryCMSAuthError,
}));

vi.mock("@/rbac", () => ({
  requireOryCMSPermission: (...args: unknown[]) => requireOryCMSPermission(...args),
  getOryCMSUserPermissions: (...args: unknown[]) => getOryCMSUserPermissions(...args),
  clearOryCMSPermissionCache: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getOryCMSPool: () => fakePool,
}));

// Import AFTER mocks are registered.
const { roleRoutes } = await import("../routes/roles");

function findRoute(method: string, pattern: string): OryCMSRoute {
  const route = roleRoutes.find((r) => r.method === method && r.pattern === pattern);
  if (!route) throw new Error(`${method} ${pattern} not found in roleRoutes`);
  return route;
}

const listRoute = findRoute("GET", "roles");
const createRoute = findRoute("POST", "roles");
const getRoute = findRoute("GET", "roles/:id");
const updateRoute = findRoute("PATCH", "roles/:id");
const deleteRoute = findRoute("DELETE", "roles/:id");
const getPermsRoute = findRoute("GET", "roles/:id/permissions");
const setPermsRoute = findRoute("PUT", "roles/:id/permissions");

const OWNER_SESSION = { userId: "u-owner", email: "owner@example.test", roleName: "Owner" };
const CUSTOM_SESSION = { userId: "u-custom", email: "custom@example.test", roleName: "Custom" };

/** Permissions the Owner-like caller holds in these tests. */
const OWNER_PERMS = new Set([
  "roles:manage",
  "users:manage",
  "settings:manage",
  "roles:read",
  "roles:create",
  "roles:update",
  "roles:delete",
]);

/** A custom-role holder who can edit roles but has no users permissions. */
const CUSTOM_PERMS = new Set(["roles:read", "roles:update"]);

const BUILT_IN = ["Owner", "Admin", "Editor", "Author", "Viewer"] as const;

const ROLES = [
  ...BUILT_IN.map((name) => ({ id: `r-${name.toLowerCase()}`, name, description: null })),
  { id: "r-custom", name: "Custom", description: "A custom role" },
  { id: "r-spare", name: "Spare", description: null },
];

const PERMS = [
  { id: "p-roles-read", name: "roles:read", resource: "roles", action: "read" },
  { id: "p-roles-update", name: "roles:update", resource: "roles", action: "update" },
  { id: "p-users-read", name: "users:read", resource: "users", action: "read" },
  { id: "p-users-update", name: "users:update", resource: "users", action: "update" },
  { id: "p-users-manage", name: "users:manage", resource: "users", action: "manage" },
];

/** Number of users assigned to the role being tested. Set per test. */
let usersAssigned = 0;

const FAKE_URL = "postgresql://svc_user:Hunter2-fake@db.internal.example:5432/orycms_prod";
const FAKE_PASSWORD = "Hunter2-fake";

/** A driver-style error: string SQLSTATE `code`, message carrying connection detail. */
function driverError(message: string, code = "28P01"): Error {
  return Object.assign(new Error(message), { code });
}

function routeFor(sql: string, params: unknown[] = []): { rows: unknown[] } {
  if (sql.includes("INSERT INTO orycms_audit_logs")) return { rows: [] };
  if (sql.includes("COUNT(*)") && sql.includes("orycms_users")) {
    return { rows: [{ count: String(usersAssigned) }] };
  }
  if (sql.includes("FROM orycms_roles") && sql.includes("WHERE id")) {
    const role = ROLES.find((r) => r.id === params[0]);
    return { rows: role ? [role] : [] };
  }
  if (sql.includes("FROM orycms_roles") && sql.includes("ORDER BY name")) {
    return { rows: ROLES };
  }
  if (sql.includes("INSERT INTO orycms_roles")) {
    return { rows: [{ id: "r-new", name: params[0], description: params[1] }] };
  }
  if (sql.includes("UPDATE orycms_roles")) {
    const role = ROLES.find((r) => r.id === params[params.length - 1]);
    return { rows: role ? [role] : [] };
  }
  if (sql.includes("JOIN orycms_role_permissions")) return { rows: PERMS };
  if (sql.includes("FROM orycms_permissions")) return { rows: PERMS };
  return { rows: [] };
}

function ctxFor(route: OryCMSRoute, opts: { id?: string; body?: unknown; raw?: string }) {
  const path = opts.id ? `/api/orycms/roles/${opts.id}` : "/api/orycms/roles";
  const request = new Request(`http://localhost${path}`, {
    method: route.method,
    headers: { "content-type": "application/json" },
    body: opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
  });
  const params: Record<string, string> = opts.id ? { id: opts.id } : {};
  return { request, params, url: new URL(request.url) };
}

const call = (route: OryCMSRoute, opts: { id?: string; body?: unknown; raw?: string } = {}) =>
  route.handler(ctxFor(route, opts));

/** Queries that write to the roles table or its permission assignments. */
function writeQueries(): string[] {
  return fakeQuery.mock.calls
    .map((c) => String(c[0]))
    .filter(
      (sql) =>
        /^\s*(INSERT|UPDATE|DELETE)\b/.test(sql) &&
        /orycms_roles|orycms_role_permissions/.test(sql),
    );
}

const FORBIDDEN = new OryCMSAuthError(
  "FORBIDDEN",
  "You do not have permission to perform this action.",
  403,
);

beforeEach(() => {
  protectOryCMSAdminRoute.mockReset();
  requireOryCMSPermission.mockReset();
  getOryCMSUserPermissions.mockReset();
  fakeQuery.mockReset();
  usersAssigned = 0;
  protectOryCMSAdminRoute.mockResolvedValue(OWNER_SESSION);
  requireOryCMSPermission.mockResolvedValue(undefined);
  getOryCMSUserPermissions.mockResolvedValue(OWNER_PERMS);
  fakeQuery.mockImplementation(async (sql: string, params?: unknown[]) => routeFor(sql, params));
});

describe("roles routes (packages/core)", () => {
  describe("authentication and permission", () => {
    it("rejects an unauthenticated request with 401 and never queries", async () => {
      protectOryCMSAdminRoute.mockRejectedValue(
        new OryCMSAuthError("UNAUTHORIZED", "Authentication required.", 401),
      );

      const res = await call(listRoute);

      expect(res.status).toBe(401);
      expect(fakeQuery).not.toHaveBeenCalled();
    });

    it("rejects a caller without roles:read on the list route with 403", async () => {
      requireOryCMSPermission.mockRejectedValue(FORBIDDEN);

      const res = await call(listRoute);

      expect(res.status).toBe(403);
      expect(requireOryCMSPermission).toHaveBeenCalledWith(
        OWNER_SESSION,
        "roles",
        "read",
        fakePool,
      );
      expect(fakeQuery).not.toHaveBeenCalled();
    });

    it.each([
      ["POST roles", createRoute, { body: { name: "New" } }, "create"],
      ["PATCH roles/:id", updateRoute, { id: "r-spare", body: { name: "X" } }, "update"],
      ["DELETE roles/:id", deleteRoute, { id: "r-spare" }, "delete"],
      [
        "PUT roles/:id/permissions",
        setPermsRoute,
        { id: "r-spare", body: { permissionIds: [] } },
        "update",
      ],
    ])(
      "%s rejects a caller without roles:%s with 403 and never writes",
      async (_label, route, opts, action) => {
        requireOryCMSPermission.mockRejectedValue(FORBIDDEN);

        const res = await call(route, opts);

        expect(res.status).toBe(403);
        expect(requireOryCMSPermission).toHaveBeenCalledWith(
          OWNER_SESSION,
          "roles",
          action,
          fakePool,
        );
        expect(writeQueries()).toHaveLength(0);
      },
    );

    it("rejects an unauthenticated write with 401 and never writes", async () => {
      protectOryCMSAdminRoute.mockRejectedValue(
        new OryCMSAuthError("UNAUTHORIZED", "Authentication required.", 401),
      );

      const res = await call(deleteRoute, { id: "r-spare" });

      expect(res.status).toBe(401);
      expect(writeQueries()).toHaveLength(0);
    });
  });

  describe("success paths", () => {
    it("GET roles returns 200 with role rows only (id, name, description)", async () => {
      const res = await call(listRoute);

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; data: Array<Record<string, unknown>> };
      expect(body.success).toBe(true);
      for (const row of body.data) {
        expect(Object.keys(row).sort()).toEqual(["description", "id", "name"]);
      }
    });

    it("GET roles selects an explicit column list, never SELECT *", async () => {
      await call(listRoute);

      const sql = String(fakeQuery.mock.calls[0][0]);
      expect(sql).not.toMatch(/SELECT\s+\*/i);
    });

    it("POST roles creates a valid role with 201 and records an audit row", async () => {
      const res = await call(createRoute, {
        body: { name: "Reviewer", description: "Reads drafts" },
      });

      expect(res.status).toBe(201);
      const audit = fakeQuery.mock.calls.find((c) => String(c[0]).includes("orycms_audit_logs"));
      expect(audit).toBeDefined();
    });

    it("GET roles/:id returns 200 with the role", async () => {
      const res = await call(getRoute, { id: "r-custom" });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { id: string } };
      expect(body.data.id).toBe("r-custom");
    });

    it("GET roles/:id returns 404 for an unknown role", async () => {
      const res = await call(getRoute, { id: "r-missing" });

      expect(res.status).toBe(404);
    });

    it("PATCH roles/:id updates a custom role's name and description", async () => {
      const res = await call(updateRoute, {
        id: "r-spare",
        body: { name: "Spare Two", description: "Renamed" },
      });

      expect(res.status).toBe(200);
    });

    it("DELETE roles/:id removes a custom role with no users assigned", async () => {
      const res = await call(deleteRoute, { id: "r-spare" });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { id: string; deleted: boolean } };
      expect(body.data).toEqual({ id: "r-spare", deleted: true });
    });

    it("GET roles/:id/permissions returns explicit permission columns only", async () => {
      const res = await call(getPermsRoute, { id: "r-custom" });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: Array<Record<string, unknown>> };
      for (const row of body.data) {
        expect(Object.keys(row).sort()).toEqual(["action", "id", "name", "resource"]);
      }
    });

    it("PUT roles/:id/permissions accepts a subset of permissions the caller holds", async () => {
      getOryCMSUserPermissions.mockResolvedValue(CUSTOM_PERMS);
      requireOryCMSPermission.mockResolvedValue(undefined);
      protectOryCMSAdminRoute.mockResolvedValue(CUSTOM_SESSION);

      const res = await call(setPermsRoute, {
        id: "r-spare",
        body: { permissionIds: ["p-roles-read"] },
      });

      expect(res.status).toBe(200);
    });
  });

  describe("invalid bodies", () => {
    it("POST roles rejects a missing name with 422", async () => {
      const res = await call(createRoute, { body: { description: "no name" } });

      expect(res.status).toBe(422);
      expect(writeQueries()).toHaveLength(0);
    });

    it("POST roles rejects a non-string name (object) with 422", async () => {
      const res = await call(createRoute, { body: { name: { nested: true } } });

      expect(res.status).toBe(422);
      expect(writeQueries()).toHaveLength(0);
    });

    it("POST roles rejects a name longer than 64 characters with 422", async () => {
      const res = await call(createRoute, { body: { name: "a".repeat(65) } });

      expect(res.status).toBe(422);
      expect(writeQueries()).toHaveLength(0);
    });

    it("POST roles rejects a name with characters outside the allowed set with 422 (hostile input)", async () => {
      const res = await call(createRoute, { body: { name: "x'; DROP TABLE orycms_roles;--" } });

      expect(res.status).toBe(422);
      expect(writeQueries()).toHaveLength(0);
    });

    it("POST roles rejects a description longer than 500 characters with 422", async () => {
      const res = await call(createRoute, { body: { name: "Ok", description: "d".repeat(501) } });

      expect(res.status).toBe(422);
      expect(writeQueries()).toHaveLength(0);
    });

    it("PATCH roles/:id rejects an invalid name with 422", async () => {
      const res = await call(updateRoute, { id: "r-spare", body: { name: "bad name!" } });

      expect(res.status).toBe(422);
      expect(writeQueries()).toHaveLength(0);
    });

    it("POST roles rejects a malformed JSON body with 422, not a 500", async () => {
      const res = await call(createRoute, { raw: "{not json" });

      expect(res.status).toBe(422);
    });

    it("PUT permissions rejects a non-array permissionIds with 422 instead of silently clearing the role", async () => {
      const res = await call(setPermsRoute, {
        id: "r-spare",
        body: { permissionIds: "p-roles-read" },
      });

      expect(res.status).toBe(422);
      expect(writeQueries()).toHaveLength(0);
    });

    it("PUT permissions rejects a missing permissionIds with 422 instead of silently clearing the role", async () => {
      const res = await call(setPermsRoute, { id: "r-spare", body: {} });

      expect(res.status).toBe(422);
      expect(writeQueries()).toHaveLength(0);
    });

    it("PUT permissions rejects a non-string permission id with 422", async () => {
      const res = await call(setPermsRoute, { id: "r-spare", body: { permissionIds: [{ x: 1 }] } });

      expect(res.status).toBe(422);
      expect(writeQueries()).toHaveLength(0);
    });

    it("PUT permissions rejects more than 500 permission ids with 422", async () => {
      const ids = Array.from({ length: 501 }, (_, i) => `p-${i}`);

      const res = await call(setPermsRoute, { id: "r-spare", body: { permissionIds: ids } });

      expect(res.status).toBe(422);
      expect(writeQueries()).toHaveLength(0);
    });

    it("PUT permissions rejects malformed JSON with 422, not a 500", async () => {
      const res = await call(setPermsRoute, { id: "r-spare", raw: "{not json" });

      expect(res.status).toBe(422);
    });
  });

  describe("unknown permissions", () => {
    it("PUT permissions rejects a permission id that does not exist with 422 and never writes", async () => {
      const res = await call(setPermsRoute, {
        id: "r-spare",
        body: { permissionIds: ["p-does-not-exist"] },
      });

      expect(res.status).toBe(422);
      expect(writeQueries()).toHaveLength(0);
    });
  });

  describe("escalation: granting permissions the caller does not hold", () => {
    it("PUT permissions denies granting users:manage to a caller who holds only roles:update", async () => {
      protectOryCMSAdminRoute.mockResolvedValue(CUSTOM_SESSION);
      getOryCMSUserPermissions.mockResolvedValue(CUSTOM_PERMS);

      const res = await call(setPermsRoute, {
        id: "r-spare",
        body: { permissionIds: ["p-users-manage"] },
      });

      expect(res.status).toBe(403);
      expect(writeQueries()).toHaveLength(0);
    });

    it("PUT permissions denies a mixed set when any one permission is not held", async () => {
      protectOryCMSAdminRoute.mockResolvedValue(CUSTOM_SESSION);
      getOryCMSUserPermissions.mockResolvedValue(CUSTOM_PERMS);

      const res = await call(setPermsRoute, {
        id: "r-spare",
        body: { permissionIds: ["p-roles-read", "p-users-update"] },
      });

      expect(res.status).toBe(403);
      expect(writeQueries()).toHaveLength(0);
    });

    it("PUT permissions allows granting a permission the caller holds through a manage grant", async () => {
      getOryCMSUserPermissions.mockResolvedValue(OWNER_PERMS);

      const res = await call(setPermsRoute, {
        id: "r-spare",
        body: { permissionIds: ["p-users-update"] },
      });

      expect(res.status).toBe(200);
    });
  });

  describe("built-in role protection", () => {
    it.each(BUILT_IN.map((name) => [name]))(
      "PATCH refuses to change the built-in role %s with 409",
      async (name) => {
        const res = await call(updateRoute, {
          id: `r-${name.toLowerCase()}`,
          body: { description: "changed" },
        });

        expect(res.status).toBe(409);
        expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
          "BUILT_IN_ROLE",
        );
        expect(writeQueries()).toHaveLength(0);
      },
    );

    it.each(BUILT_IN.map((name) => [name]))(
      "DELETE refuses to delete the built-in role %s with 409",
      async (name) => {
        const res = await call(deleteRoute, { id: `r-${name.toLowerCase()}` });

        expect(res.status).toBe(409);
        expect(writeQueries()).toHaveLength(0);
      },
    );

    it("PUT permissions refuses to change a built-in role's permission set with 409", async () => {
      const res = await call(setPermsRoute, { id: "r-editor", body: { permissionIds: [] } });

      expect(res.status).toBe(409);
      expect(writeQueries()).toHaveLength(0);
    });
  });

  describe("protection of the role the caller holds", () => {
    it("PATCH refuses to change the caller's own custom role with 409", async () => {
      protectOryCMSAdminRoute.mockResolvedValue({ ...CUSTOM_SESSION, roleName: "Custom" });

      const res = await call(updateRoute, { id: "r-custom", body: { description: "mine" } });

      expect(res.status).toBe(409);
      expect(writeQueries()).toHaveLength(0);
    });

    it("DELETE refuses to delete the caller's own custom role with 409", async () => {
      protectOryCMSAdminRoute.mockResolvedValue({ ...CUSTOM_SESSION, roleName: "Custom" });

      const res = await call(deleteRoute, { id: "r-custom" });

      expect(res.status).toBe(409);
      expect(writeQueries()).toHaveLength(0);
    });
  });

  describe("delete with users assigned", () => {
    it("DELETE refuses a custom role that still has users assigned, with 409 ROLE_IN_USE", async () => {
      usersAssigned = 2;

      const res = await call(deleteRoute, { id: "r-spare" });

      expect(res.status).toBe(409);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe("ROLE_IN_USE");
      expect(writeQueries()).toHaveLength(0);
    });
  });

  describe("driver errors do not leak detail", () => {
    it("POST roles maps a unique-name violation (23505) to 409 without driver text", async () => {
      fakeQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
        if (sql.includes("INSERT INTO orycms_roles")) {
          throw driverError(
            `duplicate key value violates unique constraint for ${FAKE_URL}`,
            "23505",
          );
        }
        return routeFor(sql, params);
      });

      const res = await call(createRoute, { body: { name: "Owner" } });
      const text = await res.text();

      expect(res.status).toBe(409);
      expect(text).toContain("ROLE_NAME_TAKEN");
      expect(text).not.toContain(FAKE_URL);
    });

    it("GET roles maps a driver error to a generic 500 with no connection detail", async () => {
      fakeQuery.mockRejectedValue(driverError(`password authentication failed for ${FAKE_URL}`));

      const res = await call(listRoute);
      const text = await res.text();

      expect(res.status).toBe(500);
      expect(text).not.toContain(FAKE_URL);
      expect(text).not.toContain(FAKE_PASSWORD);
      expect(text).toContain('"INTERNAL_ERROR"');
    });

    it("PUT permissions maps a driver error to a generic 500 with no connection detail", async () => {
      fakeQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
        if (sql.includes("DELETE FROM orycms_role_permissions")) {
          throw driverError(`connection failed: ${FAKE_URL}`, "08006");
        }
        return routeFor(sql, params);
      });

      const res = await call(setPermsRoute, {
        id: "r-spare",
        body: { permissionIds: ["p-roles-read"] },
      });
      const text = await res.text();

      expect(res.status).toBe(500);
      expect(text).not.toContain(FAKE_URL);
      expect(text).not.toContain(FAKE_PASSWORD);
    });

    it("success responses contain no credential-like text", async () => {
      const res = await call(listRoute);

      expect(await res.text()).not.toMatch(/password|secret|postgres(ql)?:\/\/|token|hash/i);
    });
  });
});
