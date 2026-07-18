import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import { getAllOryCMSSettings, getOryCMSSetting, setOryCMSSetting } from "../settings.repo";

function makePool(queryImpl: (sql: string, params?: unknown[]) => unknown) {
  return { query: vi.fn(queryImpl) } as unknown as Pool;
}

describe("getAllOryCMSSettings", () => {
  it("returns all rows", async () => {
    const rows = [{ key: "siteName", value: "OryCMS", description: null }];
    const pool = makePool(() => ({ rows }));
    expect(await getAllOryCMSSettings(pool)).toEqual(rows);
  });
});

describe("getOryCMSSetting", () => {
  it("returns the row when present", async () => {
    const pool = makePool(() => ({ rows: [{ key: "k", value: 1, description: null }] }));
    expect((await getOryCMSSetting("k", pool))?.value).toBe(1);
  });

  it("returns null when absent", async () => {
    const pool = makePool(() => ({ rows: [] }));
    expect(await getOryCMSSetting("nope", pool)).toBeNull();
  });
});

describe("setOryCMSSetting", () => {
  it("upserts with JSON-encoded value", async () => {
    const pool = makePool(() => ({ rows: [{ key: "k", value: { a: 1 }, description: null }] }));
    await setOryCMSSetting("k", { a: 1 }, null, pool);
    const call = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain("ON CONFLICT (key) DO UPDATE");
    expect((call[1] as unknown[])[1]).toBe(JSON.stringify({ a: 1 }));
  });
});
