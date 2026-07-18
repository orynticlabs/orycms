import type { Pool } from "pg";
import { getOryCMSPool } from "@/lib/db";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface OryCMSSettingRecord {
  key: string;
  value: unknown;
  description: string | null;
}

// ── Read ───────────────────────────────────────────────────────────────────────

export async function getAllOryCMSSettings(
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSSettingRecord[]> {
  const result = await pool.query<OryCMSSettingRecord>(
    `SELECT key, value, description FROM orycms_settings ORDER BY key ASC`,
  );
  return result.rows;
}

export async function getOryCMSSetting(
  key: string,
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSSettingRecord | null> {
  const result = await pool.query<OryCMSSettingRecord>(
    `SELECT key, value, description FROM orycms_settings WHERE key = $1 LIMIT 1`,
    [key],
  );
  return result.rows[0] ?? null;
}

// ── Write ──────────────────────────────────────────────────────────────────────

/** Upsert a setting by key. value is stored as JSON. */
export async function setOryCMSSetting(
  key: string,
  value: unknown,
  description: string | null = null,
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSSettingRecord> {
  const result = await pool.query<OryCMSSettingRecord>(
    `INSERT INTO orycms_settings (id, key, value, description)
     VALUES (gen_random_uuid(), $1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description
     RETURNING key, value, description`,
    [key, JSON.stringify(value), description],
  );
  return result.rows[0];
}
