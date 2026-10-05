import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mirrors settings.test.ts: auth and RBAC are mocked, the bootstrap installer is
// mocked (it opens its own connection), and the shared pool is faked. No database
// is touched.

const protectOryCMSAdminRoute = vi.fn();
const requireOryCMSPermission = vi.fn();
const bootstrapOryCMS = vi.fn();
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

vi.mock("@/core", () => ({
  bootstrapOryCMS: (...args: unknown[]) => bootstrapOryCMS(...args),
}));

// Import AFTER mocks are registered.
const { databaseRoutes } = await import("../routes/database");

function findRoute(method: string, pattern: string) {
  const route = databaseRoutes.find((r) => r.method === method && r.pattern === pattern);
  if (!route) throw new Error(`${method} ${pattern} not found in databaseRoutes`);
  return route;
}

const listRoute = findRoute("GET", "database/migrations");
const runRoute = findRoute("POST", "database/migrations");
const schemasRoute = findRoute("GET", "database/schemas");

const SESSION = { userId: "admin-1" };

/** A connection string and password that look real. They must never appear in a response. */
const FAKE_URL = "postgresql://svc_user:Hunter2-fake@db.internal.example:5432/orycms_prod";
const FAKE_PASSWORD = "Hunter2-fake";

/** A driver-style error: string SQLSTATE `code`, message carrying connection detail. */
function driverError(message: string, code = "28P01"): Error {
  return Object.assign(new Error(message), { code });
}

const MIGRATION_ROW = {
  migrationId: "core-0001",
  name: "create core tables",
  appliedAt: "2026-10-06T00:00:00.000Z",
  durationMs: 42,
};

const SUCCESS_RESULT = {
  install: { success: true, applied: ["core-0001"], skipped: [], failed: [] },
  seeded: true,
};

const listCall = async (): Promise<Response> => {
  const request = new Request("http://localhost/api/orycms/database/migrations");
  return listRoute.handler({ request, params: {}, url: new URL(request.url) });
};

const runCall = async (init?: { body?: string; query?: string }): Promise<Response> => {
  const url = `http://localhost/api/orycms/database/migrations${init?.query ?? ""}`;
  const request = new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: init?.body,
  });
  return runRoute.handler({ request, params: {}, url: new URL(request.url) });
};

