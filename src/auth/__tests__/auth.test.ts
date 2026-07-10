import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import {
  hasOryCMSInitialUser,
  createOryCMSInitialOwner,
  authenticateOryCMSUser,
  createOryCMSUserSession,
  destroyOryCMSUserSession,
  getOryCMSCurrentSession,
  protectOryCMSAdminRoute,
  SESSION_COOKIE,
} from "../auth";
import { OryCMSAuthError } from "../auth.errors";
import type { Pool } from "pg";

// ── Mock pool factory ─────────────────────────────────────────────────────────

function makePool(queryImpl: (sql: string, params?: unknown[]) => unknown) {
  return { query: vi.fn(queryImpl) } as unknown as Pool;
}

// ── hasOryCMSInitialUser ───────────────────────────────────────────────────────

describe("hasOryCMSInitialUser", () => {
  it("returns false when no users exist", async () => {
    const pool = makePool(() => ({ rows: [] }));
    expect(await hasOryCMSInitialUser(pool)).toBe(false);
  });

  it("returns true when at least one user exists", async () => {
    const pool = makePool(() => ({ rows: [{ 1: 1 }] }));
    expect(await hasOryCMSInitialUser(pool)).toBe(true);
  });
});

// ── createOryCMSInitialOwner ───────────────────────────────────────────────────

describe("createOryCMSInitialOwner", () => {
  it("creates Owner role then user on first setup", async () => {
    let callCount = 0;
    const pool = makePool(() => {
      callCount++;
      if (callCount === 1) return { rows: [] }; // hasInitialUser check
      if (callCount === 2) return { rows: [{ id: "role-uuid" }] }; // role upsert
      return {
        rows: [{ id: "user-uuid", email: "owner@test.com", roleId: "role-uuid", status: "active" }],
      }; // user insert
    });

    const user = await createOryCMSInitialOwner(
      pool,
      { email: "owner@test.com", password: "securepass" },
      1, // fast bcrypt for tests
    );

    expect(user.email).toBe("owner@test.com");
    expect(user.status).toBe("active");
    expect(user.roleId).toBe("role-uuid");
    expect(callCount).toBe(3);
  });

  it("throws SETUP_ALREADY_DONE if a user already exists", async () => {
    const pool = makePool(() => ({ rows: [{ 1: 1 }] }));

    await expect(
      createOryCMSInitialOwner(pool, { email: "new@test.com", password: "securepass" }, 1),
    ).rejects.toMatchObject({ code: "SETUP_ALREADY_DONE", statusCode: 409 });
  });

  it("throws WEAK_PASSWORD for passwords shorter than 8 chars", async () => {
    const pool = makePool(() => ({ rows: [] })); // no users yet

    await expect(
      createOryCMSInitialOwner(pool, { email: "a@b.com", password: "short" }, 1),
    ).rejects.toMatchObject({ code: "WEAK_PASSWORD", statusCode: 422 });
  });

  it("lowercases and trims the email", async () => {
    let insertedEmail: string | undefined;
    let callCount = 0;
    const pool = makePool((_sql: unknown, params?: unknown[]) => {
      callCount++;
      if (callCount === 1) return { rows: [] };
      if (callCount === 2) return { rows: [{ id: "role-uuid" }] };
      insertedEmail = (params as string[])?.[0];
      return { rows: [{ id: "u", email: insertedEmail, roleId: "r", status: "active" }] };
    });

    await createOryCMSInitialOwner(
      pool,
      { email: "  OWNER@TEST.COM  ", password: "securepass" },
      1,
    );
    expect(insertedEmail).toBe("owner@test.com");
  });
});

// ── authenticateOryCMSUser ────────────────────────────────────────────────────

describe("authenticateOryCMSUser", () => {
  let hash: string;

  beforeEach(async () => {
    hash = await bcrypt.hash("correctpass", 1);
  });

  it("returns user on valid credentials", async () => {
    const pool = makePool(() => ({
      rows: [
        { id: "u1", email: "user@test.com", passwordHash: hash, status: "active", roleId: null },
      ],
    }));

    const user = await authenticateOryCMSUser(pool, "user@test.com", "correctpass");
    expect(user.id).toBe("u1");
    expect(user.email).toBe("user@test.com");
  });

  it("throws INVALID_CREDENTIALS for wrong password", async () => {
    const pool = makePool(() => ({
      rows: [
        { id: "u1", email: "user@test.com", passwordHash: hash, status: "active", roleId: null },
      ],
    }));

    await expect(authenticateOryCMSUser(pool, "user@test.com", "wrongpass")).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
  });

  it("throws INVALID_CREDENTIALS for unknown email", async () => {
    const pool = makePool(() => ({ rows: [] }));

    await expect(authenticateOryCMSUser(pool, "nobody@test.com", "anypass")).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
  });

  it("throws ACCOUNT_INACTIVE for inactive users", async () => {
    const pool = makePool(() => ({
      rows: [
        { id: "u1", email: "user@test.com", passwordHash: hash, status: "inactive", roleId: null },
      ],
    }));

    await expect(
      authenticateOryCMSUser(pool, "user@test.com", "correctpass"),
    ).rejects.toMatchObject({ code: "ACCOUNT_INACTIVE", statusCode: 403 });
  });

  it("lowercases and trims the email when querying", async () => {
    let queriedEmail: string | undefined;
    const pool = makePool((_sql: unknown, params?: unknown[]) => {
      queriedEmail = (params as string[])?.[0];
      return {
        rows: [
          { id: "u1", email: queriedEmail, passwordHash: hash, status: "active", roleId: null },
        ],
      };
    });

    await authenticateOryCMSUser(pool, "  User@Test.COM  ", "correctpass");
    expect(queriedEmail).toBe("user@test.com");
  });
});

