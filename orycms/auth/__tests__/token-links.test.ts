import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { buildOryCMSTokenLink, oryAppOrigin, dispatchOryCMSTokenLink } from "../token-links";

function req(url = "https://cms.example.com/api/orycms/auth/invite"): NextRequest {
  return new NextRequest(url, { method: "POST" });
}

const ENV = "ORYCMS_APP_URL";
let saved: string | undefined;
beforeEach(() => {
  saved = process.env[ENV];
  delete process.env[ENV];
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

describe("dispatchOryCMSTokenLink (no provider → returns link)", () => {
  it("returns the link and emailed:false when email is unconfigured", async () => {
    // No ORYCMS_EMAIL_PROVIDER env, no config file loadable in this context →
    // sendOryCMSEmail is a no-op, so the link is surfaced for dev.
    const result = await dispatchOryCMSTokenLink(req(), "reset", "user@acme.io", "RAW");
    expect(result.emailed).toBe(false);
    expect(result.link).toBe("https://cms.example.com/reset-password?token=RAW");
  });
});
