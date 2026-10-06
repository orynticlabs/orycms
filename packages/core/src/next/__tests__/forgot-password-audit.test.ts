import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OryCMSRoute } from "../dispatcher";

// Unknown accounts: the audit row records the attempt without the requested email.

const fakeQuery = vi.fn();
const fakePool = { query: (...args: unknown[]) => fakeQuery(...args) };

vi.mock("@/lib/db", () => ({
  getOryCMSPool: () => fakePool,
}));

vi.mock("@/email", () => ({
  sendOryCMSEmail: vi.fn(async () => ({ sent: true })),
}));

// Import AFTER mocks are registered.
const { authTokenRoutes } = await import("../routes/auth-tokens");

const forgotRoute = authTokenRoutes.find(
  (r) => r.method === "POST" && r.pattern === "auth/forgot-password",
) as OryCMSRoute;
if (!forgotRoute) throw new Error("forgot-password route not found");

const REQUESTED_EMAIL = "Nobody.Here@Example.test";

function call(email: string) {
  const request = new Request("http://localhost/api/orycms/auth/forgot-password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return forgotRoute.handler({ request, params: {}, url: new URL(request.url) });
}

beforeEach(() => {
  fakeQuery.mockReset();
  // No account matches the requested email.
  fakeQuery.mockImplementation(async (sql: string) => {
    if (sql.includes("FROM orycms_users")) return { rows: [] };
    return { rows: [] };
  });
});

describe("forgot-password audit row for an unknown account (packages/core)", () => {
  it("returns the same generic body for an unknown account", async () => {
    const res = await call(REQUESTED_EMAIL);

    expect(res.status).toBe(200);
    expect(await res.text()).toContain("If an account exists");
  });

  it("writes an audit row that does not store the requested email", async () => {
    await call(REQUESTED_EMAIL);

    const audit = fakeQuery.mock.calls.find((c) => String(c[0]).includes("orycms_audit_logs"));
    expect(audit).toBeDefined();
    const params = JSON.stringify(audit?.[1] ?? []);
    expect(params.toLowerCase()).not.toContain("nobody.here");
    expect(params).not.toContain("@example.test");
  });

  it("still records that the attempt was for an unknown account", async () => {
    await call(REQUESTED_EMAIL);

    const audit = fakeQuery.mock.calls.find((c) => String(c[0]).includes("orycms_audit_logs"));
    const params = audit?.[1] as unknown[];
    expect(params[1]).toBe("forgot-password");
    expect(params[2]).toBe("auth");
    expect(JSON.stringify(params)).toContain("found");
  });
});
