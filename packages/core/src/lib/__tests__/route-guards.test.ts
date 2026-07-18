import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import { guardOryCMS, toErrorResponse, oryJsonOk, oryJsonError } from "../route-guards";
import { OryCMSAuthError } from "@/auth";
import { clearOryCMSPermissionCache } from "@/rbac";

// ── Mock pool ──────────────────────────────────────────────────────────────────

function makePool(queryImpl: (sql: string, params?: unknown[]) => unknown) {
  return { query: vi.fn(queryImpl) } as unknown as Pool;
}

// Web platform Request (no next/server) — matches the framework-agnostic guard.
function reqWithCookie(token?: string): Request {
  const headers = new Headers();
  if (token) headers.set("cookie", `orycms_session=${token}`);
  return new Request("http://localhost/api/orycms/users", { headers });
}

/** A pool that authenticates the session then returns the given permission rows. */
function poolFor(roleName: string | null, perms: Array<{ resource: string; action: string }>) {
  return makePool((sql: string) => {
    if (sql.includes("FROM orycms_sessions")) {
      return { rows: [{ userId: "u1", email: "a@b.co", roleName }] };
    }
    if (sql.includes("FROM orycms_permissions")) {
      return { rows: perms };
    }
    return { rows: [] };
  });
}

// ── guardOryCMS ────────────────────────────────────────────────────────────────

describe("guardOryCMS", () => {
  it("returns the session when authenticated and permitted", async () => {
    clearOryCMSPermissionCache();
    const pool = poolFor("Admin", [{ resource: "users", action: "read" }]);
    const session = await guardOryCMS(reqWithCookie("tok"), "users", "read", pool);
    expect(session.userId).toBe("u1");
    expect(session.roleName).toBe("Admin");
  });

  it("throws UNAUTHORIZED when no session cookie is present", async () => {
    const pool = poolFor("Admin", []);
    await expect(guardOryCMS(reqWithCookie(), "users", "read", pool)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      statusCode: 401,
    });
  });

  it("throws FORBIDDEN when the role lacks the permission", async () => {
    clearOryCMSPermissionCache();
    const pool = poolFor("Viewer", [{ resource: "content", action: "read" }]);
    await expect(guardOryCMS(reqWithCookie("tok"), "users", "delete", pool)).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
  });

  it("honors manage → implies any action on the resource", async () => {
    clearOryCMSPermissionCache();
    const pool = poolFor("Owner", [{ resource: "users", action: "manage" }]);
    const session = await guardOryCMS(reqWithCookie("tok"), "users", "delete", pool);
    expect(session.roleName).toBe("Owner");
  });
});

// ── toErrorResponse ────────────────────────────────────────────────────────────

describe("toErrorResponse", () => {
  it("maps an OryCMSAuthError to its statusCode", async () => {
    const res = toErrorResponse(new OryCMSAuthError("FORBIDDEN", "nope", 403));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: { code: "FORBIDDEN", message: "nope" } });
  });

  it("preserves an `issues` array when present", async () => {
    const err = Object.assign(new Error("bad schema"), {
      code: "VALIDATION",
      statusCode: 422,
      issues: [{ path: "name" }],
    });
    const res = toErrorResponse(err);
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { issues: unknown } };
    expect(body.error.issues).toEqual([{ path: "name" }]);
  });

  it("defaults status-less coded errors (plugin/manifest) to 400", async () => {
    const err = Object.assign(new Error("bad plugin"), { code: "INVALID_PLUGIN" });
    const res = toErrorResponse(err);
    expect(res.status).toBe(400);
  });

  it("maps *_NOT_FOUND status-less errors to 404", async () => {
    const err = Object.assign(new Error("missing"), { code: "PLUGIN_NOT_FOUND" });
    const res = toErrorResponse(err);
    expect(res.status).toBe(404);
  });

  it("falls back to 500 INTERNAL_ERROR for unknown throwables", async () => {
    const res = toErrorResponse(new Error("boom"));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toBe("Request failed.");
  });
});

// ── envelopes ──────────────────────────────────────────────────────────────────

describe("oryJson helpers", () => {
  it("oryJsonOk wraps data with success:true", async () => {
    const res = oryJsonOk({ x: 1 }, 201);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, data: { x: 1 } });
  });

  it("oryJsonError wraps code/message with success:false", async () => {
    const res = oryJsonError("NOPE", "no", 418);
    expect(res.status).toBe(418);
    expect(await res.json()).toEqual({ success: false, error: { code: "NOPE", message: "no" } });
  });
});
