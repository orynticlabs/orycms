import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toErrorResponse } from "../../lib/route-guards";
import { OryCMSPluginError } from "../../plugins/plugin.engine";
import { OryCMSManifestError } from "../../plugins/plugin.manifest";
import { safeRouteError } from "../route-errors";

// Core routes and the shared mapper. Auth, RBAC and the pool are mocked; the real
// route modules run. No database is touched.

const protectOryCMSAdminRoute = vi.fn();
const requireOryCMSPermission = vi.fn();
const fakeQuery = vi.fn();
const fakePool = { query: (...args: unknown[]) => fakeQuery(...args) };

const { OryCMSAuthError } = vi.hoisted(() => {
  class OryCMSAuthError extends Error {
    code: string;
    statusCode: number;
    constructor(code: string, message: string, statusCode = 401) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
    }
  }
  return { OryCMSAuthError };
});

vi.mock("@/auth", () => ({
  protectOryCMSAdminRoute: (...args: unknown[]) => protectOryCMSAdminRoute(...args),
  OryCMSAuthError,
}));

vi.mock("@/rbac", () => ({
  requireOryCMSPermission: (...args: unknown[]) => requireOryCMSPermission(...args),
  getOryCMSUserPermissions: vi.fn(async () => new Set<string>()),
  clearOryCMSPermissionCache: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getOryCMSPool: () => fakePool,
}));

// Import AFTER mocks are registered.
const { auditRoutes } = await import("../routes/audit");
const { settingsRoutes } = await import("../routes/settings");
const { userRoutes } = await import("../routes/users");

const FAKE_URL = "postgresql://svc_user:Hunter2-fake@db.internal.example:5432/orycms_prod";
const FAKE_PASSWORD = "Hunter2-fake";

/** A driver-style error: string SQLSTATE `code`, message carrying connection detail. */
function driverError(message: string, code = "28P01"): Error {
  return Object.assign(new Error(message), { code });
}

/** The `error` member of a response body. */
async function errorBody(res: Response): Promise<Record<string, unknown>> {
  return ((await res.json()) as { error: Record<string, unknown> }).error;
}

function findRoute(
  routes: Array<{ method: string; pattern: string; handler: unknown }>,
  method: string,
  pattern: string,
) {
  const route = routes.find((r) => r.method === method && r.pattern === pattern);
  if (!route) throw new Error(`${method} ${pattern} not found`);
  return route as unknown as { handler: (ctx: unknown) => Promise<Response> };
}

const auditList = findRoute(auditRoutes, "GET", "audit");
const settingsList = findRoute(settingsRoutes, "GET", "settings");
const usersList = findRoute(userRoutes, "GET", "users");

