import { describe, it, expect, vi, beforeEach } from "vitest";

// Mirrors audit.test.ts: auth and RBAC are mocked, the real settings and audit
// repositories run, and only the pool they ask for is faked. No database is touched.

const protectOryCMSAdminRoute = vi.fn();
const requireOryCMSPermission = vi.fn();
const fakeQuery = vi.fn();
const fakePool = { query: (...args: unknown[]) => fakeQuery(...args) };

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

vi.mock("@/lib/db", () => ({
  getOryCMSPool: () => fakePool,
}));

import type { OryCMSRoute } from "../dispatcher";

// Import AFTER mocks are registered.
const { settingsRoutes } = await import("../routes/settings");

function findRoute(method: string, pattern: string) {
  const route = settingsRoutes.find((r) => r.method === method && r.pattern === pattern);
  if (!route) throw new Error(`${method} ${pattern} not found in settingsRoutes`);
  return route;
}

const listRoute = findRoute("GET", "settings");
const updateRoute = findRoute("PATCH", "settings");
const listKeysRoute = findRoute("GET", "settings/api-keys");
const createKeyRoute = findRoute("POST", "settings/api-keys");
const deleteKeyRoute = findRoute("DELETE", "settings/api-keys/:id");

const SESSION = { userId: "admin-1" };

const SETTING_ROW = {
  key: "site_name",
  value: "My Site",
  description: "Public site name",
};

const ROWS = [SETTING_ROW];

const listCall = async (): Promise<Response> =>
  listRoute.handler({
    request: new Request("http://localhost/api/orycms/settings"),
    params: {},
    url: new URL("http://localhost/api/orycms/settings"),
  });

const patchCall = async (body: unknown, raw?: string): Promise<Response> => {
  const request = new Request("http://localhost/api/orycms/settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body),
  });
  return updateRoute.handler({ request, params: {}, url: new URL(request.url) });
};

const keyCall = async (route: OryCMSRoute, params: Record<string, string> = {}) => {
  const request = new Request("http://localhost/api/orycms/settings/api-keys", { method: "POST" });
  return route.handler({ request, params, url: new URL(request.url) });
};

/** Settings-table queries are the ones whose SQL mentions orycms_settings. */
function settingsQueries(): unknown[][] {
  return fakeQuery.mock.calls.filter((c) => String(c[0]).includes("orycms_settings"));
}

beforeEach(() => {
  protectOryCMSAdminRoute.mockReset();
  requireOryCMSPermission.mockReset();
  fakeQuery.mockReset();
  protectOryCMSAdminRoute.mockResolvedValue(SESSION);
  requireOryCMSPermission.mockResolvedValue(undefined);
  fakeQuery.mockImplementation(async (sql: string) => {
    if (sql.includes("orycms_settings") && sql.includes("INSERT")) return { rows: [SETTING_ROW] };
    if (sql.includes("orycms_settings")) return { rows: ROWS };
    return { rows: [] };
  });
});

