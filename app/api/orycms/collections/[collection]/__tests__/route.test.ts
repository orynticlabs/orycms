import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mirrors the mocking pattern in app/api/orycms/collections/__tests__/route.test.ts:
// mock the module boundaries the route calls, preserve the real error class shape.

const protectOryCMSAdminRoute = vi.fn();
const requireOryCMSPermission = vi.fn();
const loadOryCMSPersistedCollectionsOnStartup = vi.fn();
const getOryCMSCollection = vi.fn();
const updateOryCMSPersistedCollection = vi.fn();
const deleteOryCMSPersistedCollection = vi.fn();

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
  getOryCMSCollection: (...args: unknown[]) => getOryCMSCollection(...args),
  updateOryCMSPersistedCollection: (...args: unknown[]) => updateOryCMSPersistedCollection(...args),
  deleteOryCMSPersistedCollection: (...args: unknown[]) => deleteOryCMSPersistedCollection(...args),
  OryCMSCollectionPersistenceError: class OryCMSCollectionPersistenceError extends Error {},
}));

// Import AFTER mocks are registered.
const { GET } = await import("../route");

function req(): NextRequest {
  return new NextRequest("http://localhost/api/orycms/collections/posts");
}

function ctx(collection = "posts") {
  return { params: Promise.resolve({ collection }) };
}

beforeEach(() => {
  protectOryCMSAdminRoute.mockReset();
  requireOryCMSPermission.mockReset();
  loadOryCMSPersistedCollectionsOnStartup.mockReset();
  getOryCMSCollection.mockReset();
  loadOryCMSPersistedCollectionsOnStartup.mockResolvedValue(undefined);
});

describe("GET /api/orycms/collections/:collection", () => {
  it("returns 401 when there is no session — closes a prior gap where this route had no auth check at all", async () => {
    protectOryCMSAdminRoute.mockRejectedValue(
      new OryCMSAuthError("UNAUTHORIZED", "Authentication required.", 401),
    );

    const res = await GET(req(), ctx());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(getOryCMSCollection).not.toHaveBeenCalled();
  });

  it("returns 403 when the session lacks the collections:read permission", async () => {
    protectOryCMSAdminRoute.mockResolvedValue({ userId: "u1", roleId: "r1" });
    requireOryCMSPermission.mockRejectedValue(
      new OryCMSAuthError("FORBIDDEN", "You do not have permission to do this.", 403),
    );

    const res = await GET(req(), ctx());

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
    expect(getOryCMSCollection).not.toHaveBeenCalled();
  });

  it("returns 404 when the collection does not exist", async () => {
    protectOryCMSAdminRoute.mockResolvedValue({ userId: "u1", roleId: "r1" });
    requireOryCMSPermission.mockResolvedValue(undefined);
    getOryCMSCollection.mockReturnValue(null);

    const res = await GET(req(), ctx("missing"));

    expect(res.status).toBe(404);
  });

  it("returns 200 with the schema once authenticated and authorized", async () => {
    protectOryCMSAdminRoute.mockResolvedValue({ userId: "u1", roleId: "r1" });
    requireOryCMSPermission.mockResolvedValue(undefined);
    const schema = { slug: "posts", name: "Posts", fields: [] };
    getOryCMSCollection.mockReturnValue(schema);

    const res = await GET(req(), ctx());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, data: schema });
    expect(requireOryCMSPermission).toHaveBeenCalledWith(
      { userId: "u1", roleId: "r1" },
      "collections",
      "read",
    );
  });
});
