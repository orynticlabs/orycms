import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// The setup route orchestrates: bootstrapOryCMS() -> createOryCMSInitialOwner().
// We mock both boundaries so the test verifies ordering + failure handling
// without a live database (matching the repo's mocked-dependency pattern).

const bootstrapOryCMS = vi.fn();
const createOryCMSInitialOwner = vi.fn();

vi.mock("@/core", () => ({
  bootstrapOryCMS: (...args: unknown[]) => bootstrapOryCMS(...args),
}));

vi.mock("@/lib/db", () => ({
  getOryCMSPool: () => ({ query: vi.fn() }),
}));

vi.mock("@/auth", () => ({
  createOryCMSInitialOwner: (...args: unknown[]) => createOryCMSInitialOwner(...args),
  // Preserve the real error class shape the route checks with `instanceof`.
  OryCMSAuthError: class OryCMSAuthError extends Error {
    code: string;
    statusCode: number;
    constructor(code: string, message: string, statusCode = 401) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
    }
  },
}));

// Import AFTER mocks are registered.
const { POST } = await import("../route");
const { OryCMSAuthError } = await import("@/auth");

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/orycms/auth/setup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  bootstrapOryCMS.mockReset();
  createOryCMSInitialOwner.mockReset();
});

describe("POST /api/orycms/auth/setup", () => {
  it("returns 422 when email or password is missing", async () => {
    const res = await POST(req({ email: "" }));
    expect(res.status).toBe(422);
    expect(bootstrapOryCMS).not.toHaveBeenCalled();
  });

  it("installs the schema BEFORE creating the Owner", async () => {
    const order: string[] = [];
    bootstrapOryCMS.mockImplementation(async () => {
      order.push("bootstrap");
      return { install: { success: true, applied: [], skipped: [], failed: [] }, seeded: true };
    });
    createOryCMSInitialOwner.mockImplementation(async () => {
      order.push("owner");
      return { id: "u1", email: "owner@acme.io", roleId: "r1", status: "active" };
    });

    const res = await POST(req({ email: "owner@acme.io", password: "supersecret" }));
    expect(res.status).toBe(201);
    // The whole point of the fix: tables exist before the Owner INSERT.
    expect(order).toEqual(["bootstrap", "owner"]);
    const body = await res.json();
    expect(body).toEqual({ success: true, data: { userId: "u1", email: "owner@acme.io" } });
  });

  it("does NOT auto-login (no session cookie set — user signs in on /login)", async () => {
    bootstrapOryCMS.mockResolvedValue({
      install: { success: true, applied: [], skipped: [], failed: [] },
      seeded: true,
    });
    createOryCMSInitialOwner.mockResolvedValue({
      id: "u1",
      email: "owner@acme.io",
      roleId: "r1",
      status: "active",
    });
    const res = await POST(req({ email: "owner@acme.io", password: "supersecret" }));
    expect(res.cookies.get("orycms_session")).toBeUndefined();
  });

  it("returns 500 and skips Owner creation when schema install fails", async () => {
    bootstrapOryCMS.mockResolvedValue({
      install: { success: false, applied: [], skipped: [], failed: [{ migrationId: "x", name: "x", error: "boom" }] },
      seeded: false,
    });
    const res = await POST(req({ email: "owner@acme.io", password: "supersecret" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("SCHEMA_INSTALL_FAILED");
    expect(createOryCMSInitialOwner).not.toHaveBeenCalled();
  });

  it("maps an OryCMSAuthError (e.g. SETUP_ALREADY_DONE) to its status code", async () => {
    bootstrapOryCMS.mockResolvedValue({
      install: { success: true, applied: [], skipped: [], failed: [] },
      seeded: true,
    });
    createOryCMSInitialOwner.mockRejectedValue(
      new OryCMSAuthError("SETUP_ALREADY_DONE", "An owner account already exists.", 409),
    );
    const res = await POST(req({ email: "owner@acme.io", password: "supersecret" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("SETUP_ALREADY_DONE");
  });
});
