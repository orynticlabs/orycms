import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Pool } from "pg";
import { clearOryCMSPermissionCache } from "@/rbac";

// ── Mock the DB pool so handlers that call getOryCMSPool() hit our fake. ──────────
// A per-test mutable query impl lets each test shape the rows it needs.
let queryImpl: (sql: string, params?: unknown[]) => unknown = () => ({ rows: [] });
const poolQuery = vi.fn((sql: string, params?: unknown[]) => queryImpl(sql, params));

vi.mock("@/lib/db", () => ({
  getOryCMSPool: () => ({ query: poolQuery }) as unknown as Pool,
}));

// bootstrapOryCMS opens a real pg adapter — stub it so setup/migrations don't connect.
vi.mock("@/core", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    bootstrapOryCMS: vi.fn(async () => ({
      install: { success: true, applied: [], skipped: [], failed: [] },
      seeded: true,
    })),
  };
});

const { createOryCMSRouteHandlers } = await import("../dispatcher");
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

/** Rows an authenticated session + a fully-permissioned Owner role need. */
function authAs(roleName: string, perms: Array<{ resource: string; action: string }>) {
  queryImpl = (sql: string) => {
    if (sql.includes("FROM orycms_sessions")) {
      return { rows: [{ userId: "u1", email: "owner@acme.io", roleName }] };
    }
    if (sql.includes("FROM orycms_permissions")) return { rows: perms };
    return { rows: [] };
  };
}

beforeEach(() => {
  queryImpl = () => ({ rows: [] });
  poolQuery.mockClear();
  clearOryCMSPermissionCache();
});

// ── Routing / matching ───────────────────────────────────────────────────────────

describe("dispatcher routing", () => {
  it("returns 404 for an unknown route", async () => {
    const res = await handlers.GET(req("/api/orycms/nope/nowhere"));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 when the path is outside basePath", async () => {
    const res = await handlers.GET(req("/api/other/thing"));
    expect(res.status).toBe(404);
  });

  it("returns 405 for a known path with the wrong method", async () => {
    // /auth/login exists for POST, not GET.
    const res = await handlers.GET(req("/api/orycms/auth/login"));
    expect(res.status).toBe(405);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("METHOD_NOT_ALLOWED");
  });

  it("respects a custom basePath", async () => {
    const custom = createOryCMSRouteHandlers({ basePath: "/cms/api" });
    const res = await custom.GET(req("/cms/api/auth/setup-status"));
    expect(res.status).toBe(200);
  });
});

// ── Public endpoints ─────────────────────────────────────────────────────────────

