import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createSmtpProvider, resolveOryCMSSmtpConfig } from "../providers";
import { OryCMSEmailConfigError } from "../email.types";

// The SMTP provider lazy-loads nodemailer via a dynamic import — mock it so no
// real package/network/credentials are ever involved in these tests.
const sendMail = vi.fn();
const verify = vi.fn();
const createTransport = vi.fn((_cfg: unknown) => ({ sendMail, verify }));

vi.mock("nodemailer", () => ({
  createTransport: (cfg: unknown) => createTransport(cfg),
}));

const ENV_KEYS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM",
];
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  createTransport.mockClear();
  sendMail.mockReset().mockResolvedValue(undefined);
  verify.mockReset().mockResolvedValue(true);
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

// ── resolveOryCMSSmtpConfig ──────────────────────────────────────────────────────

describe("resolveOryCMSSmtpConfig", () => {
  it("builds config from SMTP_* env vars, defaulting port 587 and secure false", () => {
    process.env.SMTP_HOST = "smtp.example.com";
    const cfg = resolveOryCMSSmtpConfig("Default <d@e.co>", {});
    expect(cfg).toEqual({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      user: undefined,
      password: undefined,
      from: "Default <d@e.co>",
    });
  });

  it("config.options override env vars for every field", () => {
    process.env.SMTP_HOST = "env-host";
    process.env.SMTP_FROM = "Env <env@e.co>";
    const cfg = resolveOryCMSSmtpConfig("Default <d@e.co>", {
      host: "opt-host",
      port: 2525,
      from: "Opt <opt@e.co>",
      user: "opt-user",
      password: "opt-pass",
    });
    expect(cfg).toEqual({
      host: "opt-host",
      port: 2525,
      secure: false,
      user: "opt-user",
      password: "opt-pass",
      from: "Opt <opt@e.co>",
    });
  });

  it("port 465 defaults secure to true (implicit TLS)", () => {
    const cfg = resolveOryCMSSmtpConfig("D <d@e.co>", { host: "h", port: 465 });
    expect(cfg.secure).toBe(true);
  });

  it("port 587 defaults secure to false (STARTTLS, not implicit TLS)", () => {
    const cfg = resolveOryCMSSmtpConfig("D <d@e.co>", { host: "h", port: 587 });
    expect(cfg.secure).toBe(false);
  });

  it("SMTP_SECURE (or options.secure) explicitly overrides the port-based default", () => {
    expect(
      resolveOryCMSSmtpConfig("D <d@e.co>", { host: "h", port: 587, secure: true }).secure,
    ).toBe(true);
    expect(
      resolveOryCMSSmtpConfig("D <d@e.co>", { host: "h", port: 465, secure: false }).secure,
    ).toBe(false);
    process.env.SMTP_SECURE = "true";
    expect(resolveOryCMSSmtpConfig("D <d@e.co>", { host: "h", port: 587 }).secure).toBe(true);
  });

  it("missing host throws a typed OryCMSEmailConfigError", () => {
    expect(() => resolveOryCMSSmtpConfig("D <d@e.co>", {})).toThrow(OryCMSEmailConfigError);
    expect(() => resolveOryCMSSmtpConfig("D <d@e.co>", {})).toThrow(/host/i);
  });

  it('missing "from" (no config default, no SMTP_FROM) throws a typed OryCMSEmailConfigError', () => {
    expect(() => resolveOryCMSSmtpConfig("", { host: "h" })).toThrow(OryCMSEmailConfigError);
    expect(() => resolveOryCMSSmtpConfig("", { host: "h" })).toThrow(/from/i);
  });

  it("an invalid port (out of range or non-numeric) throws a typed OryCMSEmailConfigError", () => {
    expect(() => resolveOryCMSSmtpConfig("D <d@e.co>", { host: "h", port: 0 })).toThrow(
      OryCMSEmailConfigError,
    );
    expect(() => resolveOryCMSSmtpConfig("D <d@e.co>", { host: "h", port: 70000 })).toThrow(
      OryCMSEmailConfigError,
    );
    expect(() =>
      resolveOryCMSSmtpConfig("D <d@e.co>", { host: "h", port: "not-a-number" }),
    ).toThrow(OryCMSEmailConfigError);
  });
});

