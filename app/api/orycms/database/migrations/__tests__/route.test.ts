import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Root route test. Auth, RBAC, the pool and the bootstrap installer are mocked; the
// real route-guards and audit code run. No database is touched.

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
  clearOryCMSPermissionCache: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getOryCMSPool: () => fakePool,
}));

vi.mock("@/core", () => ({
  bootstrapOryCMS: (...args: unknown[]) => bootstrapOryCMS(...args),
}));

const { GET, POST } = await import("../route");

const SESSION = { userId: "admin-1", email: "admin@example.test", roleName: "Owner" };

const FAKE_URL = "postgresql://svc_user:Hunter2-fake@db.internal.example:5432/orycms_prod";
const FAKE_PASSWORD = "Hunter2-fake";

function driverError(message: string, code = "28P01"): Error {
  return Object.assign(new Error(message), { code });
}

const req = (method: "GET" | "POST"): NextRequest =>
  new NextRequest("http://localhost/api/orycms/database/migrations", { method });

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
  bootstrapOryCMS.mockResolvedValue({
    install: { success: true, applied: ["core-0001"], skipped: [], failed: [] },
    seeded: true,
  });
  fakeQuery.mockResolvedValue({ rows: [] });
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("GET /api/orycms/database/migrations (root)", () => {
  it("returns 401 without a session", async () => {
    protectOryCMSAdminRoute.mockRejectedValue(
      new OryCMSAuthError("UNAUTHORIZED", "Authentication required."),
    );

    const res = await GET(req("GET"));

    expect(res.status).toBe(401);
  });

  it("returns 403 without migrations:read", async () => {
    requireOryCMSPermission.mockRejectedValue(FORBIDDEN);

    const res = await GET(req("GET"));

    expect(res.status).toBe(403);
  });

  it("returns 200 with rows on success", async () => {
    fakeQuery.mockResolvedValue({ rows: [{ migrationId: "core-0001" }] });

    const res = await GET(req("GET"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: [{ migrationId: "core-0001" }] });
  });

  it("a driver error never reaches the response body", async () => {
    fakeQuery.mockRejectedValue(driverError(`password authentication failed for ${FAKE_URL}`));

    const res = await GET(req("GET"));
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(text).not.toContain(FAKE_URL);
    expect(text).not.toContain(FAKE_PASSWORD);
    expect(text).toContain('"INTERNAL_ERROR"');
  });
});

describe("POST /api/orycms/database/migrations (root)", () => {
  it("returns 401 without a session and never installs", async () => {
    protectOryCMSAdminRoute.mockRejectedValue(
      new OryCMSAuthError("UNAUTHORIZED", "Authentication required."),
    );

    const res = await POST(req("POST"));

    expect(res.status).toBe(401);
    expect(bootstrapOryCMS).not.toHaveBeenCalled();
  });

  it("returns 403 without migrations:create and never installs", async () => {
    requireOryCMSPermission.mockRejectedValue(FORBIDDEN);

    const res = await POST(req("POST"));

    expect(res.status).toBe(403);
    expect(bootstrapOryCMS).not.toHaveBeenCalled();
  });

  it("returns 200 success:true on a successful install", async () => {
    const res = await POST(req("POST"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { seeded: boolean } };
    expect(body.success).toBe(true);
    expect(body.data.seeded).toBe(true);
  });

  it("a failed install returns success:false, status 500, SCHEMA_INSTALL_FAILED, and migration ids only", async () => {
    bootstrapOryCMS.mockResolvedValue({
      install: {
        success: false,
        applied: [],
        skipped: [],
        failed: [{ migrationId: "core-0002", name: "users", error: `connect failed: ${FAKE_URL}` }],
      },
      seeded: false,
    });

    const res = await POST(req("POST"));
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(text).not.toContain(FAKE_URL);
    expect(text).not.toContain(FAKE_PASSWORD);
    const body = JSON.parse(text) as {
      success: boolean;
      error: { code: string; failed: Array<Record<string, unknown>> };
    };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("SCHEMA_INSTALL_FAILED");
    expect(body.error.failed).toEqual([{ migrationId: "core-0002", name: "users" }]);
  });

  it("a failed install logs the driver text server-side with URL and password redacted", async () => {
    bootstrapOryCMS.mockResolvedValue({
      install: {
        success: false,
        applied: [],
        skipped: [],
        failed: [{ migrationId: "core-0002", name: "users", error: `connect failed: ${FAKE_URL}` }],
      },
      seeded: false,
    });

    await POST(req("POST"));

    const logged = consoleError.mock.calls
      .map((c: unknown[]) => c.map(String).join(" "))
      .join("\n");
    expect(logged).toContain("core-0002");
    expect(logged).not.toContain(FAKE_URL);
    expect(logged).not.toContain(FAKE_PASSWORD);
  });

  it("a thrown driver error with a SQLSTATE code returns a generic 500, not its message", async () => {
    bootstrapOryCMS.mockRejectedValue(
      driverError(`password authentication failed for ${FAKE_URL}`),
    );

    const res = await POST(req("POST"));
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(text).not.toContain(FAKE_URL);
    expect(text).not.toContain(FAKE_PASSWORD);
  });
});
