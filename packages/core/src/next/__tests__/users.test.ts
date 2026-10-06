import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OryCMSRoute } from "../dispatcher";

// Users routes. Auth, RBAC and the pool are mocked; the real users, roles and audit
// repositories run. bcrypt is replaced with a fast stub. No database is touched.

const protectOryCMSAdminRoute = vi.fn();
const requireOryCMSPermission = vi.fn();
const getOryCMSUserPermissions = vi.fn();
const fakeQuery = vi.fn();
const fakePool = { query: (...args: unknown[]) => fakeQuery(...args) };

const { OryCMSAuthError } = vi.hoisted(() => {
  class OryCMSAuthError extends Error {
    code: string;
    statusCode: number;
    constructor(code: string, message: string, statusCode = 401) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
    }
  }
  return { OryCMSAuthError };
});

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

vi.mock("bcryptjs", () => ({
  default: {
    hash: async (value: string) => `hashed:${value.length}`,
    compare: async () => false,
  },
}));

// Import AFTER mocks are registered.
const { userRoutes } = await import("../routes/users");

function findRoute(method: string, pattern: string): OryCMSRoute {
  const route = userRoutes.find((r) => r.method === method && r.pattern === pattern);
  if (!route) throw new Error(`${method} ${pattern} not found in userRoutes`);
  return route;
}

const listRoute = findRoute("GET", "users");
const createRoute = findRoute("POST", "users");
const getRoute = findRoute("GET", "users/:id");
const updateRoute = findRoute("PATCH", "users/:id");
const deleteRoute = findRoute("DELETE", "users/:id");

const FAKE_URL = "postgresql://svc_user:Hunter2-fake@db.internal.example:5432/orycms_prod";
const FAKE_PASSWORD = "Hunter2-fake";

function driverError(message: string, code = "28P01"): Error {
  return Object.assign(new Error(message), { code });
}

const FORBIDDEN = new OryCMSAuthError(
  "FORBIDDEN",
  "You do not have permission to perform this action.",
  403,
);

/** The caller in most tests: an Admin, who manages users but does not hold Owner permissions. */
const ADMIN_SESSION = { userId: "u-admin", email: "admin@example.test", roleName: "Admin" };
const ADMIN_PERMS = new Set([
  "users:create",
  "users:read",
  "users:update",
  "users:delete",
  "roles:read",
]);

/** An Owner caller, used for the last-owner rules. */
const OWNER_SESSION = { userId: "u-owner", email: "owner@example.test", roleName: "Owner" };
const OWNER_PERMS = new Set(["roles:manage", "users:manage", "settings:manage"]);

const USERS = [
  {
    id: "u-admin",
    email: "admin@example.test",
    status: "active",
    roleId: "r-admin",
    roleName: "Admin",
  },
  {
    id: "u-owner",
    email: "owner@example.test",
    status: "active",
    roleId: "r-owner",
    roleName: "Owner",
  },
  {
    id: "u-owner2",
    email: "owner2@example.test",
    status: "active",
    roleId: "r-owner",
    roleName: "Owner",
  },
  {
    id: "u-viewer",
    email: "viewer@example.test",
    status: "active",
    roleId: "r-viewer",
    roleName: "Viewer",
  },
];

const ROLES = [
  { id: "r-owner", name: "Owner" },
  { id: "r-admin", name: "Admin" },
  { id: "r-viewer", name: "Viewer" },
  { id: "r-editor", name: "Editor" },
];

/** Permissions held by each role, as the permission-join query returns them. */
const ROLE_PERMS: Record<
  string,
  Array<{ id: string; name: string; resource: string; action: string }>