// ── createSmtpProvider ───────────────────────────────────────────────────────────

describe("createSmtpProvider", () => {
  it("builds the transport with the resolved host/port/secure/auth", async () => {
    const provider = createSmtpProvider("Default <d@e.co>", {
      host: "smtp.acme.io",
      port: 465,
      user: "u",
      password: "s3cr3t",
    });
    await provider.send({ to: "a@b.co", subject: "hi", text: "yo" });
    expect(createTransport).toHaveBeenCalledWith({
      host: "smtp.acme.io",
      port: 465,
      secure: true,
      auth: { user: "u", pass: "s3cr3t" },
    });
  });

  it("omits auth entirely when no user is configured (anonymous relay)", async () => {
    const provider = createSmtpProvider("D <d@e.co>", { host: "h" });
    await provider.send({ to: "a@b.co", subject: "s", text: "t" });
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ auth: undefined }));
  });

  it("sendMail is called with the correct from/to/subject/text", async () => {
    const provider = createSmtpProvider("Default <d@e.co>", { host: "h" });
    await provider.send({ to: "a@b.co", subject: "Reset", text: "body" });
    expect(sendMail).toHaveBeenCalledWith({
      from: "Default <d@e.co>",
      to: "a@b.co",
      subject: "Reset",
      text: "body",
      html: undefined,
    });
  });

  it("a per-message `from` override wins over the configured default", async () => {
    const provider = createSmtpProvider("Default <d@e.co>", { host: "h" });
    await provider.send({ to: "a@b.co", subject: "s", text: "t", from: "Override <o@e.co>" });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: "Override <o@e.co>" }));
  });

  it("verify() checks the connection without calling sendMail", async () => {
    const provider = createSmtpProvider("D <d@e.co>", { host: "h" });
    await provider.verify!();
    expect(verify).toHaveBeenCalledTimes(1);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("construction throws immediately (eagerly) for a missing host — before send/verify is ever called", () => {
    expect(() => createSmtpProvider("D <d@e.co>", {})).toThrow(OryCMSEmailConfigError);
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("a transport error from sendMail is rethrown with the password redacted from its message", async () => {
    sendMail.mockRejectedValue(new Error("535 auth failed for user with password s3cr3t-pw"));
    const provider = createSmtpProvider("D <d@e.co>", {
      host: "h",
      user: "u",
      password: "s3cr3t-pw",
    });
    let caught: Error | undefined;
    try {
      await provider.send({ to: "a@b.co", subject: "s", text: "t" });
    } catch (err) {
      caught = err as Error;
    }
    expect(caught).toBeDefined();
    expect(caught!.message).not.toContain("s3cr3t-pw");
    expect(caught!.message).toContain("[REDACTED]");
  });

  it("a transport error from verify() is also sanitized", async () => {
    verify.mockRejectedValue(new Error("connection refused, password=hunter2"));
    const provider = createSmtpProvider("D <d@e.co>", { host: "h", password: "hunter2" });
    let caught: Error | undefined;
    try {
      await provider.verify!();
    } catch (err) {
      caught = err as Error;
    }
    expect(caught).toBeDefined();
    expect(caught!.message).not.toContain("hunter2");
  });

  it("the SMTP password never appears in a console.log/console.error call during a failed send", async () => {
    sendMail.mockRejectedValue(new Error("auth failed, password rejected: topsecret99"));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const provider = createSmtpProvider("D <d@e.co>", { host: "h", password: "topsecret99" });

    await provider.send({ to: "a@b.co", subject: "s", text: "t" }).catch(() => {});

    const logged = [...logSpy.mock.calls, ...errorSpy.mock.calls].flat().join(" ");
    expect(logged).not.toContain("topsecret99");
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("no password configured: a transport error passes through unmodified (nothing to redact)", async () => {
    sendMail.mockRejectedValue(new Error("connection timed out"));
    const provider = createSmtpProvider("D <d@e.co>", { host: "h" });
    await expect(provider.send({ to: "a@b.co", subject: "s", text: "t" })).rejects.toThrow(
      "connection timed out",
    );
  });
});
