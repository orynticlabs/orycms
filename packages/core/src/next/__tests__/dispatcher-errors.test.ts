import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The dispatcher's own catch-all: a handler that throws must produce the generic
// response and a redacted server-side log entry, never the raw error.

const FAKE_URL = "postgresql://svc_user:Hunter2-fake@db.internal.example:5432/orycms_prod";
const FAKE_PASSWORD = "Hunter2-fake";

vi.mock("../routes", () => ({
  ORYCMS_ROUTES: [
    {
      method: "GET",
      pattern: "boom",
      handler: async () => {
        throw Object.assign(
          new Error(
            `password authentication failed for ${"postgresql://svc_user:Hunter2-fake@db.internal.example:5432/orycms_prod"}`,
          ),
          {
            code: "28P01",
          },
        );
      },
    },
    {
      method: "GET",
      pattern: "boom-plain",
      handler: async () => {
        throw new Error(
          `ECONNREFUSED ${"postgresql://svc_user:Hunter2-fake@db.internal.example:5432/orycms_prod"}`,
        );
      },
    },
  ],
}));

const { createOryCMSRouteHandlers } = await import("../dispatcher");

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("dispatcher catch-all", () => {
  const { GET } = createOryCMSRouteHandlers();

  it("returns a generic 500 for a driver error and never its message", async () => {
    const res = await GET(new Request("http://localhost/api/orycms/boom"));
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(text).not.toContain(FAKE_URL);
    expect(text).not.toContain(FAKE_PASSWORD);
    expect(JSON.parse(text).error.code).toBe("INTERNAL_ERROR");
  });

  it("returns a generic 500 for a plain error that carries connection detail", async () => {
    const res = await GET(new Request("http://localhost/api/orycms/boom-plain"));
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(text).not.toContain(FAKE_URL);
  });

  it("logs the thrown detail server-side with the URL and password redacted", async () => {
    await GET(new Request("http://localhost/api/orycms/boom"));

    const logged = consoleError.mock.calls
      .map((c: unknown[]) => c.map(String).join(" "))
      .join("\n");
    expect(logged).toContain("[redacted-url]");
    expect(logged).not.toContain(FAKE_URL);
    expect(logged).not.toContain(FAKE_PASSWORD);
  });
});
