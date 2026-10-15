import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mirrors the mocking pattern in app/api/orycms/collections/__tests__/route.test.ts:
// mock the module boundaries the route calls, preserve the real error class shape.

const protectOryCMSAdminRoute = vi.fn();
const requireOryCMSPermission = vi.fn();
const listOryCMSContentEntries = vi.fn();
const createOryCMSContentEntry = vi.fn();

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
  listOryCMSContentEntries: (...args: unknown[]) => listOryCMSContentEntries(...args),
  createOryCMSContentEntry: (...args: unknown[]) => createOryCMSContentEntry(...args),
  OryCMSContentError,
}));

// Import AFTER mocks are registered.
const { GET, POST } = await import("../route");

const SESSION = { userId: "u1", roleId: "r1" };

function ctx(collection = "posts") {
  return { params: Promise.resolve({ collection }) };
}

function listReq(query = ""): NextRequest {
  return new NextRequest(`http://localhost/api/orycms/collections/posts/content${query}`);
}

function postReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/orycms/collections/posts/content", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  protectOryCMSAdminRoute.mockReset();
  requireOryCMSPermission.mockReset();
  listOryCMSContentEntries.mockReset();
  createOryCMSContentEntry.mockReset();
  protectOryCMSAdminRoute.mockResolvedValue(SESSION);
  requireOryCMSPermission.mockResolvedValue(undefined);
});

describe("GET /api/orycms/collections/:collection/content", () => {
  it("is reachable without a session — public reads are intentional", async () => {
    protectOryCMSAdminRoute.mockRejectedValue(
      new OryCMSAuthError("UNAUTHORIZED", "Authentication required.", 401),
    );
    listOryCMSContentEntries.mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 50, hasMore: false },
    });

    const res = await GET(listReq(), ctx());

    expect(res.status).toBe(200);
  });

  it("ignores ?drafts=true for an anonymous caller", async () => {
    protectOryCMSAdminRoute.mockRejectedValue(
      new OryCMSAuthError("UNAUTHORIZED", "Authentication required.", 401),
    );
    listOryCMSContentEntries.mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 50, hasMore: false },
    });

    await GET(listReq("?drafts=true"), ctx());

    expect(listOryCMSContentEntries).toHaveBeenCalledWith(
      "posts",
      expect.objectContaining({ includeDrafts: false }),
    );
  });

  it("ignores ?drafts=true for a session that lacks content:read", async () => {
    requireOryCMSPermission.mockRejectedValue(
      new OryCMSAuthError("FORBIDDEN", "You do not have permission to do this.", 403),
    );
    listOryCMSContentEntries.mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 50, hasMore: false },
    });

    await GET(listReq("?drafts=true"), ctx());

    expect(listOryCMSContentEntries).toHaveBeenCalledWith(
      "posts",
      expect.objectContaining({ includeDrafts: false }),
    );
  });

  it("honours ?drafts=true for a session with content:read", async () => {
    listOryCMSContentEntries.mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 50, hasMore: false },
    });

    await GET(listReq("?drafts=true"), ctx());

    expect(requireOryCMSPermission).toHaveBeenCalledWith(SESSION, "content", "read");
    expect(listOryCMSContentEntries).toHaveBeenCalledWith(
      "posts",
      expect.objectContaining({ includeDrafts: true }),
    );
  });
});

describe("POST /api/orycms/collections/:collection/content", () => {
  it("returns 401 when there is no session", async () => {
    protectOryCMSAdminRoute.mockRejectedValue(
      new OryCMSAuthError("UNAUTHORIZED", "Authentication required.", 401),
    );

    const res = await POST(postReq({ data: { title: "Hi" } }), ctx());

    expect(res.status).toBe(401);
    expect(createOryCMSContentEntry).not.toHaveBeenCalled();
  });

  it("returns 403 when the session lacks content:create", async () => {
    requireOryCMSPermission.mockRejectedValue(
      new OryCMSAuthError("FORBIDDEN", "You do not have permission to do this.", 403),
    );

    const res = await POST(postReq({ data: { title: "Hi" } }), ctx());

    expect(res.status).toBe(403);
    expect(requireOryCMSPermission).toHaveBeenCalledWith(SESSION, "content", "create");
    expect(createOryCMSContentEntry).not.toHaveBeenCalled();
  });

  it("returns 201 on success", async () => {
    createOryCMSContentEntry.mockResolvedValue({ id: "e1", data: { title: "Hi" } });

    const res = await POST(postReq({ data: { title: "Hi" } }), ctx());

    expect(res.status).toBe(201);
  });

  it("maps a client-supplied system column to a clean 422", async () => {
    createOryCMSContentEntry.mockRejectedValue(
      new OryCMSContentError(
        "FIELD_FORBIDDEN",
        '"id" is managed by the system and cannot be set directly.',
        422,
        "id",
      ),
    );

    const res = await POST(postReq({ data: { id: "attacker-chosen", title: "Hi" } }), ctx());

    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FIELD_FORBIDDEN");
  });

  it("maps a unique-constraint violation to a clean 409", async () => {
    createOryCMSContentEntry.mockRejectedValue(
      new OryCMSContentError(
        "DUPLICATE_VALUE",
        "A value in this entry conflicts with an existing one.",
        409,
      ),
    );

    const res = await POST(postReq({ data: { title: "Hi" } }), ctx());

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("DUPLICATE_VALUE");
    expect(JSON.stringify(body)).not.toMatch(/constraint|postgresql:\/\//i);
  });
});
