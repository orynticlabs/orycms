import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Lets individual tests force sendOryCMSEmail to throw (a configured-but-down
// provider), without needing a real email provider configured anywhere else.
const sendOryCMSEmail = vi.fn();
vi.mock("@/email", () => ({
  sendOryCMSEmail: (...args: unknown[]) => sendOryCMSEmail(...args),
}));

const { buildOryCMSTokenLink, oryAppOrigin, dispatchOryCMSTokenLink } =
  await import("../token-links");

// Uses the Web platform Request (no next/server) — matches the framework-agnostic
// token-links implementation.
function req(url = "https://cms.example.com/api/orycms/auth/invite"): Request {
  return new Request(url, { method: "POST" });
}

const ENV = "ORYCMS_APP_URL";
let saved: string | undefined;
beforeEach(() => {
  saved = process.env[ENV];
  delete process.env[ENV];
  sendOryCMSEmail.mockReset();
  sendOryCMSEmail.mockResolvedValue({ sent: false, provider: null });
});
afterEach(() => {
  if (saved === undefined) delete process.env[ENV];
  else process.env[ENV] = saved;
});

describe("oryAppOrigin", () => {
  it("uses the request origin by default", () => {
    expect(oryAppOrigin(req())).toBe("https://cms.example.com");
  });

  it("prefers ORYCMS_APP_URL when set and strips a trailing slash", () => {
    process.env[ENV] = "https://admin.acme.io/";
    expect(oryAppOrigin(req())).toBe("https://admin.acme.io");
  });
});

describe("buildOryCMSTokenLink", () => {
  it("maps each token type to its frontend page with the raw token", () => {
    expect(buildOryCMSTokenLink(req(), "invite", "TT")).toBe(
      "https://cms.example.com/accept-invite?token=TT",
    );
    expect(buildOryCMSTokenLink(req(), "activation", "TT")).toBe(
      "https://cms.example.com/activate?token=TT",
    );
    expect(buildOryCMSTokenLink(req(), "reset", "TT")).toBe(
      "https://cms.example.com/reset-password?token=TT",
    );
  });
});

describe("dispatchOryCMSTokenLink", () => {
  const NODE_ENV = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = NODE_ENV;
  });

  it("never returns the link — the result has no link/token field at all", async () => {
    const result = await dispatchOryCMSTokenLink(req(), "reset", "user@acme.io", "RAW");
    expect(result).toEqual({ emailed: false });
    expect(JSON.stringify(result)).not.toContain("RAW");
  });

  it("no provider, non-production: prints the link to the console with a development-only marker", async () => {
    process.env.NODE_ENV = "development";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await dispatchOryCMSTokenLink(req(), "reset", "user@acme.io", "RAW");
    expect(result).toEqual({ emailed: false });
    const logged = logSpy.mock.calls.flat().join(" ");
    expect(logged).toContain("https://cms.example.com/reset-password?token=RAW");
    expect(logged.toLowerCase()).toContain("development");
    logSpy.mockRestore();
  });

  it("no provider, production: does not print or return the link, only a warning", async () => {
    process.env.NODE_ENV = "production";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await dispatchOryCMSTokenLink(req(), "reset", "user@acme.io", "RAW");
    expect(result).toEqual({ emailed: false });
    const allLogged = [...warnSpy.mock.calls, ...logSpy.mock.calls].flat().join(" ");
    expect(allLogged).not.toContain("RAW");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("provider configured but send() throws: logs the error message only (never the link or token), returns no link", async () => {
    sendOryCMSEmail.mockRejectedValue(new Error("provider outage: connection refused"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await dispatchOryCMSTokenLink(req(), "reset", "user@acme.io", "RAW-TOKEN");
    expect(result).toEqual({ emailed: false });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const errorArgs = errorSpy.mock.calls[0].join(" ");
    expect(errorArgs).toContain("provider outage: connection refused");
    expect(errorArgs).not.toContain("RAW-TOKEN");
    expect(errorArgs).not.toContain("reset-password?token=");

    const allLogged = [...errorSpy.mock.calls, ...logSpy.mock.calls].flat().join(" ");
    expect(allLogged).not.toContain("RAW-TOKEN");

    errorSpy.mockRestore();
    logSpy.mockRestore();
  });
});
