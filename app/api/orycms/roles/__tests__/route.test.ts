import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Root route test for the shared error mapper, through the roles list route.
// Auth, RBAC and the pool are mocked; no database is touched.

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
  clearOryCMSPermissionCache: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getOryCMSPool: () => fakePool,
}));

const { GET } = await import("../route");

const FAKE_URL = "postgresql://svc_user:Hunter2-fake@db.internal.example:5432/orycms_prod";
const FAKE_PASSWORD = "Hunter2-fake";

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
});

describe("GET /api/orycms/roles (root, shared error mapper)", () => {
  it("returns 401 without a session", async () => {
    protectOryCMSAdminRoute.mockRejectedValue(
      new OryCMSAuthError("UNAUTHORIZED", "Authentication required."),
    );

    const res = await GET(new NextRequest("http://localhost/api/orycms/roles"));

    expect(res.status).toBe(401);
  });

  it("a driver error with a SQLSTATE code never reaches the response body", async () => {
    fakeQuery.mockRejectedValue(
      Object.assign(new Error(`password authentication failed for ${FAKE_URL}`), { code: "28P01" }),
    );

    const res = await GET(new NextRequest("http://localhost/api/orycms/roles"));
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(text).not.toContain(FAKE_URL);
    expect(text).not.toContain(FAKE_PASSWORD);
    expect(text).toContain('"INTERNAL_ERROR"');
  });
});
