import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const guardOryCMS = vi.fn();
vi.mock("@/lib/route-guards", async () => {
  const actual = await vi.importActual<typeof import("@/lib/route-guards")>("@/lib/route-guards");
  return {
    ...actual,
    guardOryCMS: (...args: unknown[]) => guardOryCMS(...args),
  };
});

const createOryCMSUser = vi.fn();
vi.mock("@/users", () => ({
  createOryCMSUser: (...args: unknown[]) => createOryCMSUser(...args),
}));

const createOryCMSToken = vi.fn();
vi.mock("@/tokens", () => ({
  createOryCMSToken: (...args: unknown[]) => createOryCMSToken(...args),
}));

const recordOryCMSAuditLog = vi.fn();
vi.mock("@/audit", () => ({
  recordOryCMSAuditLog: (...args: unknown[]) => recordOryCMSAuditLog(...args),
}));

const sendOryCMSEmail = vi.fn();
vi.mock("@/email", () => ({
  sendOryCMSEmail: (...args: unknown[]) => sendOryCMSEmail(...args),
}));

const { POST } = await import("../route");

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/orycms/auth/invite", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const RAW_TOKEN = "RAWINVITETOKEN1234567890";

beforeEach(() => {
  guardOryCMS.mockReset().mockResolvedValue({ userId: "inviter1", email: "owner@acme.io" });
  createOryCMSUser
    .mockReset()
    .mockResolvedValue({ id: "newuser1", email: "invitee@acme.io", status: "pending" });
  createOryCMSToken.mockReset().mockResolvedValue(RAW_TOKEN);
  recordOryCMSAuditLog.mockReset().mockResolvedValue(undefined);
  sendOryCMSEmail.mockReset().mockResolvedValue({ sent: false, provider: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/orycms/auth/invite", () => {
  it("invite (admin) never returns the link, in any environment", async () => {
    const res = await POST(req({ email: "invitee@acme.io" }));
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      success: boolean;
      data: { userId: string; email: string; emailed: boolean };
    };
    expect(body.success).toBe(true);
    expect(body.data).toEqual({
      userId: "newuser1",
      email: "invitee@acme.io",
      emailed: false,
    });
    expect(body.data).not.toHaveProperty("inviteLink");
    expect(JSON.stringify(body)).not.toMatch(/link/i);
    expect(JSON.stringify(body)).not.toContain(RAW_TOKEN);
  });

  it("no provider, NODE_ENV=development: link printed to console marked development-only, never in the response", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const res = await POST(req({ email: "invitee@acme.io" }));
    const bodyText = JSON.stringify(await res.json());
    expect(bodyText).not.toContain(RAW_TOKEN);

    const logged = logSpy.mock.calls.flat().join(" ");
    expect(logged).toContain(RAW_TOKEN);
    expect(logged.toLowerCase()).toContain("development");
    logSpy.mockRestore();
  });

  it("no provider, NODE_ENV=production: nothing printed or returned", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await POST(req({ email: "invitee@acme.io" }));
    const bodyText = JSON.stringify(await res.json());
    expect(bodyText).not.toContain(RAW_TOKEN);

    const logged = [...logSpy.mock.calls, ...warnSpy.mock.calls].flat().join(" ");
    expect(logged).not.toContain(RAW_TOKEN);

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("provider configured and send() throws: no link in the response, error logged (message only)", async () => {
    sendOryCMSEmail.mockRejectedValue(new Error("provider outage"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(req({ email: "invitee@acme.io" }));
    expect(res.status).toBe(201);
    const bodyText = JSON.stringify(await res.json());
    expect(bodyText).not.toContain(RAW_TOKEN);
    expect(bodyText).not.toMatch(/link/i);

    errorSpy.mockRestore();
  });
});
