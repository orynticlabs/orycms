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
const getOryCMSCollection = vi.fn();
const getOryCMSPersistedCollection = vi.fn();
const saveOryCMSCollectionSchema = vi.fn();
const updateOryCMSPersistedCollection = vi.fn();
const deleteOryCMSPersistedCollection = vi.fn();
const listOryCMSContentEntries = vi.fn();
const createOryCMSContentEntry = vi.fn();
const getOryCMSContentEntry = vi.fn();
const updateOryCMSContentEntry = vi.fn();
const deleteOryCMSContentEntry = vi.fn();
const publishOryCMSContentEntry = vi.fn();
const unpublishOryCMSContentEntry = vi.fn();
const recordOryCMSAuditLog = vi.fn();

const { OryCMSAuthError, OryCMSCollectionPersistenceError, OryCMSContentError } = vi.hoisted(() => {
  class OryCMSAuthError extends Error {
    code: string;
    statusCode: number;
    constructor(code: string, message: string, statusCode = 401) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
    }
  }
  class OryCMSCollectionPersistenceError extends Error {
    code: string;
    statusCode: number;
    issues?: unknown[];
    constructor(code: string, message: string, statusCode = 500, issues?: unknown[]) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
      this.issues = issues;
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
  return { OryCMSAuthError, OryCMSCollectionPersistenceError, OryCMSContentError };
});

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
  getOryCMSCollection: (...args: unknown[]) => getOryCMSCollection(...args),
  getOryCMSPersistedCollection: (...args: unknown[]) => getOryCMSPersistedCollection(...args),
  saveOryCMSCollectionSchema: (...args: unknown[]) => saveOryCMSCollectionSchema(...args),
  updateOryCMSPersistedCollection: (...args: unknown[]) => updateOryCMSPersistedCollection(...args),
  deleteOryCMSPersistedCollection: (...args: unknown[]) => deleteOryCMSPersistedCollection(...args),
  OryCMSCollectionPersistenceError,
}));

vi.mock("@/content", () => ({
  listOryCMSContentEntries: (...args: unknown[]) => listOryCMSContentEntries(...args),
  createOryCMSContentEntry: (...args: unknown[]) => createOryCMSContentEntry(...args),
  getOryCMSContentEntry: (...args: unknown[]) => getOryCMSContentEntry(...args),
  updateOryCMSContentEntry: (...args: unknown[]) => updateOryCMSContentEntry(...args),
  deleteOryCMSContentEntry: (...args: unknown[]) => deleteOryCMSContentEntry(...args),
  publishOryCMSContentEntry: (...args: unknown[]) => publishOryCMSContentEntry(...args),
  unpublishOryCMSContentEntry: (...args: unknown[]) => unpublishOryCMSContentEntry(...args),
  OryCMSContentError,
}));

vi.mock("@/audit", () => ({
  recordOryCMSAuditLog: (...args: unknown[]) => recordOryCMSAuditLog(...args),
}));

// Import AFTER mocks are registered.
const { collectionRoutes } = await import("../routes/collections");
const { safeRouteError } = await import("../route-errors");

function findRoute(method: string, pattern: string) {
  const route = collectionRoutes.find((r) => r.method === method && r.pattern === pattern);
  if (!route) throw new Error(`${method} ${pattern} not found in collectionRoutes`);
  return route;
}

const listCollectionsRoute = findRoute("GET", "collections");
const createCollectionRoute = findRoute("POST", "collections");
const getCollectionRoute = findRoute("GET", "collections/:collection");
const updateCollectionRoute = findRoute("PATCH", "collections/:collection");
const deleteCollectionRoute = findRoute("DELETE", "collections/:collection");
const listContentRoute = findRoute("GET", "collections/:collection/content");
const createContentRoute = findRoute("POST", "collections/:collection/content");
const getContentRoute = findRoute("GET", "collections/:collection/content/:id");
const updateContentRoute = findRoute("PATCH", "collections/:collection/content/:id");
const deleteContentRoute = findRoute("DELETE", "collections/:collection/content/:id");
const publishContentRoute = findRoute("POST", "collections/:collection/content/:id/publish");
const unpublishContentRoute = findRoute("DELETE", "collections/:collection/content/:id/publish");