const FORBIDDEN = new OryCMSAuthError(
  "FORBIDDEN",
  "You do not have permission to perform this action.",
  403,
);

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  protectOryCMSAdminRoute.mockReset();
  requireOryCMSPermission.mockReset();
  bootstrapOryCMS.mockReset();
  fakeQuery.mockReset();
  protectOryCMSAdminRoute.mockResolvedValue(SESSION);
  requireOryCMSPermission.mockResolvedValue(undefined);
  bootstrapOryCMS.mockResolvedValue(SUCCESS_RESULT);
  fakeQuery.mockResolvedValue({ rows: [MIGRATION_ROW] });
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("database routes (packages/core)", () => {
  describe("GET database/migrations", () => {
    it("rejects an unauthenticated request with 401 and never queries", async () => {
      protectOryCMSAdminRoute.mockRejectedValue(
        new OryCMSAuthError("UNAUTHORIZED", "Authentication required.", 401),
      );

      const res = await listCall();

      expect(res.status).toBe(401);
      expect(fakeQuery).not.toHaveBeenCalled();
    });

    it("rejects a caller without migrations:read with 403 and never queries", async () => {
      requireOryCMSPermission.mockRejectedValue(FORBIDDEN);

      const res = await listCall();

      expect(res.status).toBe(403);
      expect(requireOryCMSPermission).toHaveBeenCalledWith(SESSION, "migrations", "read", fakePool);
      expect(fakeQuery).not.toHaveBeenCalled();
    });

    it("returns 200 with the applied-migration rows", async () => {
      const res = await listCall();

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; data: unknown[] };
      expect(body).toEqual({ success: true, data: [MIGRATION_ROW] });
    });

    it("selects an explicit column list, never SELECT *", async () => {
      await listCall();

      const sql = String(fakeQuery.mock.calls[0][0]);
      expect(sql).not.toMatch(/SELECT\s+\*/i);
      expect(sql).toContain('SELECT "migrationId", name, "appliedAt", "durationMs"');
    });

    it("a driver error does not leak the connection string into the response", async () => {
      fakeQuery.mockRejectedValue(driverError(`password authentication failed for ${FAKE_URL}`));

      const res = await listCall();
      const text = await res.text();

      expect(text).not.toContain(FAKE_URL);
      expect(text).not.toContain(FAKE_PASSWORD);
      expect(res.status).toBe(500);
      expect(text).toContain('"INTERNAL_ERROR"');
    });

    it("logs the driver detail server-side with the password redacted", async () => {
      fakeQuery.mockRejectedValue(driverError(`password authentication failed for ${FAKE_URL}`));

      await listCall();

      const logged = consoleError.mock.calls
        .map((c: unknown[]) => c.map(String).join(" "))
        .join("\n");
      expect(logged).toContain("database.migrations.list");
      expect(logged).not.toContain(FAKE_PASSWORD);
      expect(logged).not.toContain(FAKE_URL);
    });
  });

  describe("POST database/migrations", () => {
    it("rejects an unauthenticated request with 401 and never runs the install", async () => {
      protectOryCMSAdminRoute.mockRejectedValue(
        new OryCMSAuthError("UNAUTHORIZED", "Authentication required.", 401),
      );

      const res = await runCall();

      expect(res.status).toBe(401);
      expect(bootstrapOryCMS).not.toHaveBeenCalled();
    });

    it("rejects a caller without migrations:create with 403 and never runs the install", async () => {
      requireOryCMSPermission.mockRejectedValue(FORBIDDEN);

      const res = await runCall();

      expect(res.status).toBe(403);
      expect(requireOryCMSPermission).toHaveBeenCalledWith(
        SESSION,
        "migrations",
        "create",
        fakePool,
      );
      expect(bootstrapOryCMS).not.toHaveBeenCalled();
    });

    it("runs the install and returns 200 with the result on success", async () => {
      const res = await runCall();

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; data: unknown };
      expect(body).toEqual({ success: true, data: SUCCESS_RESULT });
    });

    it("records an audit row with the applied list, not the error text", async () => {
      await runCall();

      const audit = fakeQuery.mock.calls.find((c) => String(c[0]).includes("orycms_audit_logs"));
      expect(audit).toBeDefined();
      expect((audit?.[1] as unknown[])[1]).toBe("migrate");
      const metadata = String((audit?.[1] as unknown[])[4]);
      expect(metadata).toContain("core-0001");
    });

    it("ignores SQL, table names and file paths sent in the body or query string", async () => {
      const res = await runCall({
        query: "?sql=DROP%20TABLE%20users&table=users&path=/etc/passwd",
        body: JSON.stringify({ sql: "DROP TABLE users", table: "users", path: "/etc/passwd" }),
      });

      expect(res.status).toBe(200);
      expect(bootstrapOryCMS).toHaveBeenCalledTimes(1);
      expect(bootstrapOryCMS.mock.calls[0]).toEqual([]);
    });

    it("runs the install even when the body is not valid JSON, because the body is never parsed", async () => {
      const res = await runCall({ body: "{not json" });

      expect(res.status).toBe(200);
      expect(bootstrapOryCMS).toHaveBeenCalledTimes(1);
    });

    it("a failed install returns a generic 500 envelope with no driver text in the body", async () => {
      bootstrapOryCMS.mockResolvedValue({
        install: {
          success: false,
          applied: [],
          skipped: [],
          failed: [
            { migrationId: "core-0002", name: "users", error: `connect failed: ${FAKE_URL}` },
          ],
        },
        seeded: false,
      });

      const res = await runCall();
      const text = await res.text();

      expect(res.status).toBe(500);
      expect(text).not.toContain(FAKE_URL);
      expect(text).not.toContain(FAKE_PASSWORD);
      const body = JSON.parse(text) as {
        success: boolean;
        error: { code: string; failed: Array<{ migrationId: string; name: string }> };
      };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("SCHEMA_INSTALL_FAILED");
      expect(body.error.failed).toEqual([{ migrationId: "core-0002", name: "users" }]);
    });

    it("logs a failed install's driver text server-side with the password redacted", async () => {
      bootstrapOryCMS.mockResolvedValue({
        install: {
          success: false,
          applied: [],
          skipped: [],
          failed: [
            { migrationId: "core-0002", name: "users", error: `connect failed: ${FAKE_URL}` },
          ],
        },
        seeded: false,
      });

      await runCall();

      const logged = consoleError.mock.calls
        .map((c: unknown[]) => c.map(String).join(" "))
        .join("\n");
      expect(logged).toContain("core-0002");
      expect(logged).not.toContain(FAKE_PASSWORD);
      expect(logged).not.toContain(FAKE_URL);
    });

    it("a thrown driver error (has a SQLSTATE code) returns a generic 500, not its message as a 400", async () => {
      bootstrapOryCMS.mockRejectedValue(
        driverError(`password authentication failed for ${FAKE_URL}`),
      );

      const res = await runCall();
      const text = await res.text();

      expect(res.status).toBe(500);
      expect(text).not.toContain(FAKE_URL);
      expect(text).not.toContain(FAKE_PASSWORD);
      expect(text).toContain('"INTERNAL_ERROR"');
    });

    it("a thrown plain error returns a generic 500 with no message", async () => {
      bootstrapOryCMS.mockRejectedValue(new Error(`ECONNREFUSED ${FAKE_URL}`));

      const res = await runCall();
      const text = await res.text();

      expect(res.status).toBe(500);
      expect(text).not.toContain(FAKE_URL);
    });

    it("success responses contain no credential-like text", async () => {
      const res = await runCall();

      expect(await res.text()).not.toMatch(/password|secret|postgres(ql)?:\/\/|token|hash/i);
    });
  });

  describe("GET database/schemas (501 stub)", () => {
    it("rejects an unauthenticated request with 401", async () => {
      protectOryCMSAdminRoute.mockRejectedValue(
        new OryCMSAuthError("UNAUTHORIZED", "Authentication required.", 401),
      );
      const request = new Request("http://localhost/api/orycms/database/schemas");

      const res = await schemasRoute.handler({ request, params: {}, url: new URL(request.url) });

      expect(res.status).toBe(401);
    });

    it("returns 501 with no connection detail for an authorised caller", async () => {
      const request = new Request("http://localhost/api/orycms/database/schemas");

      const res = await schemasRoute.handler({ request, params: {}, url: new URL(request.url) });

      expect(res.status).toBe(501);
      expect(await res.text()).not.toMatch(/postgres(ql)?:\/\/|password/i);
    });
  });
});
