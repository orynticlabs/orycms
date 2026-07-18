import crypto from "crypto";
import type { Pool } from "pg";
import { getOryCMSPool } from "@/lib/db";
import { OryCMSAuthError } from "@/auth";

// ── Types ──────────────────────────────────────────────────────────────────────

export type OryCMSTokenType = "invite" | "activation" | "reset";

export interface OryCMSCreateTokenInput {
  type: OryCMSTokenType;
  email: string;
  userId?: string | null;
  /** Time-to-live in milliseconds. Defaults per type below. */
  ttlMs?: number;
  metadata?: Record<string, unknown> | null;
}

export interface OryCMSConsumedToken {
  id: string;
  type: OryCMSTokenType;
  userId: string | null;
  email: string;
  metadata: Record<string, unknown> | null;
}

// Sensible defaults: invites live a week, activation 3 days, resets 1 hour.
const DEFAULT_TTL_MS: Record<OryCMSTokenType, number> = {
  invite: 7 * 24 * 60 * 60 * 1000,
  activation: 3 * 24 * 60 * 60 * 1000,
  reset: 60 * 60 * 1000,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// ── Create ─────────────────────────────────────────────────────────────────────

/**
 * Create a single-use token. Returns the RAW token (put in the link/email);
 * only its SHA-256 hash is stored — same at-rest model as session tokens.
 */
export async function createOryCMSToken(
  input: OryCMSCreateTokenInput,
  pool: Pool = getOryCMSPool(),
): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const ttl = input.ttlMs ?? DEFAULT_TTL_MS[input.type];
  const expiresAt = new Date(Date.now() + ttl).toISOString();

  await pool.query(
    `INSERT INTO orycms_tokens
       (id, "userId", type, "tokenHash", email, "expiresAt", metadata, "createdAt")
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())`,
    [
      input.userId ?? null,
      input.type,
      tokenHash,
      input.email.toLowerCase().trim(),
      expiresAt,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ],
  );

  return rawToken;
}

// ── Consume ────────────────────────────────────────────────────────────────────

/**
 * Validate and consume a token: it must exist, match the expected type, be
 * unexpired and unused. Marks usedAt on success (single-use). Throws
 * OryCMSAuthError("INVALID_CREDENTIALS", 400) on any failure — the same generic
 * error for missing/expired/used, so callers can't distinguish (no enumeration).
 */
export async function consumeOryCMSToken(
  type: OryCMSTokenType,
  rawToken: string,
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSConsumedToken> {
  const tokenHash = hashToken(rawToken);

  // Atomically mark used only if currently valid; RETURNING tells us if it worked.
  const result = await pool.query<OryCMSConsumedToken>(
    `UPDATE orycms_tokens
     SET "usedAt" = NOW()
     WHERE "tokenHash" = $1
       AND type = $2
       AND "usedAt" IS NULL
       AND "expiresAt" > NOW()
     RETURNING id, type, "userId", email, metadata`,
    [tokenHash, type],
  );

  const token = result.rows[0];
  if (!token) {
    throw new OryCMSAuthError(
      "INVALID_CREDENTIALS",
      "This link is invalid or has expired.",
      400,
    );
  }

  return token;
}
