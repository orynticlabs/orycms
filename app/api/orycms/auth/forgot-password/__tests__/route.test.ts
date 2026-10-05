import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock every boundary this route touches except the dispatch/link logic itself
// (@/auth/token-links), which is the code under test for P0-16 — we want the
// real dispatchOryCMSTokenLink running against a mocked sendOryCMSEmail.
const findOryCMSUserByEmail = vi.fn();
vi.mock("@/users", () => ({
  findOryCMSUserByEmail: (...args: unknown[]) => findOryCMSUserByEmail(...args),
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

vi.mock("@/lib/db", () => ({
  getOryCMSPool: () => ({}),
}));

const { POST } = await import("../route");

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/orycms/auth/forgot-password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const RAW_TOKEN = "RAWTOKEN1234567890";

beforeEach(() => {
  findOryCMSUserByEmail.mockReset();
  createOryCMSToken.mockReset().mockResolvedValue(RAW_TOKEN);
  recordOryCMSAuditLog.mockReset().mockResolvedValue(undefined);
  sendOryCMSEmail.mockReset().mockResolvedValue({ sent: false, provider: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const GENERIC_BODY = {
  success: true,
  data: { message: "If an account exists for that email, a reset link has been sent." },
};

describe("POST /api/orycms/auth/forgot-password", () => {
  it("unknown email: 200, generic body, no link/token key anywhere", async () => {
    findOryCMSUserByEmail.mockResolvedValue(null);
    const res = await POST(req({ email: "ghost@acme.io" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(GENERIC_BODY);
  });

  it("known vs unknown email: identical response bodies and status", async () => {
    findOryCMSUserByEmail.mockResolvedValue({ id: "u1", email: "owner@acme.io" });
    const resKnown = await POST(req({ email: "owner@acme.io" }));
    const bodyKnown = await resKnown.json();

    findOryCMSUserByEmail.mockResolvedValue(null);
    const resUnknown = await POST(req({ email: "ghost@acme.io" }));
    const bodyUnknown = await resUnknown.json();

    expect(resKnown.status).toBe(resUnknown.status);
    expect(bodyKnown).toEqual(bodyUnknown);
    expect(bodyKnown).toEqual(GENERIC_BODY);
  });

  it("provider configured and send() throws: response contains no link or token anywhere (whole body checked)", async () => {
    findOryCMSUserByEmail.mockResolvedValue({ id: "u1", email: "owner@acme.io" });
    sendOryCMSEmail.mockRejectedValue(new Error("provider outage"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(req({ email: "owner@acme.io" }));
    expect(res.status).toBe(200);
    const bodyText = JSON.stringify(await res.json());
    expect(bodyText).not.toContain(RAW_TOKEN);
    expect(bodyText).toBe(JSON.stringify(GENERIC_BODY));

    errorSpy.mockRestore();
  });

  it("no provider, NODE_ENV=production: no link in the response", async () => {
    vi.stubEnv("NODE_ENV", "production");
    findOryCMSUserByEmail.mockResolvedValue({ id: "u1", email: "owner@acme.io" });
    const res = await POST(req({ email: "owner@acme.io" }));
    const bodyText = JSON.stringify(await res.json());
    expect(bodyText).not.toContain(RAW_TOKEN);
    expect(bodyText).toBe(JSON.stringify(GENERIC_BODY));
  });

  it("no provider, NODE_ENV=development: no link in the response, link printed to the console marked development-only", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    findOryCMSUserByEmail.mockResolvedValue({ id: "u1", email: "owner@acme.io" });

    const res = await POST(req({ email: "owner@acme.io" }));
    const bodyText = JSON.stringify(await res.json());
    expect(bodyText).not.toContain(RAW_TOKEN);
    expect(bodyText).toBe(JSON.stringify(GENERIC_BODY));

    const logged = logSpy.mock.calls.flat().join(" ");
    expect(logged).toContain(RAW_TOKEN);
    expect(logged.toLowerCase()).toContain("development");
    logSpy.mockRestore();
  });

  it("the token/link never appears in any console call in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    findOryCMSUserByEmail.mockResolvedValue({ id: "u1", email: "owner@acme.io" });

    await POST(req({ email: "owner@acme.io" }));

    const logged = [...logSpy.mock.calls, ...errorSpy.mock.calls, ...warnSpy.mock.calls]
      .flat()
      .join(" ");
    expect(logged).not.toContain(RAW_TOKEN);

    logSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("config load failure (via sendOryCMSEmail's config boundary) during send() still never leaks the token", async () => {
    // Simulates a broken orycms.config.ts: sendOryCMSEmail's real implementation
    // would catch this itself and return {sent:false}; here we exercise the
    // route's complete lack of a link/token in the response regardless of why
    // sendOryCMSEmail resolved to "not sent".
    findOryCMSUserByEmail.mockResolvedValue({ id: "u1", email: "owner@acme.io" });
    sendOryCMSEmail.mockResolvedValue({ sent: false, provider: null });
    const res = await POST(req({ email: "owner@acme.io" }));
    const bodyText = JSON.stringify(await res.json());
    expect(bodyText).not.toContain(RAW_TOKEN);
  });
});