const SESSION = { userId: "u1", roleId: "r1" };

function ctx(request: Request, params: Record<string, string> = {}) {
  return { request, params, url: new URL(request.url) };
}

function req(opts: { method?: string; body?: unknown; path?: string } = {}): Request {
  const init: RequestInit = { method: opts.method ?? "GET" };
  if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
    init.headers = { "content-type": "application/json" };
  }
  return new Request(`http://localhost${opts.path ?? "/api/orycms/collections"}`, init);
}

/** Calls a route the way the dispatcher does: a thrown error becomes a response. */
async function call(
  route: ReturnType<typeof findRoute>,
  request: Request,
  params: Record<string, string> = {},
): Promise<Response> {
  try {
    return await route.handler(ctx(request, params));
  } catch (err) {
    return safeRouteError(route.pattern, err);
  }
}

beforeEach(() => {
  protectOryCMSAdminRoute.mockReset();
  requireOryCMSPermission.mockReset();
  loadOryCMSPersistedCollectionsOnStartup.mockReset();
  listOryCMSCollections.mockReset();
  getOryCMSCollection.mockReset();
  getOryCMSPersistedCollection.mockReset();
  saveOryCMSCollectionSchema.mockReset();
  updateOryCMSPersistedCollection.mockReset();
  deleteOryCMSPersistedCollection.mockReset();
  listOryCMSContentEntries.mockReset();
  createOryCMSContentEntry.mockReset();
  getOryCMSContentEntry.mockReset();
  updateOryCMSContentEntry.mockReset();
  deleteOryCMSContentEntry.mockReset();
  publishOryCMSContentEntry.mockReset();
  unpublishOryCMSContentEntry.mockReset();
  recordOryCMSAuditLog.mockReset();
  recordOryCMSAuditLog.mockResolvedValue(undefined);
  loadOryCMSPersistedCollectionsOnStartup.mockResolvedValue(undefined);
  protectOryCMSAdminRoute.mockResolvedValue(SESSION);
  requireOryCMSPermission.mockResolvedValue(undefined);
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

const FORBIDDEN = new OryCMSAuthError("FORBIDDEN", "You do not have permission to do this.", 403);
const UNAUTHORIZED = new OryCMSAuthError("UNAUTHORIZED", "Authentication required.", 401);

describe("POST /collections (create)", () => {
  it("returns 401 when there is no session", async () => {
    protectOryCMSAdminRoute.mockRejectedValue(UNAUTHORIZED);

    const res = await call(createCollectionRoute, req({ method: "POST", body: { slug: "posts" } }));

    expect(res.status).toBe(401);
    expect(saveOryCMSCollectionSchema).not.toHaveBeenCalled();
  });

  it("returns 403 when the session lacks collections:create", async () => {
    requireOryCMSPermission.mockRejectedValue(FORBIDDEN);

    const res = await call(createCollectionRoute, req({ method: "POST", body: { slug: "posts" } }));

    expect(res.status).toBe(403);
    expect(requireOryCMSPermission).toHaveBeenCalledWith(SESSION, "collections", "create");
    expect(saveOryCMSCollectionSchema).not.toHaveBeenCalled();
  });

  it("returns a safe 400 response, with no persistence detail beyond code/message/issues, when the definition is invalid", async () => {
    saveOryCMSCollectionSchema.mockRejectedValue(
      new OryCMSCollectionPersistenceError(
        "SCHEMA_VALIDATION_ERROR",
        "Collection schema is invalid.",
        400,
        [{ code: "INVALID_TABLE_NAME_FORMAT", path: "tableName" }],
      ),
    );

    const res = await call(
      createCollectionRoute,
      req({
        method: "POST",
        body: { slug: "posts", tableName: 'foo"; DROP TABLE orycms_users; --' },
      }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: { code: string; message: string; issues?: unknown[] };
    };
    expect(body.error.code).toBe("SCHEMA_VALIDATION_ERROR");
    expect(body.error.issues).toEqual([{ code: "INVALID_TABLE_NAME_FORMAT", path: "tableName" }]);
    expect(JSON.stringify(body)).not.toMatch(/DROP TABLE|password|postgresql:\/\//i);
  });

  it("returns 201 with the saved collection on success", async () => {
    const saved = { slug: "posts", name: "Posts" };
    saveOryCMSCollectionSchema.mockResolvedValue(saved);

    const res = await call(createCollectionRoute, req({ method: "POST", body: { slug: "posts" } }));

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: unknown };
    expect(body.data).toEqual(saved);
  });
});

describe("GET /collections/:collection (get)", () => {
  it("returns 401 when there is no session — closes a prior gap where this route had no auth check at all", async () => {
    protectOryCMSAdminRoute.mockRejectedValue(UNAUTHORIZED);

    const res = await call(getCollectionRoute, req(), { collection: "posts" });

    expect(res.status).toBe(401);
    expect(getOryCMSCollection).not.toHaveBeenCalled();
  });

  it("returns 403 when the session lacks collections:read", async () => {
    requireOryCMSPermission.mockRejectedValue(FORBIDDEN);

    const res = await call(getCollectionRoute, req(), { collection: "posts" });

    expect(res.status).toBe(403);
    expect(requireOryCMSPermission).toHaveBeenCalledWith(SESSION, "collections", "read");
    expect(getOryCMSCollection).not.toHaveBeenCalled();
  });

  it("returns 404 when the collection does not exist", async () => {
    getOryCMSCollection.mockReturnValue(null);

    const res = await call(getCollectionRoute, req(), { collection: "missing" });

    expect(res.status).toBe(404);
  });

  it("returns 200 with the schema once authenticated and authorized", async () => {
    const schema = { slug: "posts", name: "Posts", fields: [] };
    getOryCMSCollection.mockReturnValue(schema);

    const res = await call(getCollectionRoute, req(), { collection: "posts" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown };
    expect(body.data).toEqual(schema);
  });
});

describe("PATCH /collections/:collection (update)", () => {
  it("returns 401 when there is no session", async () => {
    protectOryCMSAdminRoute.mockRejectedValue(UNAUTHORIZED);

    const res = await call(
      updateCollectionRoute,
      req({ method: "PATCH", body: { slug: "posts" } }),
      { collection: "posts" },
    );

    expect(res.status).toBe(401);
    expect(updateOryCMSPersistedCollection).not.toHaveBeenCalled();
  });

  it("returns 403 when the session lacks collections:update", async () => {
    requireOryCMSPermission.mockRejectedValue(FORBIDDEN);

    const res = await call(
      updateCollectionRoute,
      req({ method: "PATCH", body: { slug: "posts" } }),
      { collection: "posts" },
    );

    expect(res.status).toBe(403);
    expect(requireOryCMSPermission).toHaveBeenCalledWith(SESSION, "collections", "update");
    expect(updateOryCMSPersistedCollection).not.toHaveBeenCalled();
  });

  it("returns a safe 400 response with no persistence detail when the update is invalid", async () => {
    updateOryCMSPersistedCollection.mockRejectedValue(
      new OryCMSCollectionPersistenceError(
        "SCHEMA_VALIDATION_ERROR",
        "Collection schema is invalid.",
        400,
        [{ code: "RESERVED_TABLE_NAME", path: "tableName" }],
      ),
    );

    const res = await call(
      updateCollectionRoute,
      req({ method: "PATCH", body: { slug: "posts", tableName: "orycms_evil" } }),
      { collection: "posts" },
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; issues?: unknown[] } };
    expect(body.error.code).toBe("SCHEMA_VALIDATION_ERROR");
    expect(body.error.issues).toEqual([{ code: "RESERVED_TABLE_NAME", path: "tableName" }]);
  });

  it("returns 200 with the updated collection on success", async () => {
    const updated = { slug: "posts", name: "Renamed" };
    updateOryCMSPersistedCollection.mockResolvedValue(updated);

    const res = await call(
      updateCollectionRoute,
      req({ method: "PATCH", body: { slug: "posts", name: "Renamed" } }),
      { collection: "posts" },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown };
    expect(body.data).toEqual(updated);
  });
});

describe("DELETE /collections/:collection (delete)", () => {
  it("returns 401 when there is no session", async () => {
    protectOryCMSAdminRoute.mockRejectedValue(UNAUTHORIZED);

    const res = await call(deleteCollectionRoute, req({ method: "DELETE" }), {
      collection: "posts",
    });

    expect(res.status).toBe(401);
    expect(deleteOryCMSPersistedCollection).not.toHaveBeenCalled();
  });

  it("returns 403 when the session lacks collections:delete", async () => {
    requireOryCMSPermission.mockRejectedValue(FORBIDDEN);

    const res = await call(deleteCollectionRoute, req({ method: "DELETE" }), {
      collection: "posts",
    });

    expect(res.status).toBe(403);
    expect(requireOryCMSPermission).toHaveBeenCalledWith(SESSION, "collections", "delete");
    expect(deleteOryCMSPersistedCollection).not.toHaveBeenCalled();
  });

  it("returns 200 with a null payload on success", async () => {
    deleteOryCMSPersistedCollection.mockResolvedValue(undefined);

    const res = await call(deleteCollectionRoute, req({ method: "DELETE" }), {
      collection: "posts",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown };
    expect(body.data).toBeNull();
    expect(deleteOryCMSPersistedCollection).toHaveBeenCalledWith("posts");
  });
});

const PUBLISHED_ENTRY = {
  id: "e1",
  collectionSlug: "posts",
  status: "published",
  locale: "default",
  data: { title: "Hi" },
  timestamps: { createdAt: "now", updatedAt: "now" },
};
const DRAFT_ENTRY = { ...PUBLISHED_ENTRY, id: "e2", status: "draft" };

describe("GET /collections/:collection/content (list)", () => {
  it("is reachable without a session — public reads are intentional", async () => {
    protectOryCMSAdminRoute.mockRejectedValue(UNAUTHORIZED);
    listOryCMSContentEntries.mockResolvedValue({
      data: [PUBLISHED_ENTRY],
      meta: { total: 1, page: 1, limit: 50, hasMore: false },
    });

    const res = await call(
      listContentRoute,
      req({ path: "/api/orycms/collections/posts/content" }),
      {
        collection: "posts",
      },
    );

    expect(res.status).toBe(200);
  });

  it("ignores ?drafts=true for an anonymous caller — drafts never reach someone who can't read them", async () => {
    protectOryCMSAdminRoute.mockRejectedValue(UNAUTHORIZED);
    listOryCMSContentEntries.mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 50, hasMore: false },
    });

    await call(
      listContentRoute,
      req({ path: "/api/orycms/collections/posts/content?drafts=true" }),
      { collection: "posts" },
    );

    expect(listOryCMSContentEntries).toHaveBeenCalledWith(
      "posts",
      expect.objectContaining({ includeDrafts: false }),
    );
  });

  it("ignores ?drafts=true for a session that lacks content:read", async () => {
    requireOryCMSPermission.mockRejectedValue(FORBIDDEN);
    listOryCMSContentEntries.mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 50, hasMore: false },
    });

    await call(
      listContentRoute,
      req({ path: "/api/orycms/collections/posts/content?drafts=true" }),
      { collection: "posts" },
    );

    expect(listOryCMSContentEntries).toHaveBeenCalledWith(
      "posts",
      expect.objectContaining({ includeDrafts: false }),
    );
  });

  it("honours ?drafts=true for a session with content:read", async () => {
    listOryCMSContentEntries.mockResolvedValue({
      data: [DRAFT_ENTRY],
      meta: { total: 1, page: 1, limit: 50, hasMore: false },
    });

    await call(
      listContentRoute,
      req({ path: "/api/orycms/collections/posts/content?drafts=true" }),
      { collection: "posts" },
    );

    expect(requireOryCMSPermission).toHaveBeenCalledWith(SESSION, "content", "read");
    expect(listOryCMSContentEntries).toHaveBeenCalledWith(
      "posts",
      expect.objectContaining({ includeDrafts: true }),
    );
  });
});

