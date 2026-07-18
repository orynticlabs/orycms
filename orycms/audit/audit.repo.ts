import type { Pool } from "pg";
import { getOryCMSPool } from "@/lib/db";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface OryCMSAuditEntry {
  /** Actor — null for anonymous/system actions (e.g. forgot-password). */
  userId?: string | null;
  /** Verb: create, update, delete, publish, login, invite, migrate, … */
  action: string;
  /** Resource domain: users, roles, content, settings, … */
  resource: string;
  /** Optional target record id. */
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface OryCMSAuditLog extends OryCMSAuditEntry {
  id: string;
  createdAt: string;
}

export interface OryCMSAuditFilter {
  userId?: string;
  resource?: string;
  action?: string;
  limit?: number;
  offset?: number;
}

// ── Write ──────────────────────────────────────────────────────────────────────

/**
 * Append an audit-log row. Best-effort: audit failures must never break the
 * primary action, so callers may ignore rejections. Records createdAt = now().
 */
export async function recordOryCMSAuditLog(
  entry: OryCMSAuditEntry,
  pool: Pool = getOryCMSPool(),
): Promise<void> {
  await pool.query(
    `INSERT INTO orycms_audit_logs
       (id, "userId", action, resource, "resourceId", metadata, "ipAddress", "userAgent", "createdAt")
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW())`,
    [
      entry.userId ?? null,
      entry.action,
      entry.resource,
      entry.resourceId ?? null,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
      entry.ipAddress ?? null,
      entry.userAgent ?? null,
    ],
  );
}

// ── Read ───────────────────────────────────────────────────────────────────────

export async function listOryCMSAuditLogs(
  filter: OryCMSAuditFilter = {},
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSAuditLog[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (filter.userId) {
    conditions.push(`"userId" = $${i++}`);
    values.push(filter.userId);
  }
  if (filter.resource) {
    conditions.push(`resource = $${i++}`);
    values.push(filter.resource);
  }
  if (filter.action) {
    conditions.push(`action = $${i++}`);
    values.push(filter.action);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);
  values.push(limit, offset);

  const result = await pool.query<OryCMSAuditLog>(
    `SELECT id, "userId", action, resource, "resourceId", metadata, "ipAddress", "userAgent", "createdAt"
     FROM orycms_audit_logs
     ${where}
     ORDER BY "createdAt" DESC
     LIMIT $${i++} OFFSET $${i++}`,
    values,
  );

  return result.rows;
}