> = {
  "r-owner": [
    { id: "p1", name: "roles:manage", resource: "roles", action: "manage" },
    { id: "p2", name: "users:manage", resource: "users", action: "manage" },
    { id: "p3", name: "settings:manage", resource: "settings", action: "manage" },
  ],
  "r-admin": [
    { id: "p4", name: "users:create", resource: "users", action: "create" },
    { id: "p5", name: "users:read", resource: "users", action: "read" },
    { id: "p6", name: "users:update", resource: "users", action: "update" },
    { id: "p7", name: "users:delete", resource: "users", action: "delete" },
    { id: "p8", name: "roles:read", resource: "roles", action: "read" },
  ],
  "r-viewer": [{ id: "p8", name: "roles:read", resource: "roles", action: "read" }],
  "r-editor": [{ id: "p9", name: "content:read", resource: "content", action: "read" }],
};

/** Number of other active Owners, as the last-owner count returns it. */
let otherActiveOwners = 1;

function routeFor(sql: string, params: unknown[] = []): { rows: unknown[] } {
  if (sql.includes("INSERT INTO orycms_audit_logs")) return { rows: [] };
  if (sql.includes("COUNT(*)") && sql.includes("orycms_users")) {
    return { rows: [{ count: String(otherActiveOwners) }] };
  }
  if (sql.includes("FROM orycms_users u") && sql.includes("WHERE u.id")) {
    const user = USERS.find((u) => u.id === params[0]);
    return { rows: user ? [user] : [] };
  }
  if (sql.includes("FROM orycms_users u")) return { rows: USERS };
  if (sql.includes("FROM orycms_roles") && sql.includes("WHERE id")) {
    const role = ROLES.find((r) => r.id === params[0]);
    return { rows: role ? [role] : [] };
  }
  if (sql.includes("JOIN orycms_role_permissions")) {
    return { rows: ROLE_PERMS[String(params[0])] ?? [] };
  }
  if (sql.includes("INSERT INTO orycms_users")) {
    return {
      rows: [{ id: "u-new", email: params[0], status: params[3], roleId: params[4] ?? null }],
    };
  }
  if (sql.includes("UPDATE orycms_users")) {
    const user = USERS.find((u) => u.id === params[params.length - 1]);
    return {
      rows: user
        ? [{ id: user.id, email: user.email, status: user.status, roleId: user.roleId }]
        : [],
    };
  }
  return { rows: [] };
}

