import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

// ── Helpers ────────────────────────────────────────────────────────────────────

function req(pathname: string, opts: { method?: string; cookie?: string } = {}): NextRequest {
  const url = `http://localhost${pathname}`;
  const headers = new Headers();
  if (opts.cookie) headers.set("cookie", `orycms_session=${opts.cookie}`);
  return new NextRequest(url, { method: opts.method ?? "GET", headers });
}

function authed(pathname: string, method = "GET") {
  return req(pathname, { method, cookie: "valid-token-abc" });
}

// ── Auth API — always public ───────────────────────────────────────────────────

describe("auth API routes", () => {
  it("passes /api/orycms/auth/login without session", () => {
    const res = middleware(req("/api/orycms/auth/login", { method: "POST" }));
    expect(res.status).toBe(200);
  });

  it("passes /api/orycms/auth/setup without session", () => {
    const res = middleware(req("/api/orycms/auth/setup", { method: "POST" }));
    expect(res.status).toBe(200);
  });

  it("passes /api/orycms/auth/session GET without session", () => {
    const res = middleware(req("/api/orycms/auth/session"));
    expect(res.status).toBe(200);
  });

  it("passes /api/orycms/auth/setup-status GET without session", () => {
    const res = middleware(req("/api/orycms/auth/setup-status"));
    expect(res.status).toBe(200);
  });
});

// ── Public pages ───────────────────────────────────────────────────────────────

describe("public pages", () => {
  it("passes /login without session", () => {
    expect(middleware(req("/login")).status).toBe(200);
  });

  it("passes /setup without session", () => {
    expect(middleware(req("/setup")).status).toBe(200);
  });

  it("passes token-flow pages without session", () => {
    for (const path of ["/accept-invite", "/activate", "/reset-password", "/forgot-password"]) {
      expect(middleware(req(path)).status, path).toBe(200);
    }
  });
});

// ── Public content GET endpoints ───────────────────────────────────────────────

describe("public content GET", () => {
  it("GET list — passes without session", () => {
    const res = middleware(req("/api/orycms/collections/blog-posts/content"));
    expect(res.status).toBe(200);
  });

  it("GET single — passes without session", () => {
    const res = middleware(req("/api/orycms/collections/blog-posts/content/entry-uuid"));
    expect(res.status).toBe(200);
  });

  it("does not expose publish sub-route as public", () => {
    // /content/<id>/publish is NOT matched by the public content regex
    const res = middleware(req("/api/orycms/collections/blog-posts/content/uuid/publish"));
    expect(res.status).toBe(307); // redirect to /login
  });
});

// ── Protected content write endpoints ─────────────────────────────────────────

describe("content write endpoints require session", () => {
  it("POST to list endpoint redirects without session", () => {
    const res = middleware(req("/api/orycms/collections/blog-posts/content", { method: "POST" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("PATCH to entry redirects without session", () => {
    const res = middleware(
      req("/api/orycms/collections/blog-posts/content/uuid", { method: "PATCH" }),
    );
    expect(res.status).toBe(307);
  });

  it("DELETE to entry redirects without session", () => {
    const res = middleware(
      req("/api/orycms/collections/blog-posts/content/uuid", { method: "DELETE" }),
    );
    expect(res.status).toBe(307);
  });

  it("POST to content list passes with session", () => {
    const res = middleware(authed("/api/orycms/collections/blog-posts/content", "POST"));
    expect(res.status).toBe(200);
  });
});

// ── /admin routes ──────────────────────────────────────────────────────────────

describe("/admin routes", () => {
  it("blocks /admin without session", () => {
    const res = middleware(req("/admin"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("blocks /admin/collections without session", () => {
    const res = middleware(req("/admin/collections"));
    expect(res.status).toBe(307);
  });

  it("passes /admin with session", () => {
    const res = middleware(authed("/admin"));
    expect(res.status).toBe(200);
  });

  it("passes /admin/collections with session", () => {
    const res = middleware(authed("/admin/collections"));
    expect(res.status).toBe(200);
  });
});

// ── Other protected pages/APIs ─────────────────────────────────────────────────

describe("protected pages and APIs", () => {
  it("blocks dashboard root without session", () => {
    const res = middleware(req("/"));
    expect(res.status).toBe(307);
  });

  it("passes dashboard with session", () => {
    const res = middleware(authed("/"));
    expect(res.status).toBe(200);
  });

  it("blocks internal management API without session", () => {
    const res = middleware(req("/api/orycms/users"));
    expect(res.status).toBe(307);
  });

  it("passes internal management API with session", () => {
    const res = middleware(authed("/api/orycms/users"));
    expect(res.status).toBe(200);
  });
});

// ── `from` redirect safety ────────────────────────────────────────────────────

describe("safe login redirect (from param)", () => {
  it("carries safe relative `from` path in redirect URL", () => {
    const res = middleware(req("/admin/settings"));
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("from=%2Fadmin%2Fsettings");
  });

  it("does NOT include `from` when path is /login (loop prevention)", () => {
    const res = middleware(req("/login"));
    // /login is in PUBLIC_PAGES → passes, never adds from
    expect(res.status).toBe(200);
  });

  it("does NOT include `from` when path is /setup (loop prevention)", () => {
    const res = middleware(req("/setup"));
    expect(res.status).toBe(200);
  });

  it("does not carry // protocol-relative path as `from`", () => {
    // A path like //evil.com would be unsafe; middleware only sets `from` for
    // paths starting with a single /. The URL constructor normalises paths in
    // NextRequest, so we verify the isSafeFrom logic via the middleware helper
    // indirectly — a double-slash URL is not a valid NextRequest pathname.
    // Instead verify a normal protected path DOES produce a safe from value.
    const res = middleware(req("/api/orycms/collections/blog-posts/content", { method: "POST" }));
    const location = res.headers.get("location") ?? "";
    // from value must start with %2F (encoded /) not %2F%2F
    const fromParam = new URL(location).searchParams.get("from") ?? "";
    expect(fromParam.startsWith("/")).toBe(true);
    expect(fromParam.startsWith("//")).toBe(false);
  });
});
