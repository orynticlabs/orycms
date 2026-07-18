import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getOryCMSEmailProvider, resolveOryCMSEmailConfig } from "../email.factory";
import { sendOryCMSEmail, isOryCMSEmailConfigured } from "../email.service";

// Save/restore env so tests don't leak provider config into each other.
const ENV_KEYS = ["ORYCMS_EMAIL_PROVIDER", "ORYCMS_EMAIL_FROM"];
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

// ── resolveOryCMSEmailConfig ────────────────────────────────────────────────────

describe("resolveOryCMSEmailConfig", () => {
  it("returns null when nothing is configured (dev/link mode)", () => {
    expect(resolveOryCMSEmailConfig(undefined)).toBeNull();
    expect(resolveOryCMSEmailConfig({})).toBeNull();
  });

  it("uses the config block provider + from", () => {
    const resolved = resolveOryCMSEmailConfig({ provider: "resend", from: "A <a@b.co>" });
    expect(resolved).toEqual({ provider: "resend", from: "A <a@b.co>", options: {} });
  });

  it("env ORYCMS_EMAIL_PROVIDER overrides the config block", () => {
    process.env.ORYCMS_EMAIL_PROVIDER = "postmark";
    const resolved = resolveOryCMSEmailConfig({ provider: "resend" });
    expect(resolved?.provider).toBe("postmark");
  });

  it("ignores an unknown env provider and falls back to config", () => {
    process.env.ORYCMS_EMAIL_PROVIDER = "pigeon";
    const resolved = resolveOryCMSEmailConfig({ provider: "smtp" });
    expect(resolved?.provider).toBe("smtp");
  });

  it("env ORYCMS_EMAIL_FROM overrides the config from", () => {
    process.env.ORYCMS_EMAIL_FROM = "Env <env@b.co>";
    const resolved = resolveOryCMSEmailConfig({ provider: "resend", from: "Cfg <cfg@b.co>" });
    expect(resolved?.from).toBe("Env <env@b.co>");
  });
});

// ── getOryCMSEmailProvider ──────────────────────────────────────────────────────

describe("getOryCMSEmailProvider", () => {
  it("returns null when unconfigured", () => {
    expect(getOryCMSEmailProvider({})).toBeNull();
  });

  it("returns a named provider for each known id", () => {
    for (const provider of ["resend", "smtp", "sendgrid", "ses", "mailgun", "postmark"] as const) {
      const p = getOryCMSEmailProvider({ provider });
      expect(p?.name).toBe(provider);
    }
  });

  it("custom provider uses the supplied send function", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const p = getOryCMSEmailProvider({ provider: "custom", options: { send } });
    expect(p?.name).toBe("custom");
    await p!.send({ to: "a@b.co", subject: "hi", text: "yo" });
    expect(send).toHaveBeenCalledOnce();
  });

  it("custom provider without a send function throws", () => {
    expect(() => getOryCMSEmailProvider({ provider: "custom", options: {} })).toThrow();
  });
});

// ── sendOryCMSEmail (link fallback) ─────────────────────────────────────────────

describe("sendOryCMSEmail", () => {
  it("is a no-op returning sent:false when no provider is configured", async () => {
    const result = await sendOryCMSEmail(
      { to: "a@b.co", subject: "Reset", text: "link" },
      {}, // explicit empty config → no provider
    );
    expect(result).toEqual({ sent: false, provider: null });
  });

  it("sends through a custom provider and returns sent:true", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const result = await sendOryCMSEmail(
      { to: "a@b.co", subject: "Invite", text: "link" },
      { provider: "custom", options: { send } },
    );
    expect(result).toEqual({ sent: true, provider: "custom" });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "a@b.co", subject: "Invite" }),
    );
  });
});

describe("isOryCMSEmailConfigured", () => {
  it("false when unconfigured, true with a provider", async () => {
    expect(await isOryCMSEmailConfigured({})).toBe(false);
    expect(await isOryCMSEmailConfigured({ provider: "custom", options: { send: vi.fn() } })).toBe(true);
  });
});