describe("public auth endpoints", () => {
  it("GET /auth/setup-status returns initialized flag", async () => {
    queryImpl = (sql) => (sql.includes("orycms_users") ? { rows: [{ "1": 1 }] } : { rows: [] });
    const res = await handlers.GET(req("/api/orycms/auth/setup-status"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { initialized: boolean } };
    expect(body).toEqual({ success: true, data: { initialized: true } });
  });

  it("POST /auth/login validates required fields (422)", async () => {
    const res = await handlers.POST(req("/api/orycms/auth/login", { method: "POST", body: {} }));
    expect(res.status).toBe(422);
  });

  it("POST /auth/login sets the session cookie on success", async () => {
    // No user rows exist → auth would fail; simulate a valid user + bcrypt hash.
    const bcrypt = (await import("bcryptjs")).default;
    const hash = await bcrypt.hash("supersecret", 10);
    queryImpl = (sql: string) => {
      if (sql.includes("SELECT id, email")) {
        return { rows: [{ id: "u1", email: "owner@acme.io", passwordHash: hash, status: "active", roleId: "r1" }] };
      }
      return { rows: [] }; // INSERT session
    };
    const res = await handlers.POST(
      req("/api/orycms/auth/login", { method: "POST", body: { email: "owner@acme.io", password: "supersecret" } }),
    );
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("orycms_session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Max-Age=2592000");
  });

  it("POST /auth/logout clears the session cookie", async () => {
    const res = await handlers.POST(
      req("/api/orycms/auth/logout", { method: "POST", cookie: "orycms_session=tok" }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie") ?? "").toContain("Max-Age=0");
  });

  it("POST /auth/setup provisions the owner and returns 201 (no cookie)", async () => {
    // hasOryCMSInitialUser → false, then role upsert + user insert return ids.
    queryImpl = (sql: string) => {
      if (sql.includes("SELECT 1 FROM orycms_users")) return { rows: [] };
      if (sql.includes("INSERT INTO orycms_roles")) return { rows: [{ id: "r1" }] };
      if (sql.includes("INSERT INTO orycms_users")) {
        return { rows: [{ id: "u1", email: "owner@acme.io", roleId: "r1", status: "active" }] };
      }
      return { rows: [] };
    };
    const res = await handlers.POST(
      req("/api/orycms/auth/setup", { method: "POST", body: { email: "owner@acme.io", password: "supersecret" } }),
    );
    expect(res.status).toBe(201);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});

// ── Guarded endpoints ────────────────────────────────────────────────────────────

describe("guarded endpoints", () => {
  it("GET /auth/me returns 401 without a session", async () => {
    const res = await handlers.GET(req("/api/orycms/auth/me"));
    expect(res.status).toBe(401);
  });

  it("GET /users returns 401 without a session", async () => {
    const res = await handlers.GET(req("/api/orycms/users"));
    expect(res.status).toBe(401);
  });

  it("GET /users returns 403 when the role lacks the permission", async () => {
    authAs("Viewer", [{ resource: "content", action: "read" }]);
    const res = await handlers.GET(req("/api/orycms/users", { cookie: "orycms_session=tok" }));
    expect(res.status).toBe(403);
  });

  it("GET /users succeeds for a permitted role and extracts no params", async () => {
    authAs("Owner", [{ resource: "users", action: "manage" }]);
    const res = await handlers.GET(req("/api/orycms/users", { cookie: "orycms_session=tok" }));
    expect(res.status).toBe(200);
  });

  it("GET /users/:id extracts the id param", async () => {
    authAs("Owner", [{ resource: "users", action: "manage" }]);
    queryImpl = (sql: string) => {
      if (sql.includes("FROM orycms_sessions")) return { rows: [{ userId: "u1", email: "o@a.co", roleName: "Owner" }] };
      if (sql.includes("FROM orycms_permissions")) return { rows: [{ resource: "users", action: "manage" }] };
      if (sql.includes("FROM orycms_users")) return { rows: [{ id: "u42", email: "x@y.co", status: "active", roleId: null }] };
      return { rows: [] };
    };
    const res = await handlers.GET(req("/api/orycms/users/u42", { cookie: "orycms_session=tok" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe("u42");
  });
});

// ── Route ordering: media/folders (literal) vs media/:id (param) ─────────────────

describe("literal-vs-param ordering", () => {
  it("GET /media/folders hits the folders handler, not media/:id", async () => {
    authAs("Owner", [{ resource: "media", action: "manage" }]);
    // media/folders lists folders (data is an array); media/:id would call getOryCMSMedia(id).
    const res = await handlers.GET(req("/api/orycms/media/folders", { cookie: "orycms_session=tok" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown };
    expect(Array.isArray(body.data)).toBe(true); // folder list, not a single asset
  });
});

// ── 501 stubs still enforce auth first ───────────────────────────────────────────

describe("501 stubs", () => {
  it("GET /plugins returns 401 without a session (guard runs before 501)", async () => {
    const res = await handlers.GET(req("/api/orycms/plugins"));
    expect(res.status).toBe(401);
  });

  it("GET /plugins returns 501 for a permitted role", async () => {
    authAs("Owner", [{ resource: "plugins", action: "manage" }]);
    const res = await handlers.GET(req("/api/orycms/plugins", { cookie: "orycms_session=tok" }));
    expect(res.status).toBe(501);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("PUT /roles/:id/permissions is routable (the only PUT)", async () => {
    authAs("Owner", [{ resource: "roles", action: "manage" }]);
    const res = await handlers.PUT(
      req("/api/orycms/roles/r1/permissions", {
        method: "PUT",
        cookie: "orycms_session=tok",
        body: { permissionIds: [] },
      }),
    );
    expect(res.status).toBe(200);
  });
});
