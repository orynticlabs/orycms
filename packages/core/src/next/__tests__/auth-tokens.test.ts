import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";

// ── Mock the DB pool so handlers that call getOryCMSPool() hit our fake. ──────────
// Full-stack style (matches auth.test.ts / dispatcher.test.ts): only the DB and
// email boundaries are mocked, every other layer (users/tokens/auth/route-guards
// engine code, the dispatcher itself) is real.
let queryImpl: (sql: string, params?: unknown[]) => unknown = () => ({ rows: [] });
const poolQuery = vi.fn((sql: string, params?: unknown[]) => queryImpl(sql, params));

vi.mock("@/lib/db", () => ({
  getOryCMSPool: () => ({ query: poolQuery }) as unknown as Pool,
}));

// Task requires: "do not send real emails; mock the email layer in tests."
// sendOryCMSEmail is the one boundary that would otherwise reach a real provider.
const sendOryCMSEmail = vi.fn();
vi.mock("@/email", () => ({
  sendOryCMSEmail: (...args: unknown[]) => sendOryCMSEmail(...args),
}));

const { createOryCMSRouteHandlers } = await import("../dispatcher");
const { registerOryCMSHook, clearOryCMSHooks } = await import("@/hooks");
const handlers = createOryCMSRouteHandlers();