function ctxFor(route: OryCMSRoute, opts: { id?: string; body?: unknown; raw?: string } = {}) {
  const path = opts.id ? `/api/orycms/users/${opts.id}` : "/api/orycms/users";
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

/** Writes to the users table. */
function userWrites(): string[] {
  return fakeQuery.mock.calls
    .map((c) => String(c[0]))
    .filter((sql) => /^\s*(INSERT|UPDATE|DELETE)\b/.test(sql) && sql.includes("orycms_users"));
}

async function errorBody(res: Response): Promise<{ code: string; message: string }> {
  return ((await res.json()) as { error: { code: string; message: string } }).error;
}

beforeEach(() => {
  protectOryCMSAdminRoute.mockReset();
  requireOryCMSPermission.mockReset();
  getOryCMSUserPermissions.mockReset();
  fakeQuery.mockReset();
  otherActiveOwners = 1;
  protectOryCMSAdminRoute.mockResolvedValue(ADMIN_SESSION);
  requireOryCMSPermission.mockResolvedValue(undefined);
  getOryCMSUserPermissions.mockImplementation(async (roleName: string) =>
    roleName === "Owner" ? OWNER_PERMS : ADMIN_PERMS,
  );
  fakeQuery.mockImplementation(async (sql: string, params?: unknown[]) => routeFor(sql, params));
});

describe("users routes (packages/core)", () => {
  describe("authentication and permission", () => {
    it("rejects an unauthenticated list request with 401 and never queries", async () => {
      protectOryCMSAdminRoute.mockRejectedValue(
        new OryCMSAuthError("UNAUTHORIZED", "Authentication required.", 401),
      );

      const res = await call(listRoute);

      expect(res.status).toBe(401);
      expect(fakeQuery).not.toHaveBeenCalled();
    });

    it("rejects a caller without users:read on the list route with 403", async () => {
      requireOryCMSPermission.mockRejectedValue(FORBIDDEN);

      const res = await call(listRoute);

      expect(res.status).toBe(403);
      expect(requireOryCMSPermission).toHaveBeenCalledWith(
        ADMIN_SESSION,
        "users",
        "read",
        fakePool,
      );
    });

    it.each([
      ["POST users", createRoute, { body: { email: "new@example.test" } }, "create"],
      [
        "PATCH users/:id",
        updateRoute,
        { id: "u-viewer", body: { email: "x@example.test" } },
        "update",
      ],
      ["DELETE users/:id", deleteRoute, { id: "u-viewer" }, "delete"],
    ])(
      "%s rejects a caller without users:%s with 403 and never writes",
      async (_label, route, opts, action) => {
        requireOryCMSPermission.mockRejectedValue(FORBIDDEN);

        const res = await call(route, opts);

        expect(res.status).toBe(403);
        expect(requireOryCMSPermission).toHaveBeenCalledWith(
          ADMIN_SESSION,
          "users",
          action,
          fakePool,
        );
        expect(userWrites()).toHaveLength(0);
      },
    );

    it("rejects an unauthenticated write with 401 and never writes", async () => {
      protectOryCMSAdminRoute.mockRejectedValue(
        new OryCMSAuthError("UNAUTHORIZED", "Authentication required.", 401),
      );

      const res = await call(deleteRoute, { id: "u-viewer" });

      expect(res.status).toBe(401);
      expect(userWrites()).toHaveLength(0);
    });
  });

  describe("success paths and safe response fields", () => {
    it("list returns only safe user fields (no hashes or credentials)", async () => {
      const res = await call(listRoute);

      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: Array<Record<string, unknown>> };
      for (const row of body.data) {
        expect(Object.keys(row).sort()).toEqual(["email", "id", "roleId", "roleName", "status"]);
      }
      expect(await (await call(listRoute)).text()).not.toMatch(
        /hash|password|token|session|secret/i,
      );
    });

    it("list selects an explicit column list, never SELECT *", async () => {
      await call(listRoute);

      const sql = String(fakeQuery.mock.calls[0][0]);
      expect(sql).not.toMatch(/SELECT\s+\*/i);
      expect(sql).not.toContain("passwordHash");
    });

    it("get returns 200 with the safe fields only", async () => {
      const res = await call(getRoute, { id: "u-viewer" });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: Record<string, unknown> };
      expect(Object.keys(body.data).sort()).toEqual([
        "email",
        "id",
        "roleId",
        "roleName",
        "status",
      ]);
    });

    it("get returns 404 for an unknown user", async () => {
      const res = await call(getRoute, { id: "u-missing" });

      expect(res.status).toBe(404);
    });

    it("create with a valid email and role returns 201 with safe fields and records an audit row", async () => {
      const res = await call(createRoute, {
        body: {
          email: "New.User@Example.test",
          roleId: "r-viewer",
          status: "active",
          password: "longenough1",
        },
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as { data: Record<string, unknown> };
      expect(Object.keys(body.data).sort()).toEqual(["email", "id", "roleId", "status"]);
      expect(fakeQuery.mock.calls.some((c) => String(c[0]).includes("orycms_audit_logs"))).toBe(
        true,
      );
    });

    it("update of the caller's own email returns 200", async () => {
      const res = await call(updateRoute, {
        id: "u-admin",
        body: { email: "admin.new@example.test" },
      });

      expect(res.status).toBe(200);
    });

    it("update of a lower-privilege user to a lower-privilege role returns 200", async () => {
      const res = await call(updateRoute, { id: "u-viewer", body: { roleId: "r-viewer" } });

      expect(res.status).toBe(200);
    });

    it("delete of a lower-privilege user returns 200", async () => {
      const res = await call(deleteRoute, { id: "u-viewer" });

      expect(res.status).toBe(200);
      expect(((await res.json()) as { data: unknown }).data).toEqual({
        id: "u-viewer",
        deleted: true,
      });
    });
  });

  describe("invalid bodies", () => {
    it("rejects a missing email with 422", async () => {
      const res = await call(createRoute, { body: { roleId: "r-viewer" } });

      expect(res.status).toBe(422);
      expect(userWrites()).toHaveLength(0);
    });

    it("rejects a malformed email with 422", async () => {
      const res = await call(createRoute, { body: { email: "not-an-email" } });

      expect(res.status).toBe(422);
      expect(userWrites()).toHaveLength(0);
    });

    it("rejects an email longer than 254 characters with 422", async () => {
      const res = await call(createRoute, { body: { email: `${"a".repeat(250)}@x.co` } });

      expect(res.status).toBe(422);
    });

    it("rejects a non-string email with 422", async () => {
      const res = await call(createRoute, { body: { email: { nested: true } } });

      expect(res.status).toBe(422);
    });

    it("rejects a password shorter than 8 characters with 422", async () => {
      const res = await call(createRoute, { body: { email: "a@example.test", password: "short" } });

      expect(res.status).toBe(422);
      expect(userWrites()).toHaveLength(0);
    });

    it("rejects a password longer than 72 bytes with 422", async () => {
      const res = await call(createRoute, {
        body: { email: "a@example.test", password: "p".repeat(73) },
      });

      expect(res.status).toBe(422);
    });

    it("rejects an unknown status value with 422", async () => {
      const res = await call(createRoute, { body: { email: "a@example.test", status: "deleted" } });

      expect(res.status).toBe(422);
    });

    it("rejects a non-string roleId with 422", async () => {
      const res = await call(createRoute, { body: { email: "a@example.test", roleId: { x: 1 } } });

      expect(res.status).toBe(422);
    });

    it("rejects a roleId that does not exist with 422, and never puts the value into SQL text", async () => {
      const res = await call(createRoute, {
        body: { email: "a@example.test", roleId: "r-nope'; DROP TABLE x;--" },
      });

      expect(res.status).toBe(422);
      expect(userWrites()).toHaveLength(0);
      for (const c of fakeQuery.mock.calls) expect(String(c[0])).not.toContain("DROP TABLE");
    });

    it("rejects malformed JSON with 422, not a 500", async () => {
      const res = await call(createRoute, { raw: "{not json" });

      expect(res.status).toBe(422);
    });

    it("update rejects a status value outside the known set with 422", async () => {
      const res = await call(updateRoute, { id: "u-viewer", body: { status: "banned" } });

      expect(res.status).toBe(422);
      expect(userWrites()).toHaveLength(0);
    });
  });

  describe("privilege: assigning roles", () => {
    it("denies assigning a role whose permissions the caller does not hold (Admin → Owner)", async () => {
      const res = await call(createRoute, {
        body: { email: "promote@example.test", roleId: "r-owner" },
      });

      expect(res.status).toBe(403);
      expect(userWrites()).toHaveLength(0);
    });

    it("denies a role with a single permission the caller lacks (Admin → Editor)", async () => {
      const res = await call(updateRoute, { id: "u-viewer", body: { roleId: "r-editor" } });

      expect(res.status).toBe(403);
      expect(userWrites()).toHaveLength(0);
    });

    it("allows assigning a role whose permissions are a subset of the caller's (Admin → Viewer)", async () => {
      const res = await call(updateRoute, { id: "u-viewer", body: { roleId: "r-viewer" } });

      expect(res.status).toBe(200);
    });

    it("denies editing a user whose current role has permissions the caller does not hold", async () => {
      const res = await call(updateRoute, {
        id: "u-owner",
        body: { email: "changed@example.test" },
      });

      expect(res.status).toBe(403);
      expect(userWrites()).toHaveLength(0);
    });

    it("denies deleting a user whose current role has permissions the caller does not hold", async () => {
      const res = await call(deleteRoute, { id: "u-owner2" });

      expect(res.status).toBe(403);
      expect(userWrites()).toHaveLength(0);
    });
  });

  describe("self-protection", () => {
    it("refuses to deactivate the caller's own account with 409", async () => {
      const res = await call(updateRoute, { id: "u-admin", body: { status: "inactive" } });

      expect(res.status).toBe(409);
      expect((await errorBody(res)).code).toBe("SELF_ACTION");
      expect(userWrites()).toHaveLength(0);
    });

    it("refuses to change the caller's own role with 409", async () => {
      const res = await call(updateRoute, { id: "u-admin", body: { roleId: "r-viewer" } });

      expect(res.status).toBe(409);
      expect(userWrites()).toHaveLength(0);
    });

    it("refuses to delete the caller's own account with 409", async () => {
      const res = await call(deleteRoute, { id: "u-admin" });

      expect(res.status).toBe(409);
      expect(userWrites()).toHaveLength(0);
    });
  });

  describe("last Owner", () => {
    it("refuses to delete the last active Owner with 409 LAST_OWNER", async () => {
      otherActiveOwners = 0;
      protectOryCMSAdminRoute.mockResolvedValue(OWNER_SESSION);

      const res = await call(deleteRoute, { id: "u-owner2" });

      expect(res.status).toBe(409);
      expect((await errorBody(res)).code).toBe("LAST_OWNER");
      expect(userWrites()).toHaveLength(0);
    });

    it("refuses to demote the last active Owner with 409", async () => {
      otherActiveOwners = 0;
      protectOryCMSAdminRoute.mockResolvedValue(OWNER_SESSION);

      const res = await call(updateRoute, { id: "u-owner2", body: { roleId: "r-viewer" } });

      expect(res.status).toBe(409);
      expect(userWrites()).toHaveLength(0);
    });

    it("refuses to deactivate the last active Owner with 409", async () => {
      otherActiveOwners = 0;
      protectOryCMSAdminRoute.mockResolvedValue(OWNER_SESSION);

      const res = await call(updateRoute, { id: "u-owner2", body: { status: "inactive" } });

      expect(res.status).toBe(409);
      expect(userWrites()).toHaveLength(0);
    });

    it("allows deleting an Owner when another active Owner remains", async () => {
      otherActiveOwners = 1;
      protectOryCMSAdminRoute.mockResolvedValue(OWNER_SESSION);

      const res = await call(deleteRoute, { id: "u-owner2" });

      expect(res.status).toBe(200);
    });
  });

  describe("driver errors do not leak detail", () => {
    it("list returns a generic 500 for a driver error", async () => {
      fakeQuery.mockRejectedValue(driverError(`password authentication failed for ${FAKE_URL}`));

      const res = await call(listRoute);
      const text = await res.text();

      expect(res.status).toBe(500);
      expect(text).not.toContain(FAKE_URL);
      expect(text).not.toContain(FAKE_PASSWORD);
    });

    it("a duplicate email (23505) returns 409 EMAIL_TAKEN without driver text", async () => {
      fakeQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
        if (sql.includes("INSERT INTO orycms_users")) {
          throw driverError(`duplicate key for ${FAKE_URL}`, "23505");
        }
        return routeFor(sql, params);
      });

      const res = await call(createRoute, { body: { email: "viewer@example.test" } });
      const text = await res.text();

      expect(res.status).toBe(409);
      expect(text).toContain("EMAIL_TAKEN");
      expect(text).not.toContain(FAKE_URL);
    });

    it("an unexpected driver error on insert returns a generic 500", async () => {
      fakeQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
        if (sql.includes("INSERT INTO orycms_users"))
          throw driverError(`connect failed ${FAKE_URL}`, "08006");
        return routeFor(sql, params);
      });

      const res = await call(createRoute, { body: { email: "fresh@example.test" } });
      const text = await res.text();

      expect(res.status).toBe(500);
      expect(text).not.toContain(FAKE_URL);
    });
  });
});
