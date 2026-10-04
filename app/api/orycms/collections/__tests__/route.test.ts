import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mirrors the mocking pattern in app/api/orycms/auth/setup/__tests__/route.test.ts:
// mock the module boundaries the route calls, preserve the real error class shape.

const protectOryCMSAdminRoute = vi.fn();
const requireOryCMSPermission = vi.fn();
const loadOryCMSPersistedCollectionsOnStartup = vi.fn();
const listOryCMSCollections = vi.fn();
const saveOryCMSCollectionSchema = vi.fn();

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
}));

vi.mock("@/schema", () => ({
  loadOryCMSPersistedCollectionsOnStartup: (...args: unknown[]) =>
    loadOryCMSPersistedCollectionsOnStartup(...args),
  listOryCMSCollections: (...args: unknown[]) => listOryCMSCollections(...args),
  saveOryCMSCollectionSchema: (...args: unknown[]) => saveOryCMSCollectionSchema(...args),
  OryCMSCollectionPersistenceError: class OryCMSCollectionPersistenceError extends Error {},
}));

// Import AFTER mocks are registered.
const { GET } = await import("../route");

function req(): NextRequest {
  return new NextRequest("http://localhost/api/orycms/collections");
}

beforeEach(() => {
  protectOryCMSAdminRoute.mockReset();
  requireOryCMSPermission.mockReset();
  loadOryCMSPersistedCollectionsOnStartup.mockReset();
  listOryCMSCollections.mockReset();
});

describe("GET /api/orycms/collections", () => {
  it("returns 401 when there is no session (unauthenticated)", async () => {
    protectOryCMSAdminRoute.mockRejectedValue(
      new OryCMSAuthError("UNAUTHORIZED", "Authentication required.", 401),
    );

    const res = await GET(req());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(requireOryCMSPermission).not.toHaveBeenCalled();
    expect(listOryCMSCollections).not.toHaveBeenCalled();
  });

  it("returns 403 when the session lacks the collections:read permission", async () => {
    protectOryCMSAdminRoute.mockResolvedValue({ userId: "u1", roleId: "r1" });
    requireOryCMSPermission.mockRejectedValue(
      new OryCMSAuthError("FORBIDDEN", "You do not have permission to do this.", 403),
    );

    const res = await GET(req());

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
    expect(listOryCMSCollections).not.toHaveBeenCalled();
  });

  it("returns the collection list once authenticated and authorized", async () => {
    protectOryCMSAdminRoute.mockResolvedValue({ userId: "u1", roleId: "r1" });
    requireOryCMSPermission.mockResolvedValue(undefined);
    loadOryCMSPersistedCollectionsOnStartup.mockResolvedValue(undefined);
    listOryCMSCollections.mockReturnValue([{ slug: "posts" }]);

    const res = await GET(req());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, data: [{ slug: "posts" }] });
    expect(requireOryCMSPermission).toHaveBeenCalledWith(
      { userId: "u1", roleId: "r1" },
      "collections",
      "read",
    );
  });
});
