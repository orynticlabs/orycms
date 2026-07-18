import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Pool } from "pg";

// ── Mock the DB pool so handlers that call getOryCMSPool() hit our fake. ──────────
// A per-test mutable query impl lets each test shape the rows it needs.
let queryImpl: (sql: string, params?: unknown[]) => unknown = () => ({ rows: [] });
const poolQuery = vi.fn((sql: string, params?: unknown[]) => queryImpl(sql, params));

vi.mock("@/lib/db", () => ({
  getOryCMSPool: () => ({ query: poolQuery }) as unknown as Pool,
}));

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

beforeEach(() => {
  queryImpl = () => ({ rows: [] });
  poolQuery.mockClear();
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

  it("does not ship advanced module routes", async () => {
    for (const path of ["users", "media/folders", "plugins", "collections", "seo"]) {
      const res = await handlers.GET(req(`/api/orycms/${path}`));
      expect(res.status).toBe(404);
    }
  });
});