describe("settings routes (packages/core)", () => {
  describe("GET settings", () => {
    it("rejects an unauthenticated request with 401 and never queries", async () => {
      protectOryCMSAdminRoute.mockRejectedValue(
        new OryCMSAuthError("UNAUTHORIZED", "Authentication required.", 401),
      );

      const res = await listCall();

      expect(res.status).toBe(401);
      expect(requireOryCMSPermission).not.toHaveBeenCalled();
      expect(fakeQuery).not.toHaveBeenCalled();
    });

    it("rejects a caller without settings:read with 403 and never queries", async () => {
      requireOryCMSPermission.mockRejectedValue(
        new OryCMSAuthError("FORBIDDEN", "You do not have permission to perform this action.", 403),
      );

      const res = await listCall();

      expect(res.status).toBe(403);
      expect(requireOryCMSPermission).toHaveBeenCalledWith(SESSION, "settings", "read", fakePool);
      expect(fakeQuery).not.toHaveBeenCalled();
    });

    it("returns 200 with {success, data} and only key, value, description per row", async () => {
      const res = await listCall();

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; data: unknown[] };
      expect(body.success).toBe(true);
      expect(body.data).toEqual(ROWS);
    });

    it("selects an explicit column list, never SELECT *", async () => {
      await listCall();

      const sql = String(settingsQueries()[0][0]);
      expect(sql).not.toMatch(/SELECT\s+\*/i);
      expect(sql).toContain("SELECT key, value, description FROM orycms_settings");
    });
  });

  describe("PATCH settings", () => {
    it("rejects an unauthenticated request with 401 and never writes", async () => {
      protectOryCMSAdminRoute.mockRejectedValue(
        new OryCMSAuthError("UNAUTHORIZED", "Authentication required.", 401),
      );

      const res = await patchCall({ key: "site_name", value: "x" });

      expect(res.status).toBe(401);
      expect(fakeQuery).not.toHaveBeenCalled();
    });

    it("rejects a caller without settings:update with 403 and never writes", async () => {
      requireOryCMSPermission.mockRejectedValue(
        new OryCMSAuthError("FORBIDDEN", "You do not have permission to perform this action.", 403),
      );

      const res = await patchCall({ key: "site_name", value: "x" });

      expect(res.status).toBe(403);
      expect(requireOryCMSPermission).toHaveBeenCalledWith(SESSION, "settings", "update", fakePool);
      expect(fakeQuery).not.toHaveBeenCalled();
    });

    it("upserts a valid setting, returns it, and records an audit row", async () => {
      const res = await patchCall({
        key: "site_name",
        value: "My Site",
        description: "Public site name",
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: unknown };
      expect(body.data).toEqual(SETTING_ROW);

      const audit = fakeQuery.mock.calls.find((c) => String(c[0]).includes("orycms_audit_logs"));
      expect(audit).toBeDefined();
      expect((audit?.[1] as unknown[])[1]).toBe("update");
      expect((audit?.[1] as unknown[])[3]).toBe("site_name");
    });

    it("stores the value as a bound JSON parameter, never as SQL text", async () => {
      await patchCall({ key: "site_name", value: { a: 1 } });

      const [sql, params] = settingsQueries()[0] as [string, unknown[]];
      expect(sql).toContain("INSERT INTO orycms_settings");
      expect(params).toEqual(["site_name", '{"a":1}', null]);
    });

    it("accepts an unknown but well-formed key as an upsert (current behaviour, documented in PROGRESS.md)", async () => {
      const res = await patchCall({ key: "feature.beta-flag", value: true });

      expect(res.status).toBe(200);
      expect((settingsQueries()[0][1] as unknown[])[0]).toBe("feature.beta-flag");
    });

    it("rejects a missing key with 422 and never writes", async () => {
      const res = await patchCall({ value: "x" });

      expect(res.status).toBe(422);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(settingsQueries()).toHaveLength(0);
    });

    it("rejects a malformed JSON body with 422, not a 500", async () => {
      const res = await patchCall(undefined, "{not json");

      expect(res.status).toBe(422);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(fakeQuery).not.toHaveBeenCalled();
    });

    it("rejects a non-string key (object) with 422 and never writes", async () => {
      const res = await patchCall({ key: { nested: true }, value: "x" });

      expect(res.status).toBe(422);
      expect(settingsQueries()).toHaveLength(0);
    });

    it("rejects a key with characters outside the allowed set with 422 (hostile input)", async () => {
      const res = await patchCall({ key: "site'; DROP TABLE orycms_settings;--", value: "x" });

      expect(res.status).toBe(422);
      expect(fakeQuery).not.toHaveBeenCalled();
    });

    it("rejects a key longer than 128 characters with 422", async () => {
      const res = await patchCall({ key: "a".repeat(129), value: "x" });

      expect(res.status).toBe(422);
      expect(fakeQuery).not.toHaveBeenCalled();
    });

    it("rejects a missing value with 422 and never writes", async () => {
      const res = await patchCall({ key: "site_name" });

      expect(res.status).toBe(422);
      expect(settingsQueries()).toHaveLength(0);
    });

    it("rejects a non-string description with 422", async () => {
      const res = await patchCall({ key: "site_name", value: "x", description: 42 });

      expect(res.status).toBe(422);
      expect(settingsQueries()).toHaveLength(0);
    });

    it("rejects a description longer than 1000 characters with 422", async () => {
      const res = await patchCall({ key: "site_name", value: "x", description: "d".repeat(1001) });

      expect(res.status).toBe(422);
      expect(settingsQueries()).toHaveLength(0);
    });
  });

  describe("API-key routes (501 stubs in root; no key storage exists)", () => {
    it("GET api-keys: 403 without settings:read", async () => {
      requireOryCMSPermission.mockRejectedValue(
        new OryCMSAuthError("FORBIDDEN", "You do not have permission to perform this action.", 403),
      );

      const res = await keyCall(listKeysRoute);

      expect(res.status).toBe(403);
    });

    it("GET api-keys: 501 body contains no key-like material", async () => {
      const res = await keyCall(listKeysRoute);

      expect(res.status).toBe(501);
      const text = await res.text();
      expect(text).not.toMatch(/secret|token|hash|apiKey|api_key/i);
    });

    it("POST api-keys: 403 without settings:create", async () => {
      requireOryCMSPermission.mockRejectedValue(
        new OryCMSAuthError("FORBIDDEN", "You do not have permission to perform this action.", 403),
      );

      const res = await keyCall(createKeyRoute);

      expect(res.status).toBe(403);
      expect(requireOryCMSPermission).toHaveBeenCalledWith(SESSION, "settings", "create", fakePool);
    });

    it("POST api-keys: 501 for an authorised caller, with no key material", async () => {
      const res = await keyCall(createKeyRoute);

      expect(res.status).toBe(501);
      expect(await res.text()).not.toMatch(/secret|token|hash/i);
    });

    it("DELETE api-keys/:id: 403 without settings:delete (revoke requires the delete permission)", async () => {
      requireOryCMSPermission.mockRejectedValue(
        new OryCMSAuthError("FORBIDDEN", "You do not have permission to perform this action.", 403),
      );

      const res = await keyCall(deleteKeyRoute, { id: "k1" });

      expect(res.status).toBe(403);
      expect(requireOryCMSPermission).toHaveBeenCalledWith(SESSION, "settings", "delete", fakePool);
    });
  });
});
