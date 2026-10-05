import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";

// ── Mock the DB pool so handlers that call getOryCMSPool() hit our fake. ──────────
// Full-stack style (matches dispatcher.test.ts): only the DB boundary is mocked,
// every other layer (auth.ts, route-guards.ts, hooks, the dispatcher itself) is real.
let queryImpl: (sql: string, params?: unknown[]) => unknown = () => ({ rows: [] });
const poolQuery = vi.fn((sql: string, params?: unknown[]) => queryImpl(sql, params));

vi.mock("@/lib/db", () => ({
  getOryCMSPool: () => ({ query: poolQuery }) as unknown as Pool,
}));

// bootstrapOryCMS opens its own adapter connection (not the mocked pool above), so
// it must be mocked wholesale — same pattern as the root route's own test
// (app/api/orycms/auth/setup/__tests__/route.test.ts).
const bootstrapOryCMS = vi.fn();
vi.mock("@/core", () => ({
  bootstrapOryCMS: (...args: unknown[]) => bootstrapOryCMS(...args),
}));

const { createOryCMSRouteHandlers } = await import("../dispatcher");
const { registerOryCMSHook, clearOryCMSHooks } = await import("@/hooks");
const { clearOryCMSPermissionCache } = await import("@/rbac");
const handlers = createOryCMSRouteHandlers();

