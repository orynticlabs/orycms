import crypto from "crypto";
import bcrypt from "bcryptjs";
import type { Pool } from "pg";
import type { NextRequest } from "next/server";
import { OryCMSAuthError } from "./auth.errors";
import { getOryCMSPool } from "@/lib/db";
import { buildOryCMSHookContext, runOryCMSBeforeHooks, runOryCMSAfterHooks } from "@/hooks";

// ── Constants ──────────────────────────────────────────────────────────────────

export const SESSION_COOKIE = "orycms_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_MAX_AGE = SESSION_TTL_MS / 1000; // seconds for cookie

// ── Types ──────────────────────────────────────────────────────────────────────

export interface OryCMSSetupInput {
  email: string;
  password: string;
}

export interface OryCMSAuthUser {
  id: string;
  email: string;
  roleId: string | null;
  status: string;
}

export interface OryCMSSessionData {
  userId: string;
  email: string;
  roleName: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// ── Core auth functions ────────────────────────────────────────────────────────

/**
 * Returns true if at least one user exists in orycms_users.
 */
export async function hasOryCMSInitialUser(pool: Pool): Promise<boolean> {
  const result = await pool.query("SELECT 1 FROM orycms_users LIMIT 1");
  return result.rows.length > 0;
}

/**
 * Creates the Owner role (if absent) and the first admin user.
 * Throws SETUP_ALREADY_DONE if any user already exists.
 * Throws WEAK_PASSWORD if the password is shorter than 8 characters.
 */
export async function createOryCMSInitialOwner(
  pool: Pool,
  input: OryCMSSetupInput,
  bcryptRounds = 12,
): Promise<OryCMSAuthUser> {
  if (await hasOryCMSInitialUser(pool)) {
    throw new OryCMSAuthError(
      "SETUP_ALREADY_DONE",
      "An owner account already exists. Use /login.",
      409,
    );
  }

  if (input.password.length < 8) {
    throw new OryCMSAuthError("WEAK_PASSWORD", "Password must be at least 8 characters.", 422);
  }

  // Upsert the Owner role
  const roleResult = await pool.query<{ id: string }>(
    `INSERT INTO orycms_roles (id, name)
     VALUES (gen_random_uuid(), 'Owner')
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
  );
  const roleId = roleResult.rows[0].id;

  const passwordHash = await bcrypt.hash(input.password, bcryptRounds);

  const userResult = await pool.query<OryCMSAuthUser>(
    `INSERT INTO orycms_users (id, email, "passwordHash", status, "roleId")
     VALUES (gen_random_uuid(), $1, $2, 'active', $3)
     RETURNING id, email, "roleId", status`,
    [input.email.toLowerCase().trim(), passwordHash, roleId],
  );

  return userResult.rows[0];
}

/**
 * Validates email + password. Returns the user on success.
 * Throws INVALID_CREDENTIALS or ACCOUNT_INACTIVE on failure.
 */
export async function authenticateOryCMSUser(
  pool: Pool,
  email: string,
  password: string,
): Promise<OryCMSAuthUser> {
  const normEmail = email.toLowerCase().trim();

  await runOryCMSBeforeHooks(
    "beforeLogin",
    buildOryCMSHookContext("beforeLogin", null, { email: normEmail }, null),
  );

  const result = await pool.query<OryCMSAuthUser & { passwordHash: string }>(
    `SELECT id, email, "passwordHash", status, "roleId"
     FROM orycms_users
     WHERE email = $1
     LIMIT 1`,
    [normEmail],
  );

  const user = result.rows[0];

  // Constant-time: always compare even if user not found (dummy hash avoids timing leak)
  const dummyHash = "$2a$12$invalidhashfortimingprotection0000000000000000000000";
  const hash = user?.passwordHash ?? dummyHash;
  const valid = await bcrypt.compare(password, hash);

  if (!user || !valid) {
    throw new OryCMSAuthError("INVALID_CREDENTIALS", "Invalid email or password.", 401);
  }

  if (user.status !== "active") {
    throw new OryCMSAuthError(
      "ACCOUNT_INACTIVE",
      "This account is inactive. Contact your administrator.",
      403,
    );
  }

  await runOryCMSAfterHooks(
    "afterLogin",
    buildOryCMSHookContext("afterLogin", null, { id: user.id, email: user.email }, null),
  );
  return user;
}

/**
 * Creates a session for the given user.
 * Returns the raw token (64-char hex) — this is what goes in the cookie.
 * Only the SHA-256 hash is stored in the database.
 */
export async function createOryCMSUserSession(pool: Pool, userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  await pool.query(
    `INSERT INTO orycms_sessions (id, "userId", "tokenHash", "expiresAt")
     VALUES (gen_random_uuid(), $1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );

  return rawToken;
}

/**
 * Deletes the session that matches the given raw token.
 * Safe to call with an invalid token (no-op).
 */
export async function destroyOryCMSUserSession(pool: Pool, rawToken: string): Promise<void> {
  await runOryCMSBeforeHooks(
    "beforeLogout",
    buildOryCMSHookContext("beforeLogout", null, { token: "[redacted]" }, null),
  );
  await pool.query(`DELETE FROM orycms_sessions WHERE "tokenHash" = $1`, [hashToken(rawToken)]);
  await runOryCMSAfterHooks("afterLogout", buildOryCMSHookContext("afterLogout", null, {}, null));
}

/**
 * Deletes ALL sessions for a user. Called after a password reset so any
 * previously issued (possibly stolen) session tokens are immediately revoked.
 */
export async function destroyOryCMSUserSessions(pool: Pool, userId: string): Promise<void> {
  await pool.query(`DELETE FROM orycms_sessions WHERE "userId" = $1`, [userId]);
}

/**
 * Looks up a valid, non-expired session by raw token.
 * Returns session data (userId, email, roleName) or null if not found / expired.
 */
export async function getOryCMSCurrentSession(
  pool: Pool,
  rawToken: string,
): Promise<OryCMSSessionData | null> {
  const result = await pool.query<OryCMSSessionData>(
    `SELECT u.id AS "userId", u.email, r.name AS "roleName"
     FROM orycms_sessions s
     JOIN orycms_users u ON u.id = s."userId"
     LEFT JOIN orycms_roles r ON r.id = u."roleId"
     WHERE s."tokenHash" = $1
       AND s."expiresAt" > NOW()
       AND u.status = 'active'
     LIMIT 1`,
    [hashToken(rawToken)],
  );

  return result.rows[0] ?? null;
}

/**
 * Reads the session cookie from the request and validates it.
 * Returns the session data or throws OryCMSAuthError.
 * Pass `pool` to override the singleton (useful in tests).
 */
export async function protectOryCMSAdminRoute(
  request: NextRequest,
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSSessionData> {
  const rawToken = request.cookies.get(SESSION_COOKIE)?.value;

  if (!rawToken) {
    throw new OryCMSAuthError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const session = await getOryCMSCurrentSession(pool, rawToken);

  if (!session) {
    throw new OryCMSAuthError(
      "SESSION_EXPIRED",
      "Session expired or invalid. Please log in again.",
      401,
    );
  }

  return session;
}
