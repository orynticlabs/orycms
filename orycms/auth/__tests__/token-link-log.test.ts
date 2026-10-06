import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";

// A failed email send is logged server-side. The log line must not carry a URL or a
// password value from the provider's error message.

const sendOryCMSEmail = vi.fn();
vi.mock("@/email", () => ({
  sendOryCMSEmail: (...args: unknown[]) => sendOryCMSEmail(...args),
}));

const { dispatchOryCMSTokenLink } = await import("../token-links");

const FAKE_SMTP_URL = "smtp://mailer:Hunter2-fake@smtp.internal.example:587";
const FAKE_PASSWORD = "Hunter2-fake";

afterEach(() => {
  vi.restoreAllMocks();
  sendOryCMSEmail.mockReset();
});

describe("token-link email failure log (root)", () => {
  it("logs the provider error with the URL and password value redacted", async () => {
    sendOryCMSEmail.mockRejectedValue(
      new Error(`SMTP connect failed for ${FAKE_SMTP_URL} password=${FAKE_PASSWORD}`),
    );
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await dispatchOryCMSTokenLink(
      new NextRequest("http://localhost/api/orycms/auth/forgot-password"),
      "reset",
      "person@example.test",
      "raw-token-value",
    );

    expect(result).toEqual({ emailed: false });
    const logged = logSpy.mock.calls.map((c: unknown[]) => c.map(String).join(" ")).join("\n");
    expect(logged).toContain("[redacted-url]");
    expect(logged).not.toContain(FAKE_SMTP_URL);
    expect(logged).not.toContain(FAKE_PASSWORD);
  });
});
