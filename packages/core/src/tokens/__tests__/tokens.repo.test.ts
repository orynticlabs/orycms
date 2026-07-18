import { describe, it, expect, vi } from "vitest";
import crypto from "crypto";
import type { Pool } from "pg";
import { createOryCMSToken, consumeOryCMSToken } from "../tokens.repo";

function makePool(queryImpl: (sql: string, params?: unknown[]) => unknown) {
  return { query: vi.fn(queryImpl) } as unknown as Pool;
}

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

describe("createOryCMSToken", () => {
  it("returns a 64-char hex raw token and stores only its hash", async () => {
    let storedHash = "";
    const pool = makePool((sql, params) => {
      if (sql.includes("INSERT INTO orycms_tokens")) {
        storedHash = (params as unknown[])[2] as string;
      }
      return { rows: [] };
    });
    const raw = await createOryCMSToken({ type: "invite", email: "New@B.co", userId: "u1" }, pool);
    expect(raw).toMatch(/^[0-9a-f]{64}$/);
    expect(storedHash).toBe(sha256(raw)); // hash stored, not raw
    expect(storedHash).not.toBe(raw);
  });

  it("normalizes the email and passes the type through", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await createOryCMSToken({ type: "reset", email: "  MiXeD@Case.CO " }, pool);
    const params = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0][1] as unknown[];
    expect(params[1]).toBe("reset"); // type
    expect(params[3]).toBe("mixed@case.co"); // normalized email
  });

  it("serializes metadata as JSON", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await createOryCMSToken({ type: "invite", email: "a@b.co", metadata: { roleId: "r1" } }, pool);
    const params = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0][1] as unknown[];
    expect(params[5]).toBe(JSON.stringify({ roleId: "r1" }));
  });
});

describe("consumeOryCMSToken", () => {
  it("returns token data when the update matches a valid row", async () => {
    const pool = makePool((sql) => {
      if (sql.includes("UPDATE orycms_tokens")) {
        return { rows: [{ id: "t1", type: "invite", userId: "u1", email: "a@b.co", metadata: null }] };
      }
      return { rows: [] };
    });
    const token = await consumeOryCMSToken("invite", "rawtok", pool);
    expect(token.userId).toBe("u1");
    // The UPDATE must guard on type, unused, and unexpired.
    const sql = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(sql).toContain('"usedAt" IS NULL');
    expect(sql).toContain('"expiresAt" > NOW()');
    expect(sql).toContain("type = $2");
  });

  it("hashes the raw token before lookup", async () => {
    const pool = makePool(() => ({ rows: [{ id: "t1", type: "reset", userId: "u1", email: "a@b.co", metadata: null }] }));
    await consumeOryCMSToken("reset", "myraw", pool);
    const params = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0][1] as unknown[];
    expect(params[0]).toBe(sha256("myraw"));
  });

  it("throws a generic 400 when no valid row matches (missing/expired/used)", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await expect(consumeOryCMSToken("invite", "bad", pool)).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
      statusCode: 400,
    });
  });
});
