import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const protectOryCMSAdminRoute = vi.fn();
const requireOryCMSPermission = vi.fn();
const getOryCMSContentEntry = vi.fn();
const updateOryCMSContentEntry = vi.fn();
const deleteOryCMSContentEntry = vi.fn();

class OryCMSAuthError extends Error {
  code: string;
  statusCode: number;
  constructor(code: string, message: string, statusCode = 401) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

class OryCMSContentError extends Error {
  code: string;
  statusCode: number;
  field?: string;
  constructor(code: string, message: string, statusCode = 400, field?: string) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.field = field;
  }
}

vi.mock("@/auth", () => ({
  protectOryCMSAdminRoute: (...args: unknown[]) => protectOryCMSAdminRoute(...args),
  OryCMSAuthError,
}));

vi.mock("@/rbac", () => ({
  requireOryCMSPermission: (...args: unknown[]) => requireOryCMSPermission(...args),
}));

vi.mock("@/content", () => ({
  getOryCMSContentEntry: (...args: unknown[]) => getOryCMSContentEntry(...args),
  updateOryCMSContentEntry: (...args: unknown[]) => updateOryCMSContentEntry(...args),
  deleteOryCMSContentEntry: (...args: unknown[]) => deleteOryCMSContentEntry(...args),
  OryCMSContentError,
}));

// Import AFTER mocks are registered.
const { GET, PATCH, DELETE } = await import("../route");

const SESSION = { userId: "u1", roleId: "r1" };
const PUBLISHED_ENTRY = { id: "e1", status: "published", data: { title: "Hi" } };
const DRAFT_ENTRY = { id: "e2", status: "draft", data: { title: "Hi" } };

function ctx(id = "e1", collection = "posts") {
  return { params: Promise.resolve({ collection, id }) };
}

function getReq(id = "e1"): NextRequest {
  return new NextRequest(`http://localhost/api/orycms/collections/posts/content/${id}`);
}

function writeReq(method: string, id = "e1", body?: unknown): NextRequest {
  const init: { method: string; headers?: Record<string, string>; body?: string } = { method };
  if (body !== undefined) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return new NextRequest(`http://localhost/api/orycms/collections/posts/content/${id}`, init);
}

beforeEach(() => {
  protectOryCMSAdminRoute.mockReset();
  requireOryCMSPermission.mockReset();
  getOryCMSContentEntry.mockReset();
  updateOryCMSContentEntry.mockReset();
  deleteOryCMSContentEntry.mockReset();
  protectOryCMSAdminRoute.mockResolvedValue(SESSION);
  requireOryCMSPermission.mockResolvedValue(undefined);
});

describe("GET /api/orycms/collections/:collection/content/:id", () => {
  it("returns a published entry to an anonymous caller", async () => {
    protectOryCMSAdminRoute.mockRejectedValue(
      new OryCMSAuthError("UNAUTHORIZED", "Authentication required.", 401),
    );
    getOryCMSContentEntry.mockResolvedValue(PUBLISHED_ENTRY);

    const res = await GET(getReq("e1"), ctx("e1"));

    expect(res.status).toBe(200);
  });

  it("returns 404, not the draft, to an anonymous caller", async () => {
    protectOryCMSAdminRoute.mockRejectedValue(
      new OryCMSAuthError("UNAUTHORIZED", "Authentication required.", 401),
    );
    getOryCMSContentEntry.mockResolvedValue(DRAFT_ENTRY);

    const res = await GET(getReq("e2"), ctx("e2"));

    expect(res.status).toBe(404);
    const body = (await res.json()) as { data?: unknown };
    expect(body.data).toBeUndefined();
  });

  it("returns 404, not the draft, to a session that lacks content:read", async () => {
    requireOryCMSPermission.mockRejectedValue(
      new OryCMSAuthError("FORBIDDEN", "You do not have permission to do this.", 403),
    );
    getOryCMSContentEntry.mockResolvedValue(DRAFT_ENTRY);

    const res = await GET(getReq("e2"), ctx("e2"));

    expect(res.status).toBe(404);
  });

  it("returns the draft to a session with content:read", async () => {
    getOryCMSContentEntry.mockResolvedValue(DRAFT_ENTRY);

    const res = await GET(getReq("e2"), ctx("e2"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown };
    expect(body.data).toEqual(DRAFT_ENTRY);
  });
});

describe("PATCH /api/orycms/collections/:collection/content/:id", () => {
  it("returns 401 when there is no session", async () => {
    protectOryCMSAdminRoute.mockRejectedValue(
      new OryCMSAuthError("UNAUTHORIZED", "Authentication required.", 401),
    );

    const res = await PATCH(writeReq("PATCH", "e1", { data: { title: "Hi" } }), ctx("e1"));

    expect(res.status).toBe(401);
    expect(updateOryCMSContentEntry).not.toHaveBeenCalled();
  });

  it("returns 403 when the session lacks content:update", async () => {
    requireOryCMSPermission.mockRejectedValue(
      new OryCMSAuthError("FORBIDDEN", "You do not have permission to do this.", 403),
    );

    const res = await PATCH(writeReq("PATCH", "e1", { data: { title: "Hi" } }), ctx("e1"));

    expect(res.status).toBe(403);
    expect(requireOryCMSPermission).toHaveBeenCalledWith(SESSION, "content", "update");
    expect(updateOryCMSContentEntry).not.toHaveBeenCalled();
  });

  it("returns 200 on success", async () => {
    updateOryCMSContentEntry.mockResolvedValue(PUBLISHED_ENTRY);

    const res = await PATCH(writeReq("PATCH", "e1", { data: { title: "Hi" } }), ctx("e1"));

    expect(res.status).toBe(200);
  });

  it("maps a client-supplied system column to a clean 422", async () => {
    updateOryCMSContentEntry.mockRejectedValue(
      new OryCMSContentError(
        "FIELD_FORBIDDEN",
        '"_isDraft" is managed by the system and cannot be set directly.',
        422,
        "_isDraft",
      ),
    );

    const res = await PATCH(writeReq("PATCH", "e1", { data: { _isDraft: false } }), ctx("e1"));

    expect(res.status).toBe(422);
  });
});

describe("DELETE /api/orycms/collections/:collection/content/:id", () => {
  it("returns 401 when there is no session", async () => {
    protectOryCMSAdminRoute.mockRejectedValue(
      new OryCMSAuthError("UNAUTHORIZED", "Authentication required.", 401),
    );

    const res = await DELETE(writeReq("DELETE", "e1"), ctx("e1"));

    expect(res.status).toBe(401);
    expect(deleteOryCMSContentEntry).not.toHaveBeenCalled();
  });

  it("returns 403 when the session lacks content:delete", async () => {
    requireOryCMSPermission.mockRejectedValue(
      new OryCMSAuthError("FORBIDDEN", "You do not have permission to do this.", 403),
    );

    const res = await DELETE(writeReq("DELETE", "e1"), ctx("e1"));

    expect(res.status).toBe(403);
    expect(requireOryCMSPermission).toHaveBeenCalledWith(SESSION, "content", "delete");
    expect(deleteOryCMSContentEntry).not.toHaveBeenCalled();
  });

  it("returns 200 with a null payload on success", async () => {
    deleteOryCMSContentEntry.mockResolvedValue(undefined);

    const res = await DELETE(writeReq("DELETE", "e1"), ctx("e1"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown };
    expect(body.data).toBeNull();
  });
});
