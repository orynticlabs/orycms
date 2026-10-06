import { describe, it, expect, vi, beforeEach } from "vitest";

// Mirrors the mocking pattern in collections.test.ts: the auth and RBAC
// boundaries are mocked, the real audit repository runs, and only the pool
// it asks for is faked. No database is touched.

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

// Import AFTER mocks are registered.
const { auditRoutes } = await import("../routes/audit");

const listAuditRoute = auditRoutes.find((r) => r.method === "GET" && r.pattern === "audit");
if (!listAuditRoute) throw new Error("GET audit route not found in auditRoutes");

const SESSION = { userId: "admin-1" };

function get(query = ""): Request {
  return new Request(`http://localhost/api/orycms/audit${query ? `?${query}` : ""}`);
}

function ctx(request: Request) {
  return { request, params: {}, url: new URL(request.url) };
}

const call = async (query = "") => listAuditRoute.handler(ctx(get(query)));

/** The LIMIT and OFFSET values are the last two bound parameters of the list query. */
function pagingParams(): { limit: unknown; offset: unknown } {
  const params = fakeQuery.mock.calls[0][1] as unknown[];
  return { limit: params[params.length - 2], offset: params[params.length - 1] };
}

const ROW = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "admin-1",
  action: "update",
  resource: "settings",
  resourceId: "site.name",
  metadata: { fields: ["name"] },
  ipAddress: "127.0.0.1",
  userAgent: "test-agent",
  createdAt: "2026-10-06T00:00:00.000Z",
};

beforeEach(() => {
  protectOryCMSAdminRoute.mockReset();
  requireOryCMSPermission.mockReset();
  fakeQuery.mockReset();
  protectOryCMSAdminRoute.mockResolvedValue(SESSION);
  requireOryCMSPermission.mockResolvedValue(undefined);
  fakeQuery.mockResolvedValue({ rows: [ROW] });
});

describe("GET audit route (packages/core)", () => {
  describe("authentication and authorisation", () => {
    it("rejects an unauthenticated request with 401 and never queries", async () => {
      protectOryCMSAdminRoute.mockRejectedValue(
        new OryCMSAuthError("UNAUTHORIZED", "Authentication required.", 401),
      );

      const res = await call();

      expect(res.status).toBe(401);
      const body = (await res.json()) as { success: boolean; error: { code: string } };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
      expect(requireOryCMSPermission).not.toHaveBeenCalled();
      expect(fakeQuery).not.toHaveBeenCalled();
    });

    it("rejects an authenticated caller without audit:read with 403 and never queries", async () => {
      requireOryCMSPermission.mockRejectedValue(
        new OryCMSAuthError("FORBIDDEN", "You do not have permission to perform this action.", 403),
      );

      const res = await call();

      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("FORBIDDEN");
      expect(requireOryCMSPermission).toHaveBeenCalledWith(SESSION, "audit", "read", fakePool);
      expect(fakeQuery).not.toHaveBeenCalled();
    });
  });

  describe("response shape", () => {
    it("returns 200 with the {success, data} envelope and the audit columns", async () => {
      const res = await call();

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; data: unknown[] };
      expect(body.success).toBe(true);
      expect(body.data).toEqual([ROW]);
    });

    it("selects an explicit column list, never SELECT *", async () => {
      await call();

      const sql = fakeQuery.mock.calls[0][0] as string;
      expect(sql).not.toMatch(/SELECT\s+\*/i);
      expect(sql).toContain(
        'SELECT id, "userId", action, resource, "resourceId", metadata, "ipAddress", "userAgent", "createdAt"',
      );
    });

    it("never includes credential or session material in the response", async () => {
      const res = await call();
      const text = await res.text();

      expect(text).not.toMatch(
        /password|passwordHash|tokenHash|token_hash|sessionToken|smtp|secret/i,
      );
    });
  });

  describe("pagination", () => {
    it("uses limit 50 and offset 0 when neither is given", async () => {
      await call();

      expect(pagingParams()).toEqual({ limit: 50, offset: 0 });
    });

    it("clamps a huge limit to 200", async () => {
      const res = await call("limit=999999999");

      expect(res.status).toBe(200);
      expect(pagingParams().limit).toBe(200);
    });

    it("clamps a negative limit up to 1", async () => {
      const res = await call("limit=-5");

      expect(res.status).toBe(200);
      expect(pagingParams().limit).toBe(1);
    });

    it("clamps a negative offset up to 0", async () => {
      const res = await call("offset=-10");

      expect(res.status).toBe(200);
      expect(pagingParams().offset).toBe(0);
    });

    it("clamps an offset beyond the safe integer range", async () => {
      const res = await call("offset=99999999999999999999999");

      expect(res.status).toBe(200);
      expect(Number.isSafeInteger(pagingParams().offset)).toBe(true);
    });

    it("rejects a non-numeric limit with 400 and never queries", async () => {
      const res = await call("limit=abc");

      expect(res.status).toBe(400);
      const body = (await res.json()) as { success: boolean; error: { code: string } };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(fakeQuery).not.toHaveBeenCalled();
    });

    it("rejects a partly numeric limit such as 10abc with 400", async () => {
      const res = await call("limit=10abc");

      expect(res.status).toBe(400);
      expect(fakeQuery).not.toHaveBeenCalled();
    });

    it("rejects a fractional limit such as 1.5 with 400", async () => {
      const res = await call("limit=1.5");

      expect(res.status).toBe(400);
      expect(fakeQuery).not.toHaveBeenCalled();
    });

    it("rejects a non-numeric offset with 400 and never queries", async () => {
      const res = await call("offset=abc");

      expect(res.status).toBe(400);
      expect(fakeQuery).not.toHaveBeenCalled();
    });
  });

  describe("filters and sort", () => {
    it("binds filter values as parameters, never as SQL text", async () => {
      const hostile = "x' OR '1'='1";

      const res = await call(
        `userId=${encodeURIComponent(hostile)}&action=${encodeURIComponent(hostile)}`,
      );

      expect(res.status).toBe(200);
      const sql = fakeQuery.mock.calls[0][0] as string;
      const params = fakeQuery.mock.calls[0][1] as unknown[];
      expect(sql).not.toContain("OR '1'");
      expect(params).toContain(hostile);
    });

    it("ignores a sort parameter: ORDER BY stays fixed and the value never reaches SQL", async () => {
      const res = await call("sort=action;DROP%20TABLE%20orycms_audit_logs");

      expect(res.status).toBe(200);
      const sql = fakeQuery.mock.calls[0][0] as string;
      expect(sql).toContain('ORDER BY "createdAt" DESC');
      expect(sql).not.toMatch(/DROP/i);
    });

    it("ignores unknown query parameters: same 200 response and same SQL as an unfiltered call", async () => {
      const res = await call("unknownFilter=1&another=x");

      expect(res.status).toBe(200);
      const sql = fakeQuery.mock.calls[0][0] as string;
      expect(sql).not.toContain("WHERE");
      expect(pagingParams()).toEqual({ limit: 50, offset: 0 });
    });
  });
});