describe("GET /collections/:collection/content/:id (get)", () => {
  it("returns a published entry to an anonymous caller", async () => {
    protectOryCMSAdminRoute.mockRejectedValue(UNAUTHORIZED);
    getOryCMSContentEntry.mockResolvedValue(PUBLISHED_ENTRY);

    const res = await call(
      getContentRoute,
      req({ path: "/api/orycms/collections/posts/content/e1" }),
      {
        collection: "posts",
        id: "e1",
      },
    );

    expect(res.status).toBe(200);
  });

  it("returns 404, not the draft, to an anonymous caller", async () => {
    protectOryCMSAdminRoute.mockRejectedValue(UNAUTHORIZED);
    getOryCMSContentEntry.mockResolvedValue(DRAFT_ENTRY);

    const res = await call(
      getContentRoute,
      req({ path: "/api/orycms/collections/posts/content/e2" }),
      {
        collection: "posts",
        id: "e2",
      },
    );

    expect(res.status).toBe(404);
    const body = (await res.json()) as { data?: unknown };
    expect(body.data).toBeUndefined();
  });

  it("returns 404, not the draft, to a session that lacks content:read", async () => {
    requireOryCMSPermission.mockRejectedValue(FORBIDDEN);
    getOryCMSContentEntry.mockResolvedValue(DRAFT_ENTRY);

    const res = await call(
      getContentRoute,
      req({ path: "/api/orycms/collections/posts/content/e2" }),
      {
        collection: "posts",
        id: "e2",
      },
    );

    expect(res.status).toBe(404);
  });

  it("returns the draft to a session with content:read", async () => {
    getOryCMSContentEntry.mockResolvedValue(DRAFT_ENTRY);

    const res = await call(
      getContentRoute,
      req({ path: "/api/orycms/collections/posts/content/e2" }),
      {
        collection: "posts",
        id: "e2",
      },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown };
    expect(body.data).toEqual(DRAFT_ENTRY);
  });
});

