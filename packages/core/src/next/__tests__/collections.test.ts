import { describe, it, expect, vi, beforeEach } from "vitest";

// Mirrors the mocking pattern in dispatcher.test.ts / the root route test:
// mock the module boundaries the handler calls, preserve the real error class shape.
// collectionRoutes isn't wired into ORYCMS_ROUTES yet (see dispatcher.test.ts's
// "does not ship advanced module routes" test), so this exercises the handler
// directly rather than through the dispatcher.

const protectOryCMSAdminRoute = vi.fn();
const requireOryCMSPermission = vi.fn();
const loadOryCMSPersistedCollectionsOnStartup = vi.fn();
const listOryCMSCollections = vi.fn();

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
  getOryCMSCollection: vi.fn(),
  getOryCMSPersistedCollection: vi.fn(),
  saveOryCMSCollectionSchema: vi.fn(),
  updateOryCMSPersistedCollection: vi.fn(),
  deleteOryCMSPersistedCollection: vi.fn(),
}));

// Import AFTER mocks are registered.
const { collectionRoutes } = await import("../routes/collections");

const listCollectionsRoute = collectionRoutes.find(
  (r) => r.method === "GET" && r.pattern === "collections",
);
if (!listCollectionsRoute) throw new Error("GET collections route not found in collectionRoutes");

function ctx(request: Request) {
  return { request, params: {}, url: new URL(request.url) };
}

function req(): Request {
  return new Request("http://localhost/api/orycms/collections");
}

beforeEach(() => {
  protectOryCMSAdminRoute.mockReset();
  requireOryCMSPermission.mockReset();
  loadOryCMSPersistedCollectionsOnStartup.mockReset();
  listOryCMSCollections.mockReset();
});

describe("GET collections route (packages/core)", () => {
  it("returns 401 when there is no session (unauthenticated)", async () => {
    protectOryCMSAdminRoute.mockRejectedValue(
      new OryCMSAuthError("UNAUTHORIZED", "Authentication required.", 401),
    );

    const res = await listCollectionsRoute.handler(ctx(req()));

    expect(res.status).toBe(401);
    const body = (await res.json()) as { success: boolean; error: { code: string } };
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

    const res = await listCollectionsRoute.handler(ctx(req()));

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
    expect(listOryCMSCollections).not.toHaveBeenCalled();
  });

  it("returns the collection list once authenticated and authorized", async () => {
    protectOryCMSAdminRoute.mockResolvedValue({ userId: "u1", roleId: "r1" });
    requireOryCMSPermission.mockResolvedValue(undefined);
    loadOryCMSPersistedCollectionsOnStartup.mockResolvedValue(undefined);
    listOryCMSCollections.mockReturnValue([{ slug: "posts" }]);

    const res = await listCollectionsRoute.handler(ctx(req()));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown };
    expect(body).toEqual({ success: true, data: [{ slug: "posts" }] });
    expect(requireOryCMSPermission).toHaveBeenCalledWith(
      { userId: "u1", roleId: "r1" },
      "collections",
      "read",
    );
  });
});
