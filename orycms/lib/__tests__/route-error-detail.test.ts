import { describe, it, expect, vi, afterEach } from "vitest";
import { toErrorResponse } from "../route-guards";
import { OryCMSAuthError } from "@/auth";
import { OryCMSPluginError } from "@/plugins/plugin.engine";
import { OryCMSManifestError } from "@/plugins/plugin.manifest";

// A fake connection string and password. They must never appear in any response body.
const FAKE_URL = "postgresql://svc_user:Hunter2-fake@db.internal.example:5432/orycms_prod";
const FAKE_PASSWORD = "Hunter2-fake";

/** A driver-style error: a string SQLSTATE `code` plus a message carrying connection detail. */
function driverError(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("toErrorResponse: driver errors", () => {
  it("returns a generic 500 for a driver error with a Postgres-style code, and never its message", async () => {
    const res = toErrorResponse(
      driverError(`password authentication failed for ${FAKE_URL}`, "28P01"),
    );
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(text).not.toContain(FAKE_URL);
    expect(text).not.toContain(FAKE_PASSWORD);
    expect(JSON.parse(text).error.code).toBe("INTERNAL_ERROR");
  });

  it("returns a generic 500 for a unique-violation driver error (23505), not a 400 with its message", async () => {
    const res = toErrorResponse(driverError(`duplicate key for ${FAKE_URL}`, "23505"));
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(text).not.toContain(FAKE_URL);
  });

  it("logs the driver detail server-side with the URL and password redacted", async () => {
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    toErrorResponse(driverError(`connect failed: ${FAKE_URL}`, "08006"));

    const logged = logSpy.mock.calls.map((c: unknown[]) => c.map(String).join(" ")).join("\n");
    expect(logged).toContain("[redacted-url]");
    expect(logged).not.toContain(FAKE_URL);
    expect(logged).not.toContain(FAKE_PASSWORD);
  });

  it("returns a generic 500 for a plain error that carries connection detail", async () => {
    const res = toErrorResponse(new Error(`ECONNREFUSED ${FAKE_URL}`));
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(text).not.toContain(FAKE_URL);
  });
});

describe("toErrorResponse: deliberate errors still pass through", () => {
  it("keeps the message and status of an OryCMSAuthError", async () => {
    const res = toErrorResponse(new OryCMSAuthError("FORBIDDEN", "nope", 403));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      success: false,
      error: { code: "FORBIDDEN", message: "nope" },
    });
  });

  it("keeps the message of a plugin error, defaulting to 400", async () => {
    const res = toErrorResponse(new OryCMSPluginError("INVALID_PLUGIN", "bad plugin"));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toEqual({ code: "INVALID_PLUGIN", message: "bad plugin" });
  });

  it("maps a plugin *_NOT_FOUND error to 404", async () => {
    const res = toErrorResponse(new OryCMSPluginError("PLUGIN_NOT_FOUND", "missing"));

    expect(res.status).toBe(404);
  });

  it("keeps the message of a manifest error, defaulting to 400", async () => {
    const res = toErrorResponse(
      new OryCMSManifestError("MANIFEST_INVALID", "name must be a string."),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toBe("name must be a string.");
  });

  it("does not pass through an arbitrary coded error that is not one of the deliberate classes", async () => {
    const res = toErrorResponse(Object.assign(new Error("bad plugin"), { code: "INVALID_PLUGIN" }));

    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("INTERNAL_ERROR");
  });
});