function req(
  path: string,
  init: { method?: string; cookie?: string; body?: unknown } = {},
): Request {
  const headers = new Headers();
  if (init.cookie) headers.set("cookie", init.cookie);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  return new Request(`http://localhost${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

/** SHA-256 hex digest, same algorithm tokens.repo.ts/auth.ts use for at-rest hashing. */
async function sha256Hex(raw: string): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(raw).digest("hex");
}

beforeEach(() => {
  queryImpl = () => ({ rows: [] });
  poolQuery.mockClear();
  sendOryCMSEmail.mockReset();
  sendOryCMSEmail.mockResolvedValue({ sent: false, provider: null }); // dev/no-provider mode by default
});

afterEach(() => {
  clearOryCMSHooks();
});

// ── POST /auth/refresh ─────────────────────────────────────────────────────────────

describe("POST /auth/refresh", () => {
  it("401 UNAUTHORIZED with no session cookie", async () => {
    const res = await handlers.POST(req("/api/orycms/auth/refresh", { method: "POST" }));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body).toEqual({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  });

  it("401 SESSION_EXPIRED when the cookie's token matches no live session row", async () => {
    queryImpl = () => ({ rows: [] });
    const res = await handlers.POST(
      req("/api/orycms/auth/refresh", { method: "POST", cookie: "orycms_session=bogus" }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body).toEqual({
      success: false,
      error: { code: "SESSION_EXPIRED", message: "Session expired or invalid." },
    });
  });

  it("success: rotates the token — issues a new session cookie and destroys the old one", async () => {
    queryImpl = (sql: string) => {
      if (sql.includes("FROM orycms_sessions")) {
        return { rows: [{ userId: "u1", email: "owner@acme.io", roleName: "Owner" }] };
      }
      return { rows: [] };
    };
    const res = await handlers.POST(
      req("/api/orycms/auth/refresh", { method: "POST", cookie: "orycms_session=oldtok" }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    expect(body).toEqual({ success: true, data: { refreshed: true } });

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("orycms_session=");
    expect(setCookie).not.toContain("orycms_session=oldtok");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");

    // Old token's hash must be the one deleted (rotation, not just issuing a second one).
    const oldHash = await sha256Hex("oldtok");
    const deleteCall = poolQuery.mock.calls.find(([sql]) =>
      String(sql).includes("DELETE FROM orycms_sessions"),
    );
    expect(deleteCall?.[1]).toEqual([oldHash]);
  });

  it("fires beforeLogout/afterLogout when destroying the old session (inherited from destroyOryCMSUserSession)", async () => {
    queryImpl = (sql: string) =>
      sql.includes("FROM orycms_sessions")
        ? { rows: [{ userId: "u1", email: "owner@acme.io", roleName: "Owner" }] }
        : { rows: [] };
    const before = vi.fn();
    const after = vi.fn();
    registerOryCMSHook("beforeLogout", before);
    registerOryCMSHook("afterLogout", after);

    await handlers.POST(
      req("/api/orycms/auth/refresh", { method: "POST", cookie: "orycms_session=oldtok" }),
    );

    expect(before).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
  });
});

// ── POST /auth/forgot-password ──────────────────────────────────────────────────────

describe("POST /auth/forgot-password", () => {
  it("always 200 with the generic message when the email is missing", async () => {
    const res = await handlers.POST(
      req("/api/orycms/auth/forgot-password", { method: "POST", body: {} }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    expect(body).toEqual({
      success: true,
      data: { message: "If an account exists for that email, a reset link has been sent." },
    });
    expect(poolQuery).not.toHaveBeenCalled();
  });

  it("unknown email: same 200 message, no token row created, no email sent", async () => {
    queryImpl = () => ({ rows: [] }); // findOryCMSUserByEmail finds nothing
    const res = await handlers.POST(
      req("/api/orycms/auth/forgot-password", { method: "POST", body: { email: "ghost@acme.io" } }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    expect(body).toEqual({
      success: true,
      data: { message: "If an account exists for that email, a reset link has been sent." },
    });
    const ranTokenInsert = poolQuery.mock.calls.some(([sql]) =>
      String(sql).includes("INSERT INTO orycms_tokens"),
    );
    expect(ranTokenInsert).toBe(false);
    expect(sendOryCMSEmail).not.toHaveBeenCalled();
  });

  // ROOT WEAKNESS, logged in internal/PROGRESS.md, NOT fixed here (per instruction 5):
  // root's known-email response always ADDS a `resetLink` key (null when a provider
  // sent the email, the raw link string otherwise) that the unknown/missing-email
  // response never includes. The two JSON bodies are therefore NOT byte-identical —
  // key *presence* is itself a (minor) user-enumeration signal if a provider is
  // configured. This test documents root's actual behavior faithfully; it does not
  // claim the responses are indistinguishable.
  it("known email, no provider configured: 200 with the SAME message text, PLUS a resetLink field root's unknown-email response omits", async () => {
    queryImpl = (sql: string) => {
      if (sql.includes("FROM orycms_users WHERE email"))
        return { rows: [{ id: "u1", email: "owner@acme.io", status: "active", roleId: "r1" }] };
      return { rows: [] };
    };
    const res = await handlers.POST(
      req("/api/orycms/auth/forgot-password", { method: "POST", body: { email: "owner@acme.io" } }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: { message: string; resetLink: string | null };
    };
    expect(body.success).toBe(true);
    expect(body.data.message).toBe(
      "If an account exists for that email, a reset link has been sent.",
    );
    expect(typeof body.data.resetLink).toBe("string"); // dev mode: the raw link is returned
    expect(sendOryCMSEmail).toHaveBeenCalledTimes(1);
  });

  it("known email, provider configured (emailed): resetLink is null, not the raw link", async () => {
    sendOryCMSEmail.mockResolvedValue({ sent: true, provider: "resend" });
    queryImpl = (sql: string) =>
      sql.includes("FROM orycms_users WHERE email")
        ? { rows: [{ id: "u1", email: "owner@acme.io", status: "active", roleId: "r1" }] }
        : { rows: [] };
    const res = await handlers.POST(
      req("/api/orycms/auth/forgot-password", { method: "POST", body: { email: "owner@acme.io" } }),
    );
    const body = (await res.json()) as { data: { resetLink: string | null } };
    expect(body.data.resetLink).toBeNull();
  });

  it("a token is created ONLY for a real (found) user, and it is stored hashed — never the raw value", async () => {
    queryImpl = (sql: string) =>
      sql.includes("FROM orycms_users WHERE email")
        ? { rows: [{ id: "u1", email: "owner@acme.io", status: "active", roleId: "r1" }] }
        : { rows: [] };
    const res = await handlers.POST(
      req("/api/orycms/auth/forgot-password", { method: "POST", body: { email: "owner@acme.io" } }),
    );
    const body = (await res.json()) as { data: { resetLink: string } };
    const rawToken = new URL(body.data.resetLink).searchParams.get("token") as string;
    expect(rawToken).toMatch(/^[0-9a-f]{64}$/); // 32 random bytes, hex

    const insertCall = poolQuery.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO orycms_tokens"),
    );
    expect(insertCall).toBeDefined();
    const params = insertCall?.[1] as unknown[];
    expect(params).not.toContain(rawToken); // only the hash goes to the DB
    const expectedHash = await sha256Hex(rawToken);
    expect(params).toContain(expectedHash);
  });

  it("the raw token never appears in a console.log/console.error call during the flow", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    queryImpl = (sql: string) =>
      sql.includes("FROM orycms_users WHERE email")
        ? { rows: [{ id: "u1", email: "owner@acme.io", status: "active", roleId: "r1" }] }
        : { rows: [] };
    const res = await handlers.POST(
      req("/api/orycms/auth/forgot-password", { method: "POST", body: { email: "owner@acme.io" } }),
    );
    const body = (await res.json()) as { data: { resetLink: string } };
    const rawToken = new URL(body.data.resetLink).searchParams.get("token") as string;

    const allLoggedText = [...logSpy.mock.calls, ...errorSpy.mock.calls].flat().join(" ");
    expect(allLoggedText).not.toContain(rawToken);
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

// ── POST /auth/reset-password ────────────────────────────────────────────────────

describe("POST /auth/reset-password", () => {
  it("422 VALIDATION_ERROR when token or password is missing", async () => {
    const res = await handlers.POST(
      req("/api/orycms/auth/reset-password", { method: "POST", body: { token: "t" } }),
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("400 INVALID_CREDENTIALS for an unknown token", async () => {
    queryImpl = () => ({ rows: [] }); // consumeOryCMSToken's UPDATE...RETURNING matches nothing
    const res = await handlers.POST(
      req("/api/orycms/auth/reset-password", {
        method: "POST",
        body: { token: "bogus", password: "supersecret" },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body).toEqual({
      success: false,
      error: { code: "INVALID_CREDENTIALS", message: "This link is invalid or has expired." },
    });
  });

  it("400 INVALID_CREDENTIALS, SAME shape, for an expired token (consumeOryCMSToken collapses missing/expired/used)", async () => {
    // The real consumeOryCMSToken query already encodes expiry (expiresAt > NOW()) —
    // simulating "no matching row" IS simulating an expired token at this layer.
    queryImpl = () => ({ rows: [] });
    const res = await handlers.POST(
      req("/api/orycms/auth/reset-password", {
        method: "POST",
        body: { token: "expired", password: "supersecret" },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("400 INVALID_CREDENTIALS for a token of the wrong type (e.g. an activation token here)", async () => {
    // consumeOryCMSToken filters `AND type = $2`, so a real activation-type row
    // never matches a `reset` lookup — same as "unknown" from this route's view.
    queryImpl = () => ({ rows: [] });
    const res = await handlers.POST(
      req("/api/orycms/auth/reset-password", {
        method: "POST",
        body: { token: "an-activation-token", password: "supersecret" },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("token cannot be reused (single-use): second call with the same token fails", async () => {
    let used = false;
    queryImpl = (sql: string) => {
      if (sql.includes("UPDATE orycms_tokens")) {
        if (used) return { rows: [] };
        used = true;
        return {
          rows: [{ id: "t1", type: "reset", userId: "u1", email: "owner@acme.io", metadata: null }],
        };
      }
      if (sql.includes("UPDATE orycms_users")) {
        return { rows: [{ id: "u1", email: "owner@acme.io", status: "active", roleId: "r1" }] };
      }
      return { rows: [] };
    };
    const first = await handlers.POST(
      req("/api/orycms/auth/reset-password", {
        method: "POST",
        body: { token: "once", password: "supersecret" },
      }),
    );
    expect(first.status).toBe(200);
    const second = await handlers.POST(
      req("/api/orycms/auth/reset-password", {
        method: "POST",
        body: { token: "once", password: "supersecret2" },
      }),
    );
    expect(second.status).toBe(400);
    const body = (await second.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("400 when the token has no linked userId", async () => {
    queryImpl = (sql: string) =>
      sql.includes("UPDATE orycms_tokens")
        ? {
            rows: [
              { id: "t1", type: "reset", userId: null, email: "owner@acme.io", metadata: null },
            ],
          }
        : { rows: [] };
    const res = await handlers.POST(
      req("/api/orycms/auth/reset-password", {
        method: "POST",
        body: { token: "orphan", password: "supersecret" },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.message).toBe("This reset link is not linked to an account.");
  });

  it("password policy (WEAK_PASSWORD, 422) enforced via updateOryCMSUser", async () => {
    queryImpl = (sql: string) =>
      sql.includes("UPDATE orycms_tokens")
        ? {
            rows: [
              { id: "t1", type: "reset", userId: "u1", email: "owner@acme.io", metadata: null },
            ],
          }
        : { rows: [] };
    const res = await handlers.POST(
      req("/api/orycms/auth/reset-password", {
        method: "POST",
        body: { token: "ok", password: "short" },
      }),
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("WEAK_PASSWORD");
  });

  it("success: updates the password and revokes ALL of the user's sessions (plural, not just one)", async () => {
    queryImpl = (sql: string) => {
      if (sql.includes("UPDATE orycms_tokens")) {
        return {
          rows: [{ id: "t1", type: "reset", userId: "u1", email: "owner@acme.io", metadata: null }],
        };
      }
      if (sql.includes("UPDATE orycms_users")) {
        return { rows: [{ id: "u1", email: "owner@acme.io", status: "active", roleId: "r1" }] };
      }
      return { rows: [] };
    };
    const res = await handlers.POST(
      req("/api/orycms/auth/reset-password", {
        method: "POST",
        body: { token: "ok", password: "supersecret" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    expect(body).toEqual({
      success: true,
      data: { message: "Password updated. Please sign in with your new password." },
    });

    const sessionDeleteCall = poolQuery.mock.calls.find(([sql]) =>
      String(sql).includes(`DELETE FROM orycms_sessions WHERE "userId"`),
    );
    expect(sessionDeleteCall?.[1]).toEqual(["u1"]);
  });

  it("does NOT fire beforeLogout/afterLogout (the plural revoke is hookless, matching root)", async () => {
    queryImpl = (sql: string) =>
      sql.includes("UPDATE orycms_tokens")
        ? {
            rows: [
              { id: "t1", type: "reset", userId: "u1", email: "owner@acme.io", metadata: null },
            ],
          }
        : { rows: [] };
    const before = vi.fn();
    const after = vi.fn();
    registerOryCMSHook("beforeLogout", before);
    registerOryCMSHook("afterLogout", after);

    await handlers.POST(
      req("/api/orycms/auth/reset-password", {
        method: "POST",
        body: { token: "ok", password: "supersecret" },
      }),
    );

    expect(before).not.toHaveBeenCalled();
    expect(after).not.toHaveBeenCalled();
  });
});

// ── POST /auth/activate ──────────────────────────────────────────────────────────

describe("POST /auth/activate", () => {
  it("422 VALIDATION_ERROR when token is missing", async () => {
    const res = await handlers.POST(req("/api/orycms/auth/activate", { method: "POST", body: {} }));
    expect(res.status).toBe(422);
  });

  it("400 INVALID_CREDENTIALS for an unknown/expired/used token", async () => {
    queryImpl = () => ({ rows: [] });
    const res = await handlers.POST(
      req("/api/orycms/auth/activate", { method: "POST", body: { token: "bogus" } }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("400 INVALID_CREDENTIALS for a token of the wrong type (e.g. an invite token here)", async () => {
    queryImpl = () => ({ rows: [] }); // type filter in consumeOryCMSToken excludes it
    const res = await handlers.POST(
      req("/api/orycms/auth/activate", { method: "POST", body: { token: "an-invite-token" } }),
    );
    expect(res.status).toBe(400);
  });

  it("token cannot be reused", async () => {
    let used = false;
    queryImpl = (sql: string) => {
      if (sql.includes("UPDATE orycms_tokens")) {
        if (used) return { rows: [] };
        used = true;
        return {
          rows: [
            { id: "t1", type: "activation", userId: "u1", email: "new@acme.io", metadata: null },
          ],
        };
      }
      if (sql.includes("UPDATE orycms_users")) {
        return { rows: [{ id: "u1", email: "new@acme.io", status: "active", roleId: null }] };
      }
      return { rows: [] };
    };
    const first = await handlers.POST(
      req("/api/orycms/auth/activate", { method: "POST", body: { token: "once" } }),
    );
    expect(first.status).toBe(200);
    const second = await handlers.POST(
      req("/api/orycms/auth/activate", { method: "POST", body: { token: "once" } }),
    );
    expect(second.status).toBe(400);
  });

  it("success: activates the account", async () => {
    queryImpl = (sql: string) =>
      sql.includes("UPDATE orycms_tokens")
        ? {
            rows: [
              { id: "t1", type: "activation", userId: "u1", email: "new@acme.io", metadata: null },
            ],
          }
        : { rows: [{ id: "u1", email: "new@acme.io", status: "active", roleId: null }] };
    const res = await handlers.POST(
      req("/api/orycms/auth/activate", { method: "POST", body: { token: "ok" } }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    expect(body).toEqual({
      success: true,
      data: { userId: "u1", email: "new@acme.io", status: "active" },
    });
  });
});

// ── POST /auth/invite ─────────────────────────────────────────────────────────────

describe("POST /auth/invite", () => {
  function inviterCookie() {
    return "orycms_session=inviter-tok";
  }

  it("401 UNAUTHORIZED with no session", async () => {
    const res = await handlers.POST(
      req("/api/orycms/auth/invite", { method: "POST", body: { email: "a@b.com" } }),
    );
    expect(res.status).toBe(401);
  });

  it("403 FORBIDDEN when the caller lacks users:create", async () => {
    queryImpl = (sql: string) => {
      if (sql.includes("FROM orycms_sessions"))
        return { rows: [{ userId: "u1", email: "ed@acme.io", roleName: "Viewer" }] };
      if (sql.includes("orycms_permissions")) return { rows: [] }; // no matching permission row
      return { rows: [] };
    };
    const res = await handlers.POST(
      req("/api/orycms/auth/invite", {
        method: "POST",
        cookie: inviterCookie(),
        body: { email: "a@b.com" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("422 VALIDATION_ERROR when email is missing (after passing the permission guard)", async () => {
    queryImpl = (sql: string) => {
      if (sql.includes("FROM orycms_sessions"))
        return { rows: [{ userId: "u1", email: "owner@acme.io", roleName: "Owner" }] };
      if (sql.includes("orycms_permissions"))
        return { rows: [{ resource: "users", action: "create" }] };
      return { rows: [] };
    };
    const res = await handlers.POST(
      req("/api/orycms/auth/invite", { method: "POST", cookie: inviterCookie(), body: {} }),
    );
    expect(res.status).toBe(422);
  });

  it("success: creates a pending user, an invite token, and returns 201", async () => {
    queryImpl = (sql: string) => {
      if (sql.includes("FROM orycms_sessions"))
        return { rows: [{ userId: "inviter1", email: "owner@acme.io", roleName: "Owner" }] };
      if (sql.includes("orycms_permissions"))
        return { rows: [{ resource: "users", action: "create" }] };
      if (sql.includes("INSERT INTO orycms_users")) {
        return {
          rows: [{ id: "newuser1", email: "invitee@acme.io", status: "pending", roleId: null }],
        };
      }
      return { rows: [] };
    };
    const res = await handlers.POST(
      req("/api/orycms/auth/invite", {
        method: "POST",
        cookie: inviterCookie(),
        body: { email: "invitee@acme.io" },
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      success: boolean;
      data: { userId: string; email: string; emailed: boolean; inviteLink: string | null };
    };
    expect(body.success).toBe(true);
    expect(body.data.userId).toBe("newuser1");
    expect(body.data.email).toBe("invitee@acme.io");
    expect(body.data.emailed).toBe(false);
    expect(typeof body.data.inviteLink).toBe("string");

    // Pending status, not immediately active.
    const insertUserCall = poolQuery.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO orycms_users"),
    );
    expect(insertUserCall?.[1]).toContain("pending");
  });

  it("audit-log failure propagates as a 500 even though the user/token were already created (matches root's unguarded call — see PROGRESS.md)", async () => {
    queryImpl = (sql: string) => {
      if (sql.includes("FROM orycms_sessions"))
        return { rows: [{ userId: "inviter1", email: "owner@acme.io", roleName: "Owner" }] };
      if (sql.includes("orycms_permissions"))
        return { rows: [{ resource: "users", action: "create" }] };
      if (sql.includes("INSERT INTO orycms_users"))
        return {
          rows: [{ id: "newuser1", email: "invitee@acme.io", status: "pending", roleId: null }],
        };
      if (sql.includes("INSERT INTO orycms_audit_logs")) throw new Error("audit db down");
      return { rows: [] };
    };
    const res = await handlers.POST(
      req("/api/orycms/auth/invite", {
        method: "POST",
        cookie: inviterCookie(),
        body: { email: "invitee@acme.io" },
      }),
    );
    expect(res.status).toBe(500);
    // Confirms the user WAS already created before the failure (root's ordering, not fixed here).
    const ranUserInsert = poolQuery.mock.calls.some(([sql]) =>
      String(sql).includes("INSERT INTO orycms_users"),
    );
    expect(ranUserInsert).toBe(true);
  });
});

// ── POST /auth/accept-invite ──────────────────────────────────────────────────────

describe("POST /auth/accept-invite", () => {
  it("422 VALIDATION_ERROR when token or password is missing", async () => {
    const res = await handlers.POST(
      req("/api/orycms/auth/accept-invite", { method: "POST", body: { token: "t" } }),
    );
    expect(res.status).toBe(422);
  });

  it("400 INVALID_CREDENTIALS for an unknown/expired/used/wrong-type token", async () => {
    queryImpl = () => ({ rows: [] });
    const res = await handlers.POST(
      req("/api/orycms/auth/accept-invite", {
        method: "POST",
        body: { token: "bogus", password: "supersecret" },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("token cannot be reused", async () => {
    let used = false;
    queryImpl = (sql: string) => {
      if (sql.includes("UPDATE orycms_tokens")) {
        if (used) return { rows: [] };
        used = true;
        return {
          rows: [
            { id: "t1", type: "invite", userId: "u1", email: "invitee@acme.io", metadata: null },
          ],
        };
      }
      if (sql.includes("UPDATE orycms_users")) {
        return { rows: [{ id: "u1", email: "invitee@acme.io", status: "active", roleId: null }] };
      }
      return { rows: [] };
    };
    const first = await handlers.POST(
      req("/api/orycms/auth/accept-invite", {
        method: "POST",
        body: { token: "once", password: "supersecret" },
      }),
    );
    expect(first.status).toBe(200);
    const second = await handlers.POST(
      req("/api/orycms/auth/accept-invite", {
        method: "POST",
        body: { token: "once", password: "supersecret2" },
      }),
    );
    expect(second.status).toBe(400);
  });

  it("password policy (WEAK_PASSWORD, 422) enforced", async () => {
    queryImpl = (sql: string) =>
      sql.includes("UPDATE orycms_tokens")
        ? {
            rows: [
              { id: "t1", type: "invite", userId: "u1", email: "invitee@acme.io", metadata: null },
            ],
          }
        : { rows: [] };
    const res = await handlers.POST(
      req("/api/orycms/auth/accept-invite", {
        method: "POST",
        body: { token: "ok", password: "short" },
      }),
    );
    expect(res.status).toBe(422);
  });

  it("success: activates the account, sets the password, and logs the user in (session cookie)", async () => {
    queryImpl = (sql: string) =>
      sql.includes("UPDATE orycms_tokens")
        ? {
            rows: [
              { id: "t1", type: "invite", userId: "u1", email: "invitee@acme.io", metadata: null },
            ],
          }
        : { rows: [{ id: "u1", email: "invitee@acme.io", status: "active", roleId: null }] };
    const res = await handlers.POST(
      req("/api/orycms/auth/accept-invite", {
        method: "POST",
        body: { token: "ok", password: "supersecret" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    expect(body).toEqual({ success: true, data: { userId: "u1", email: "invitee@acme.io" } });

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("orycms_session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");

    const activateCall = poolQuery.mock.calls.find(([sql]) =>
      String(sql).includes('"passwordHash"'),
    );
    expect(activateCall).toBeDefined();
  });

  it("does NOT fire any login hooks (createOryCMSUserSession is hookless, matches root)", async () => {
    queryImpl = (sql: string) =>
      sql.includes("UPDATE orycms_tokens")
        ? {
            rows: [
              { id: "t1", type: "invite", userId: "u1", email: "invitee@acme.io", metadata: null },
            ],
          }
        : { rows: [{ id: "u1", email: "invitee@acme.io", status: "active", roleId: null }] };
    const before = vi.fn();
    const after = vi.fn();
    registerOryCMSHook("beforeLogin", before);
    registerOryCMSHook("afterLogin", after);

    await handlers.POST(
      req("/api/orycms/auth/accept-invite", {
        method: "POST",
        body: { token: "ok", password: "supersecret" },
      }),
    );

    expect(before).not.toHaveBeenCalled();
    expect(after).not.toHaveBeenCalled();
  });
});
