import { describe, it, expect, vi, beforeEach } from "vitest";

// sendOryCMSEmail calls loadEmailConfigSafe() -> loadOryCMSConfig() when no
// emailConfig is injected. Mock @/config so we can force a load failure
// (a config file that exists but fails to parse/validate) without touching
// the filesystem.
const loadOryCMSConfig = vi.fn();
vi.mock("@/config", () => ({
  loadOryCMSConfig: (...args: unknown[]) => loadOryCMSConfig(...args),
}));

const { sendOryCMSEmail, isOryCMSEmailConfigured } = await import("../email.service");

beforeEach(() => {
  loadOryCMSConfig.mockReset();
});

describe("sendOryCMSEmail / loadEmailConfigSafe — config-load failure is logged, not silent", () => {
  it("config load throws: logs a clear server-side error (no secrets), falls back to unconfigured (sent:false)", async () => {
    loadOryCMSConfig.mockRejectedValue(new Error("orycms.config.ts: SyntaxError at line 4"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await sendOryCMSEmail({ to: "a@b.com", subject: "s", text: "t" });
    expect(result).toEqual({ sent: false, provider: null });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = errorSpy.mock.calls[0].join(" ");
    expect(logged).toContain("orycms.config.ts: SyntaxError at line 4");
    expect(logged.toLowerCase()).toContain("orycms.config.ts");

    errorSpy.mockRestore();
  });

  it("isOryCMSEmailConfigured also logs on a config load failure and reports false", async () => {
    loadOryCMSConfig.mockRejectedValue(new Error("boom"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await isOryCMSEmailConfigured();
    expect(result).toBe(false);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });

  it("an explicitly injected emailConfig bypasses loadOryCMSConfig entirely (no log)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await sendOryCMSEmail({ to: "a@b.com", subject: "s", text: "t" }, {});
    expect(result).toEqual({ sent: false, provider: null });
    expect(loadOryCMSConfig).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