describe("POST /collections/:collection/content (create)", () => {
  it("returns 401 when there is no session", async () => {
    protectOryCMSAdminRoute.mockRejectedValue(UNAUTHORIZED);

    const res = await call(
      createContentRoute,
      req({ method: "POST", body: { data: { title: "Hi" } } }),
      { collection: "posts" },
    );

    expect(res.status).toBe(401);
    expect(createOryCMSContentEntry).not.toHaveBeenCalled();
  });

  it("returns 403 when the session lacks content:create", async () => {
    requireOryCMSPermission.mockRejectedValue(FORBIDDEN);

    const res = await call(
      createContentRoute,
      req({ method: "POST", body: { data: { title: "Hi" } } }),
      { collection: "posts" },
    );

    expect(res.status).toBe(403);
    expect(requireOryCMSPermission).toHaveBeenCalledWith(SESSION, "content", "create");
    expect(createOryCMSContentEntry).not.toHaveBeenCalled();
  });

  it("returns 201 on success", async () => {
    createOryCMSContentEntry.mockResolvedValue(PUBLISHED_ENTRY);

    const res = await call(
      createContentRoute,
      req({ method: "POST", body: { data: { title: "Hi" } } }),
      { collection: "posts" },
    );

    expect(res.status).toBe(201);
  });

  it("maps a client-supplied system column to a clean 422, with no internal detail", async () => {
    createOryCMSContentEntry.mockRejectedValue(
      new OryCMSContentError(
        "FIELD_FORBIDDEN",
        '"id" is managed by the system and cannot be set directly.',
        422,
        "id",
      ),
    );

    const res = await call(
      createContentRoute,
      req({ method: "POST", body: { data: { id: "attacker-chosen", title: "Hi" } } }),
      { collection: "posts" },
    );

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

    const res = await call(
      createContentRoute,
      req({ method: "POST", body: { data: { title: "Hi" } } }),
      { collection: "posts" },
    );

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("DUPLICATE_VALUE");
    expect(JSON.stringify(body)).not.toMatch(/constraint|postgresql:\/\//i);
  });
});

describe("PATCH /collections/:collection/content/:id (update)", () => {
  it("returns 401 when there is no session", async () => {
    protectOryCMSAdminRoute.mockRejectedValue(UNAUTHORIZED);

    const res = await call(
      updateContentRoute,
      req({ method: "PATCH", body: { data: { title: "Hi" } } }),
      { collection: "posts", id: "e1" },
    );

    expect(res.status).toBe(401);
    expect(updateOryCMSContentEntry).not.toHaveBeenCalled();
  });

  it("returns 403 when the session lacks content:update", async () => {
    requireOryCMSPermission.mockRejectedValue(FORBIDDEN);

    const res = await call(
      updateContentRoute,
      req({ method: "PATCH", body: { data: { title: "Hi" } } }),
      { collection: "posts", id: "e1" },
    );

    expect(res.status).toBe(403);
    expect(requireOryCMSPermission).toHaveBeenCalledWith(SESSION, "content", "update");
    expect(updateOryCMSContentEntry).not.toHaveBeenCalled();
  });

  it("returns 200 on success", async () => {
    updateOryCMSContentEntry.mockResolvedValue(PUBLISHED_ENTRY);

    const res = await call(
      updateContentRoute,
      req({ method: "PATCH", body: { data: { title: "Hi" } } }),
      { collection: "posts", id: "e1" },
    );

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

    const res = await call(
      updateContentRoute,
      req({ method: "PATCH", body: { data: { _isDraft: false } } }),
      { collection: "posts", id: "e1" },
    );

    expect(res.status).toBe(422);
  });
});

describe("DELETE /collections/:collection/content/:id (delete)", () => {
  it("returns 401 when there is no session", async () => {
    protectOryCMSAdminRoute.mockRejectedValue(UNAUTHORIZED);

    const res = await call(deleteContentRoute, req({ method: "DELETE" }), {
      collection: "posts",
      id: "e1",
    });

    expect(res.status).toBe(401);
    expect(deleteOryCMSContentEntry).not.toHaveBeenCalled();
  });

  it("returns 403 when the session lacks content:delete", async () => {
    requireOryCMSPermission.mockRejectedValue(FORBIDDEN);

    const res = await call(deleteContentRoute, req({ method: "DELETE" }), {
      collection: "posts",
      id: "e1",
    });

    expect(res.status).toBe(403);
    expect(requireOryCMSPermission).toHaveBeenCalledWith(SESSION, "content", "delete");
    expect(deleteOryCMSContentEntry).not.toHaveBeenCalled();
  });

  it("returns 200 with a null payload on success", async () => {
    deleteOryCMSContentEntry.mockResolvedValue(undefined);

    const res = await call(deleteContentRoute, req({ method: "DELETE" }), {
      collection: "posts",
      id: "e1",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown };
    expect(body.data).toBeNull();
  });
});

describe("POST /collections/:collection/content/:id/publish (publish)", () => {
  it("returns 401 when there is no session", async () => {
    protectOryCMSAdminRoute.mockRejectedValue(UNAUTHORIZED);

    const res = await call(publishContentRoute, req({ method: "POST" }), {
      collection: "posts",
      id: "e1",
    });

    expect(res.status).toBe(401);
    expect(publishOryCMSContentEntry).not.toHaveBeenCalled();
    expect(recordOryCMSAuditLog).not.toHaveBeenCalled();
  });

  it("returns 403 when the session lacks content:publish (e.g. an Author)", async () => {
    requireOryCMSPermission.mockRejectedValue(FORBIDDEN);

    const res = await call(publishContentRoute, req({ method: "POST" }), {
      collection: "posts",
      id: "e1",
    });

    expect(res.status).toBe(403);
    expect(requireOryCMSPermission).toHaveBeenCalledWith(SESSION, "content", "publish");
    expect(publishOryCMSContentEntry).not.toHaveBeenCalled();
    expect(recordOryCMSAuditLog).not.toHaveBeenCalled();
  });

  it("returns 200 and records an audit row without the entry's content, on success", async () => {
    publishOryCMSContentEntry.mockResolvedValue({
      id: "e1",
      status: "published",
      data: { title: "secret draft text" },
    });

    const res = await call(publishContentRoute, req({ method: "POST" }), {
      collection: "posts",
      id: "e1",
    });

    expect(res.status).toBe(200);
    expect(recordOryCMSAuditLog).toHaveBeenCalledTimes(1);
    const auditCall = recordOryCMSAuditLog.mock.calls[0][0] as Record<string, unknown>;
    expect(auditCall).toMatchObject({
      userId: SESSION.userId,
      action: "publish",
      resource: "content",
      resourceId: "e1",
    });
    expect(JSON.stringify(auditCall)).not.toContain("secret draft text");
  });

  it("maps COLLECTION_NOT_FOUND to a clean 404", async () => {
    publishOryCMSContentEntry.mockRejectedValue(
      new OryCMSContentError("COLLECTION_NOT_FOUND", 'Collection "posts" is not registered.', 404),
    );

    const res = await call(publishContentRoute, req({ method: "POST" }), {
      collection: "posts",
      id: "e1",
    });

    expect(res.status).toBe(404);
  });

  it("maps ENTRY_NOT_FOUND to a clean 404", async () => {
    publishOryCMSContentEntry.mockRejectedValue(
      new OryCMSContentError("ENTRY_NOT_FOUND", 'Entry "e1" not found.', 404),
    );

    const res = await call(publishContentRoute, req({ method: "POST" }), {
      collection: "posts",
      id: "e1",
    });

    expect(res.status).toBe(404);
  });

  it("maps ALREADY_PUBLISHED to a clean 409, with no driver text", async () => {
    publishOryCMSContentEntry.mockRejectedValue(
      new OryCMSContentError("ALREADY_PUBLISHED", 'Entry "e1" is already published.', 409),
    );

    const res = await call(publishContentRoute, req({ method: "POST" }), {
      collection: "posts",
      id: "e1",
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("ALREADY_PUBLISHED");
    expect(JSON.stringify(body)).not.toMatch(/postgresql:\/\/|ECONNREFUSED|at async/i);
  });

  it("does not record an audit row when the publish itself fails", async () => {
    publishOryCMSContentEntry.mockRejectedValue(
      new OryCMSContentError("ALREADY_PUBLISHED", 'Entry "e1" is already published.', 409),
    );

    await call(publishContentRoute, req({ method: "POST" }), { collection: "posts", id: "e1" });

    expect(recordOryCMSAuditLog).not.toHaveBeenCalled();
  });

  it("still returns 200 when the audit write itself fails", async () => {
    publishOryCMSContentEntry.mockResolvedValue({ id: "e1", status: "published", data: {} });
    recordOryCMSAuditLog.mockRejectedValue(new Error("audit table unavailable"));

    const res = await call(publishContentRoute, req({ method: "POST" }), {
      collection: "posts",
      id: "e1",
    });

    expect(res.status).toBe(200);
  });
});

describe("DELETE /collections/:collection/content/:id/publish (unpublish)", () => {
  it("returns 401 when there is no session", async () => {
    protectOryCMSAdminRoute.mockRejectedValue(UNAUTHORIZED);

    const res = await call(unpublishContentRoute, req({ method: "DELETE" }), {
      collection: "posts",
      id: "e1",
    });

    expect(res.status).toBe(401);
    expect(unpublishOryCMSContentEntry).not.toHaveBeenCalled();
  });

  it("returns 403 when the session lacks content:publish", async () => {
    requireOryCMSPermission.mockRejectedValue(FORBIDDEN);

    const res = await call(unpublishContentRoute, req({ method: "DELETE" }), {
      collection: "posts",
      id: "e1",
    });

    expect(res.status).toBe(403);
    expect(requireOryCMSPermission).toHaveBeenCalledWith(SESSION, "content", "publish");
    expect(unpublishOryCMSContentEntry).not.toHaveBeenCalled();
  });

  it("returns 200 and records an audit row on success", async () => {
    unpublishOryCMSContentEntry.mockResolvedValue({ id: "e1", status: "draft", data: {} });

    const res = await call(unpublishContentRoute, req({ method: "DELETE" }), {
      collection: "posts",
      id: "e1",
    });

    expect(res.status).toBe(200);
    expect(recordOryCMSAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "unpublish", resource: "content", resourceId: "e1" }),
    );
  });

  it("maps NOT_PUBLISHED to a clean 409", async () => {
    unpublishOryCMSContentEntry.mockRejectedValue(
      new OryCMSContentError("NOT_PUBLISHED", 'Entry "e1" is not published.', 409),
    );

    const res = await call(unpublishContentRoute, req({ method: "DELETE" }), {
      collection: "posts",
      id: "e1",
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NOT_PUBLISHED");
  });

  it("maps ENTRY_NOT_FOUND to a clean 404", async () => {
    unpublishOryCMSContentEntry.mockRejectedValue(
      new OryCMSContentError("ENTRY_NOT_FOUND", 'Entry "e1" not found.', 404),
    );

    const res = await call(unpublishContentRoute, req({ method: "DELETE" }), {
      collection: "posts",
      id: "e1",
    });

    expect(res.status).toBe(404);
  });
});