// ── createOryCMSUserSession ───────────────────────────────────────────────────

describe("createOryCMSUserSession", () => {
  it("returns a 64-char hex raw token", async () => {
    const pool = makePool(() => ({ rows: [] }));
    const token = await createOryCMSUserSession(pool, "user-uuid");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("inserts exactly one row into orycms_sessions", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await createOryCMSUserSession(pool, "user-uuid");
    expect(pool.query as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1);
  });

  it("does NOT store the raw token — only the hash", async () => {
    let storedHash: string | undefined;
    const pool = makePool((_sql: unknown, params?: unknown[]) => {
      storedHash = (params as string[])?.[1]; // tokenHash is $2
      return { rows: [] };
    });
    const rawToken = await createOryCMSUserSession(pool, "user-uuid");
    expect(storedHash).not.toBe(rawToken);
    // SHA-256 hex is always 64 chars
    expect(storedHash).toHaveLength(64);
  });

  it("each call produces a unique token", async () => {
    const pool = makePool(() => ({ rows: [] }));
    const t1 = await createOryCMSUserSession(pool, "user-uuid");
    const t2 = await createOryCMSUserSession(pool, "user-uuid");
    expect(t1).not.toBe(t2);
  });
});

// ── destroyOryCMSUserSession ──────────────────────────────────────────────────

describe("destroyOryCMSUserSession", () => {
  it("deletes by tokenHash, not by raw token", async () => {
    const pool = makePool(() => ({ rows: [] }));
    const rawToken = "a".repeat(64);
    await destroyOryCMSUserSession(pool, rawToken);
    const call = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0];
    // The param passed must not equal the raw token
    const param = (call[1] as string[])[0];
    expect(param).not.toBe(rawToken);
    expect(param).toHaveLength(64); // SHA-256 hex
  });

  it("is safe to call with an unknown token (no-op)", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await expect(destroyOryCMSUserSession(pool, "unknown")).resolves.toBeUndefined();
  });
});

// ── getOryCMSCurrentSession ───────────────────────────────────────────────────

describe("getOryCMSCurrentSession", () => {
  it("returns session data for a valid non-expired session", async () => {
    const pool = makePool(() => ({
      rows: [{ userId: "u1", email: "user@test.com", roleName: "Owner" }],
    }));
    const session = await getOryCMSCurrentSession(pool, "validtoken");
    expect(session).toMatchObject({ userId: "u1", email: "user@test.com", roleName: "Owner" });
  });

  it("returns null when session not found or expired", async () => {
    const pool = makePool(() => ({ rows: [] }));
    const session = await getOryCMSCurrentSession(pool, "expiredtoken");
    expect(session).toBeNull();
  });

  it("queries using a hash, not the raw token", async () => {
    let passedHash: string | undefined;
    const rawToken = "b".repeat(64);
    const pool = makePool((_sql: unknown, params?: unknown[]) => {
      passedHash = (params as string[])?.[0];
      return { rows: [] };
    });
    await getOryCMSCurrentSession(pool, rawToken);
    expect(passedHash).not.toBe(rawToken);
    expect(passedHash).toHaveLength(64);
  });
});

// ── protectOryCMSAdminRoute ───────────────────────────────────────────────────

describe("protectOryCMSAdminRoute", () => {
  function makeRequest(cookieValue?: string): NextRequest {
    const headers = new Headers();
    if (cookieValue) headers.set("cookie", `${SESSION_COOKIE}=${cookieValue}`);
    return new NextRequest("http://localhost/", { headers });
  }

  it("throws UNAUTHORIZED when no session cookie", async () => {
    const pool = makePool(() => ({ rows: [] }));
    const request = makeRequest();
    await expect(protectOryCMSAdminRoute(request, pool)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      statusCode: 401,
    });
  });

  it("throws SESSION_EXPIRED when session is not found in DB", async () => {
    const pool = makePool(() => ({ rows: [] }));
    const request = makeRequest("sometoken");
    await expect(protectOryCMSAdminRoute(request, pool)).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
      statusCode: 401,
    });
  });

  it("returns session data for a valid session", async () => {
    const pool = makePool(() => ({
      rows: [{ userId: "u1", email: "owner@test.com", roleName: "Owner" }],
    }));
    const request = makeRequest("validtoken");
    const session = await protectOryCMSAdminRoute(request, pool);
    expect(session).toMatchObject({ userId: "u1", email: "owner@test.com" });
  });

  it("is an OryCMSAuthError instance when unauthorized", async () => {
    const pool = makePool(() => ({ rows: [] }));
    const request = makeRequest();
    try {
      await protectOryCMSAdminRoute(request, pool);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(OryCMSAuthError);
    }
  });
});
