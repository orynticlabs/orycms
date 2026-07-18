import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import { recordOryCMSAuditLog, listOryCMSAuditLogs } from "../audit.repo";

function makePool(queryImpl: (sql: string, params?: unknown[]) => unknown) {
  return { query: vi.fn(queryImpl) } as unknown as Pool;
}

describe("recordOryCMSAuditLog", () => {
  it("inserts a row with JSON metadata and null-coalesced fields", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await recordOryCMSAuditLog(
      { userId: "u1", action: "delete", resource: "users", resourceId: "u2", metadata: { reason: "x" } },
      pool,
    );
    const call = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain("INSERT INTO orycms_audit_logs");
    const params = call[1] as unknown[];
    expect(params[0]).toBe("u1");
    expect(params[1]).toBe("delete");
    expect(params[2]).toBe("users");
    expect(params[3]).toBe("u2");
    expect(params[4]).toBe(JSON.stringify({ reason: "x" }));
  });

  it("coalesces missing optional fields to null (anonymous action)", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await recordOryCMSAuditLog({ action: "forgot-password", resource: "auth" }, pool);
    const params = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0][1] as unknown[];
    expect(params[0]).toBeNull(); // userId
    expect(params[3]).toBeNull(); // resourceId
    expect(params[4]).toBeNull(); // metadata
  });
});

describe("listOryCMSAuditLogs", () => {
  it("applies filters and clamps the limit", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await listOryCMSAuditLogs({ userId: "u1", resource: "users", action: "delete", limit: 999 }, pool);
    const call = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0];
    const sql = call[0] as string;
    expect(sql).toContain('"userId" = $1');
    expect(sql).toContain("resource = $2");
    expect(sql).toContain("action = $3");
    const params = call[1] as unknown[];
    expect(params[params.length - 2]).toBe(200); // limit clamped to max 200
  });

  it("builds no WHERE clause when unfiltered", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await listOryCMSAuditLogs({}, pool);
    const sql = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(sql).not.toContain("WHERE");
  });
});