function req(
  path: string,
  init: { method?: string; cookie?: string; body?: unknown } = {},
): Request {
  const headers = new Headers();
  if (init.cookie) headers.set("cookie", init.cookie);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  return new Request(`http://localhost${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

async function bcryptHash(password: string): Promise<string> {
  const bcrypt = (await import("bcryptjs")).default;
  return bcrypt.hash(password, 10);
}

beforeEach(() => {
  queryImpl = () => ({ rows: [] });
  poolQuery.mockClear();
  bootstrapOryCMS.mockReset();
  clearOryCMSPermissionCache();
});

afterEach(() => {
  clearOryCMSHooks();
  clearOryCMSPermissionCache();
});

// ── POST /auth/login ─────────────────────────────────────────────────────────────

describe("POST /auth/login", () => {
  it("validates required fields (422)", async () => {
    const res = await handlers.POST(req("/api/orycms/auth/login", { method: "POST", body: {} }));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("success: sets the session cookie with the right flags and returns the user", async () => {
    const hash = await bcryptHash("supersecret");
    queryImpl = (sql: string) => {
      if (sql.includes("SELECT id, email")) {
        return {
          rows: [
            {
              id: "u1",
              email: "owner@acme.io",
              passwordHash: hash,
              status: "active",
              roleId: "r1",
            },
          ],
        };
      }
      return { rows: [] }; // INSERT session
    };
    const res = await handlers.POST(
      req("/api/orycms/auth/login", {
        method: "POST",
        body: { email: "owner@acme.io", password: "supersecret" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: { userId: string; email: string };
    };
    expect(body).toEqual({ success: true, data: { userId: "u1", email: "owner@acme.io" } });

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("orycms_session=");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Max-Age=2592000");
    // NODE_ENV is not "production" in the test run, so Secure must be absent.
    expect(setCookie).not.toContain("Secure");
  });

  it("wrong password: 401 INVALID_CREDENTIALS, no cookie set", async () => {
    const hash = await bcryptHash("supersecret");
    queryImpl = (sql: string) =>
      sql.includes("SELECT id, email")
        ? {
            rows: [
              {
                id: "u1",
                email: "owner@acme.io",
                passwordHash: hash,
                status: "active",
                roleId: "r1",
              },
            ],
          }
        : { rows: [] };
    const res = await handlers.POST(
      req("/api/orycms/auth/login", {
        method: "POST",
        body: { email: "owner@acme.io", password: "wrongpass" },
      }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };
    expect(body).toEqual({
      success: false,
      error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." },
    });
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("unknown user: 401 with the SAME response body as a wrong password (no user-enumeration signal)", async () => {
    queryImpl = () => ({ rows: [] }); // no matching user row
    const res = await handlers.POST(
      req("/api/orycms/auth/login", {
        method: "POST",
        body: { email: "ghost@acme.io", password: "wrongpass" },
      }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as unknown;
    expect(body).toEqual({
      success: false,
      error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." },
    });
    // Note: this only proves response-body/status identity between "unknown user" and
    // "wrong password" (authenticateOryCMSUser always runs bcrypt.compare against a
    // constant dummy hash when no row is found, specifically to avoid a timing leak).
    // It does not measure actual wall-clock timing — that is NOT verified here.
  });

  it("inactive user: 403 ACCOUNT_INACTIVE", async () => {
    const hash = await bcryptHash("supersecret");
    queryImpl = (sql: string) =>
      sql.includes("SELECT id, email")
        ? {
            rows: [
              {
                id: "u1",
                email: "owner@acme.io",
                passwordHash: hash,
                status: "inactive",
                roleId: "r1",
              },
            ],
          }
        : { rows: [] };
    const res = await handlers.POST(
      req("/api/orycms/auth/login", {
        method: "POST",
        body: { email: "owner@acme.io", password: "supersecret" },
      }),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("ACCOUNT_INACTIVE");
  });

  it("fires beforeLogin (with the normalized email) and afterLogin (with id/email) on success", async () => {
    const hash = await bcryptHash("supersecret");
    queryImpl = (sql: string) =>
      sql.includes("SELECT id, email")
        ? {
            rows: [
              {
                id: "u1",
                email: "owner@acme.io",
                passwordHash: hash,
                status: "active",
                roleId: "r1",
              },
            ],
          }
        : { rows: [] };
    const before = vi.fn();
    const after = vi.fn();
    registerOryCMSHook("beforeLogin", before);
    registerOryCMSHook("afterLogin", after);

    await handlers.POST(
      req("/api/orycms/auth/login", {
        method: "POST",
        body: { email: "OWNER@acme.io", password: "supersecret" },
      }),
    );

    expect(before).toHaveBeenCalledTimes(1);
    expect(before.mock.calls[0][0].data).toEqual({ email: "owner@acme.io" });
    expect(after).toHaveBeenCalledTimes(1);
    expect(after.mock.calls[0][0].data).toEqual({ id: "u1", email: "owner@acme.io" });
  });

  it("does NOT fire afterLogin when login fails", async () => {
    queryImpl = () => ({ rows: [] });
    const before = vi.fn();
    const after = vi.fn();
    registerOryCMSHook("beforeLogin", before);
    registerOryCMSHook("afterLogin", after);

    await handlers.POST(
      req("/api/orycms/auth/login", {
        method: "POST",
        body: { email: "ghost@acme.io", password: "wrongpass" },
      }),
    );

    expect(before).toHaveBeenCalledTimes(1);
    expect(after).not.toHaveBeenCalled();
  });
});

// ── POST /auth/logout ─────────────────────────────────────────────────────────────

describe("POST /auth/logout", () => {
  it("clears the session cookie with the same flags login sets (minus the value/Max-Age)", async () => {
    const res = await handlers.POST(
      req("/api/orycms/auth/logout", { method: "POST", cookie: "orycms_session=tok" }),
    );
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("orycms_session=;");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Max-Age=0");
    expect(setCookie).not.toContain("Secure");
  });

  it("succeeds (and still clears the cookie) even with no session cookie present", async () => {
    const res = await handlers.POST(req("/api/orycms/auth/logout", { method: "POST" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie") ?? "").toContain("Max-Age=0");
    expect(poolQuery).not.toHaveBeenCalled(); // no token → destroyOryCMSUserSession never runs
  });

  it("fires beforeLogout and afterLogout", async () => {
    const before = vi.fn();
    const after = vi.fn();
    registerOryCMSHook("beforeLogout", before);
    registerOryCMSHook("afterLogout", after);

    await handlers.POST(
      req("/api/orycms/auth/logout", { method: "POST", cookie: "orycms_session=tok" }),
    );

    expect(before).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
  });
});

// ── GET /auth/session ────────────────────────────────────────────────────────────

// Root's GET /api/orycms/auth/session (app/api/orycms/auth/session/route.ts) returns
// {success:true,data:{user:{...}}} on success and {success:false,data:null} (status
// only, no error object) on ANY failure. Fixed here per U1-3.1b bug #2 — these tests
// now assert root's exact shape, not the dispatcher's old flat/error-object shape.
describe("GET /auth/session", () => {
  it("401 with {success:false,data:null} (root's shape) with no session cookie", async () => {
    const res = await handlers.GET(req("/api/orycms/auth/session"));
    expect(res.status).toBe(401);
    const body = (await res.json()) as unknown;
    expect(body).toEqual({ success: false, data: null });
  });

  it("401 with {success:false,data:null} when the cookie's token matches no live session row", async () => {
    queryImpl = () => ({ rows: [] }); // getOryCMSCurrentSession finds nothing
    const res = await handlers.GET(
      req("/api/orycms/auth/session", { cookie: "orycms_session=bogus" }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as unknown;
    expect(body).toEqual({ success: false, data: null });
  });

  it("success: returns {success:true,data:{user:{...}}} — nested under `user`, matching root", async () => {
    queryImpl = () => ({ rows: [{ userId: "u1", email: "owner@acme.io", roleName: "Owner" }] });
    const res = await handlers.GET(
      req("/api/orycms/auth/session", { cookie: "orycms_session=tok" }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    expect(body).toEqual({
      success: true,
      data: { user: { userId: "u1", email: "owner@acme.io", roleName: "Owner" } },
    });
  });
});

// ── GET /auth/me ─────────────────────────────────────────────────────────────────

// Root's GET /api/orycms/auth/me (app/api/orycms/auth/me/route.ts) computes the REAL
// permission list via getOryCMSUserPermissions(roleName). Fixed here per U1-3.1b bug
// #1 — these tests now assert the real lookup, not a hardcoded empty array.
describe("GET /auth/me", () => {
  it("401 UNAUTHORIZED with no session cookie", async () => {
    const res = await handlers.GET(req("/api/orycms/auth/me"));
    expect(res.status).toBe(401);
  });

  it("success: returns the REAL permission list for the session's role (matching root)", async () => {
    queryImpl = (sql: string) => {
      if (sql.includes("orycms_permissions")) {
        return {
          rows: [
            { resource: "collections", action: "read" },
            { resource: "users", action: "manage" },
          ],
        };
      }
      return { rows: [{ userId: "u1", email: "owner@acme.io", roleName: "Owner" }] };
    };
    const res = await handlers.GET(req("/api/orycms/auth/me", { cookie: "orycms_session=tok" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    expect(body).toEqual({
      success: true,
      data: {
        user: { id: "u1", email: "owner@acme.io" },
        roleName: "Owner",
        permissions: ["collections:read", "users:manage"],
      },
    });
  });

  it("success: returns an empty permission list when the session has no role (not an error)", async () => {
    queryImpl = () => ({ rows: [{ userId: "u1", email: "owner@acme.io", roleName: null }] });
    const res = await handlers.GET(req("/api/orycms/auth/me", { cookie: "orycms_session=tok" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    expect(body).toEqual({
      success: true,
      data: { user: { id: "u1", email: "owner@acme.io" }, roleName: null, permissions: [] },
    });
  });
});

// ── POST /auth/setup ─────────────────────────────────────────────────────────────

// Root's POST /api/orycms/auth/setup (app/api/orycms/auth/setup/route.ts) calls
// bootstrapOryCMS() (full 11-table schema install + default role/permission seeding)
// and explicitly checks bootstrap.install.success, returning a distinct
// SCHEMA_INSTALL_FAILED/500 if it fails. Fixed here per U1-3.1b bug #3 — the
// dispatcher now calls the same bootstrapOryCMS() (mocked below, same pattern as
// app/api/orycms/auth/setup/__tests__/route.test.ts, since it opens its own adapter
// connection rather than going through the mocked pool).
describe("POST /auth/setup", () => {
  it("validates required fields (422)", async () => {
    const res = await handlers.POST(req("/api/orycms/auth/setup", { method: "POST", body: {} }));
    expect(res.status).toBe(422);
    expect(bootstrapOryCMS).not.toHaveBeenCalled();
  });

  it("success: bootstraps the full schema (+ seeds), provisions the owner, returns 201, sets no cookie", async () => {
    bootstrapOryCMS.mockResolvedValue({
      install: { success: true, applied: ["m1"], skipped: [], failed: [] },
      seeded: true,
    });
    queryImpl = (sql: string) => {
      if (sql.includes("SELECT 1 FROM orycms_users")) return { rows: [] };
      if (sql.includes("INSERT INTO orycms_roles")) return { rows: [{ id: "r1" }] };
      if (sql.includes("INSERT INTO orycms_users")) {
        return { rows: [{ id: "u1", email: "owner@acme.io", roleId: "r1", status: "active" }] };
      }
      return { rows: [] };
    };
    const res = await handlers.POST(
      req("/api/orycms/auth/setup", {
        method: "POST",
        body: { email: "owner@acme.io", password: "supersecret" },
      }),
    );
    expect(bootstrapOryCMS).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      success: boolean;
      data: { userId: string; email: string };
    };
    expect(body).toEqual({ success: true, data: { userId: "u1", email: "owner@acme.io" } });
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("returns 500 SCHEMA_INSTALL_FAILED and skips owner creation when bootstrap's install fails", async () => {
    bootstrapOryCMS.mockResolvedValue({
      install: {
        success: false,
        applied: [],
        skipped: [],
        failed: [{ migrationId: "m1", name: "m1", error: "boom" }],
      },
      seeded: false,
    });
    const res = await handlers.POST(
      req("/api/orycms/auth/setup", {
        method: "POST",
        body: { email: "owner@acme.io", password: "supersecret" },
      }),
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("SCHEMA_INSTALL_FAILED");
    // No owner-creation query should have run.
    const ranOwnerInsert = poolQuery.mock.calls.some(([sql]) =>
      String(sql).includes("INSERT INTO orycms_users"),
    );
    expect(ranOwnerInsert).toBe(false);
  });

  it("maps an OryCMSAuthError (e.g. SETUP_ALREADY_DONE) to its status code", async () => {
    bootstrapOryCMS.mockResolvedValue({
      install: { success: true, applied: [], skipped: [], failed: [] },
      seeded: true,
    });
    queryImpl = (sql: string) =>
      sql.includes("SELECT 1 FROM orycms_users") ? { rows: [{ "1": 1 }] } : { rows: [] };
    const res = await handlers.POST(
      req("/api/orycms/auth/setup", {
        method: "POST",
        body: { email: "owner@acme.io", password: "supersecret" },
      }),
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("SETUP_ALREADY_DONE");
  });
});

// ── GET /auth/setup-status ────────────────────────────────────────────────────────

// Root's GET /api/orycms/auth/setup-status (app/api/orycms/auth/setup-status/route.ts)
// is a pure read — it never installs anything. Fixed here per U1-3.1b bug #4 — the
// dispatcher no longer calls the (now-deleted) installOryCMSAuthSchema() first.
describe("GET /auth/setup-status", () => {
  it("is a pure read: never runs a schema-creating (CREATE TABLE / CREATE EXTENSION) query", async () => {
    queryImpl = () => ({ rows: [] });
    await handlers.GET(req("/api/orycms/auth/setup-status"));
    const ranSchemaDdl = poolQuery.mock.calls.some(([sql]) =>
      /CREATE TABLE|CREATE EXTENSION/.test(String(sql)),
    );
    expect(ranSchemaDdl).toBe(false);
  });

  it("returns initialized: true when a user already exists", async () => {
    queryImpl = (sql: string) =>
      sql.includes("orycms_users") ? { rows: [{ "1": 1 }] } : { rows: [] };
    const res = await handlers.GET(req("/api/orycms/auth/setup-status"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    expect(body).toEqual({ success: true, data: { initialized: true } });
  });

  it("returns initialized: false on a fresh database", async () => {
    queryImpl = () => ({ rows: [] });
    const res = await handlers.GET(req("/api/orycms/auth/setup-status"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    expect(body).toEqual({ success: true, data: { initialized: false } });
  });

  it("returns 503 DB_ERROR when the connection check throws", async () => {
    queryImpl = () => {
      throw new Error("connection refused");
    };
    const res = await handlers.GET(req("/api/orycms/auth/setup-status"));
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("DB_ERROR");
  });
});