const ctxFor = (path: string) => {
  const request = new Request(`http://localhost${path}`);
  return { request, params: {}, url: new URL(request.url) };
};

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  protectOryCMSAdminRoute.mockReset();
  requireOryCMSPermission.mockReset();
  fakeQuery.mockReset();
  protectOryCMSAdminRoute.mockResolvedValue({
    userId: "admin-1",
    email: "admin@example.test",
    roleName: "Owner",
  });
  requireOryCMSPermission.mockResolvedValue(undefined);
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("shared mapper in packages/core (toErrorResponse)", () => {
  it("returns a generic 500 for a driver error with a SQLSTATE code, and never its message", async () => {
    const res = toErrorResponse(driverError(`password authentication failed for ${FAKE_URL}`));
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(text).not.toContain(FAKE_URL);
    expect(text).not.toContain(FAKE_PASSWORD);
    expect(JSON.parse(text).error.code).toBe("INTERNAL_ERROR");
  });

  it("logs the driver detail with the URL and password redacted", async () => {
    toErrorResponse(driverError(`connect failed: ${FAKE_URL}`, "08006"));

    const logged = consoleError.mock.calls
      .map((c: unknown[]) => c.map(String).join(" "))
      .join("\n");
    expect(logged).toContain("[redacted-url]");
    expect(logged).not.toContain(FAKE_URL);
    expect(logged).not.toContain(FAKE_PASSWORD);
  });

  it("keeps the message and status of a deliberate status error", async () => {
    const res = toErrorResponse(new OryCMSAuthError("FORBIDDEN", "nope", 403));

    expect(res.status).toBe(403);
    expect(await errorBody(res)).toEqual({ code: "FORBIDDEN", message: "nope" });
  });

  it("keeps the message of a plugin error (400) and maps *_NOT_FOUND to 404", async () => {
    const bad = toErrorResponse(new OryCMSPluginError("INVALID_PLUGIN", "bad plugin"));
    const missing = toErrorResponse(new OryCMSPluginError("PLUGIN_NOT_FOUND", "missing"));

    expect(bad.status).toBe(400);
    expect((await errorBody(bad)).message).toBe("bad plugin");
    expect(missing.status).toBe(404);
  });

  it("keeps the message of a manifest error (400)", async () => {
    const res = toErrorResponse(
      new OryCMSManifestError("MANIFEST_INVALID", "name must be a string."),
    );

    expect(res.status).toBe(400);
    expect((await errorBody(res)).message).toBe("name must be a string.");
  });

  it("does not pass through an arbitrary coded error that is not a deliberate class", async () => {
    const res = toErrorResponse(Object.assign(new Error("bad plugin"), { code: "INVALID_PLUGIN" }));

    expect(res.status).toBe(500);
    expect((await errorBody(res)).code).toBe("INTERNAL_ERROR");
  });

  it("does not pass through a status that is not a known deliberate status", async () => {
    const res = toErrorResponse(
      new OryCMSAuthError("UPSTREAM", `upstream failed at ${FAKE_URL}`, 503),
    );
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(text).not.toContain(FAKE_URL);
  });
});

describe("safeRouteError (shared helper)", () => {
  it("passes through issues and field on a deliberate error", async () => {
    const err = Object.assign(new Error("bad input"), {
      code: "VALIDATION_ERROR",
      statusCode: 422,
      field: "name",
      issues: [{ path: "name" }],
    });

    const res = safeRouteError("test", err);

    expect(res.status).toBe(422);
    expect(await errorBody(res)).toEqual({
      code: "VALIDATION_ERROR",
      message: "bad input",
      field: "name",
      issues: [{ path: "name" }],
    });
  });
});

describe("core routes that use the mapper: driver errors never reach the body", () => {
  it("audit list returns a generic 500 for a driver error", async () => {
    fakeQuery.mockRejectedValue(driverError(`password authentication failed for ${FAKE_URL}`));

    const res = await auditList.handler(ctxFor("/api/orycms/audit"));
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(text).not.toContain(FAKE_URL);
    expect(text).not.toContain(FAKE_PASSWORD);
  });

  it("settings list returns a generic 500 for a driver error", async () => {
    fakeQuery.mockRejectedValue(driverError(`password authentication failed for ${FAKE_URL}`));

    const res = await settingsList.handler(ctxFor("/api/orycms/settings"));
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(text).not.toContain(FAKE_URL);
    expect(text).not.toContain(FAKE_PASSWORD);
  });

  it("users list returns a generic 500 for a driver error", async () => {
    fakeQuery.mockRejectedValue(driverError(`password authentication failed for ${FAKE_URL}`));

    const res = await usersList.handler(ctxFor("/api/orycms/users"));
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(text).not.toContain(FAKE_URL);
    expect(text).not.toContain(FAKE_PASSWORD);
  });

  it("a route's driver error is logged with the URL redacted", async () => {
    fakeQuery.mockRejectedValue(driverError(`password authentication failed for ${FAKE_URL}`));

    await settingsList.handler(ctxFor("/api/orycms/settings"));

    const logged = consoleError.mock.calls
      .map((c: unknown[]) => c.map(String).join(" "))
      .join("\n");
    expect(logged).not.toContain(FAKE_URL);
    expect(logged).not.toContain(FAKE_PASSWORD);
  });

  it("an authorised caller still gets the deliberate 403 message", async () => {
    requireOryCMSPermission.mockRejectedValue(
      new OryCMSAuthError("FORBIDDEN", "You do not have permission to perform this action.", 403),
    );

    const res = await usersList.handler(ctxFor("/api/orycms/users"));

    expect(res.status).toBe(403);
    expect((await errorBody(res)).code).toBe("FORBIDDEN");
  });
});
