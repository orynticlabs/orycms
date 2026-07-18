import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { Pool } from "pg";
import { getOryCMSPool } from "@/lib/db";
import { OryCMSAuthError } from "@/auth";

// ── Types ──────────────────────────────────────────────────────────────────────

export type OryCMSUserStatus = "active" | "inactive" | "pending";

export interface OryCMSUserRecord {
  id: string;
  email: string;
  status: OryCMSUserStatus;
  roleId: string | null;
  roleName?: string | null;
  createdAt?: string;
}

export interface OryCMSCreateUserInput {
  email: string;
  password?: string;
  roleId?: string | null;
  status?: OryCMSUserStatus;
}

export interface OryCMSUpdateUserInput {
  email?: string;
  password?: string;
  roleId?: string | null;
  status?: OryCMSUserStatus;
}

const BCRYPT_ROUNDS = 12;

// ── Read ───────────────────────────────────────────────────────────────────────

export async function listOryCMSUsers(pool: Pool = getOryCMSPool()): Promise<OryCMSUserRecord[]> {
  const result = await pool.query<OryCMSUserRecord>(
    `SELECT u.id, u.email, u.status, u."roleId", r.name AS "roleName"
     FROM orycms_users u
     LEFT JOIN orycms_roles r ON r.id = u."roleId"
     ORDER BY u.email ASC`,
  );
  return result.rows;
}

export async function getOryCMSUser(
  id: string,
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSUserRecord> {
  const result = await pool.query<OryCMSUserRecord>(
    `SELECT u.id, u.email, u.status, u."roleId", r.name AS "roleName"
     FROM orycms_users u
     LEFT JOIN orycms_roles r ON r.id = u."roleId"
     WHERE u.id = $1
     LIMIT 1`,
    [id],
  );
  const user = result.rows[0];
  if (!user) throw new OryCMSAuthError("UNAUTHORIZED", "User not found.", 404);
  return user;
}

/** Look up a user by email. Returns null when absent (no throw) — used by
 *  no-enumeration flows like forgot-password. */
export async function findOryCMSUserByEmail(
  email: string,
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSUserRecord | null> {
  const result = await pool.query<OryCMSUserRecord>(
    `SELECT id, email, status, "roleId" FROM orycms_users WHERE email = $1 LIMIT 1`,
    [email.toLowerCase().trim()],
  );
  return result.rows[0] ?? null;
}

// ── Write ──────────────────────────────────────────────────────────────────────

export async function createOryCMSUser(
  input: OryCMSCreateUserInput,
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSUserRecord> {
  if (input.password && input.password.length < 8) {
    throw new OryCMSAuthError("WEAK_PASSWORD", "Password must be at least 8 characters.", 422);
  }
  const passwordHash = input.password
    ? await bcrypt.hash(input.password, BCRYPT_ROUNDS)
    : // Placeholder hash for invited/pending users who set their password later.
      await bcrypt.hash(cryptoRandom(), BCRYPT_ROUNDS);

  const result = await pool.query<OryCMSUserRecord>(
    `INSERT INTO orycms_users (id, email, "passwordHash", status, "roleId")
     VALUES (gen_random_uuid(), $1, $2, $3, $4)
     RETURNING id, email, status, "roleId"`,
    [
      input.email.toLowerCase().trim(),
      passwordHash,
      input.status ?? "pending",
      input.roleId ?? null,
    ],
  );
  return result.rows[0];
}

export async function updateOryCMSUser(
  id: string,
  input: OryCMSUpdateUserInput,
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSUserRecord> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (input.email !== undefined) {
    sets.push(`email = $${i++}`);
    values.push(input.email.toLowerCase().trim());
  }
  if (input.status !== undefined) {
    sets.push(`status = $${i++}`);
    values.push(input.status);
  }
  if (input.roleId !== undefined) {
    sets.push(`"roleId" = $${i++}`);
    values.push(input.roleId);
  }
  if (input.password !== undefined) {
    if (input.password.length < 8) {
      throw new OryCMSAuthError("WEAK_PASSWORD", "Password must be at least 8 characters.", 422);
    }
    sets.push(`"passwordHash" = $${i++}`);
    values.push(await bcrypt.hash(input.password, BCRYPT_ROUNDS));
  }

  if (sets.length === 0) return getOryCMSUser(id, pool);

  values.push(id);
  const result = await pool.query<OryCMSUserRecord>(
    `UPDATE orycms_users SET ${sets.join(", ")}
     WHERE id = $${i}
     RETURNING id, email, status, "roleId"`,
    values,
  );
  const user = result.rows[0];
  if (!user) throw new OryCMSAuthError("UNAUTHORIZED", "User not found.", 404);
  return user;
}

export async function deleteOryCMSUser(id: string, pool: Pool = getOryCMSPool()): Promise<void> {
  await pool.query(`DELETE FROM orycms_users WHERE id = $1`, [id]);
}

export async function setOryCMSUserRole(
  id: string,
  roleId: string | null,
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSUserRecord> {
  return updateOryCMSUser(id, { roleId }, pool);
}

export async function setOryCMSUserStatus(
  id: string,
  status: OryCMSUserStatus,
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSUserRecord> {
  return updateOryCMSUser(id, { status }, pool);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function cryptoRandom(): string {
  // Non-guessable placeholder password for pending accounts (never used to log in;
  // invited users set a real password via the accept-invite flow).
  return crypto.randomBytes(32).toString("hex");
}
