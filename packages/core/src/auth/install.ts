import type { Pool } from "pg";

/** Install only the tables required by setup, login, and authenticated sessions. */
export async function installOryCMSAuthSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE TABLE IF NOT EXISTS orycms_roles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS orycms_users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL UNIQUE,
      "passwordHash" text NOT NULL,
      status text NOT NULL DEFAULT 'active',
      "roleId" uuid REFERENCES orycms_roles(id),
      "createdAt" timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS orycms_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" uuid NOT NULL REFERENCES orycms_users(id) ON DELETE CASCADE,
      "tokenHash" text NOT NULL UNIQUE,
      "expiresAt" timestamptz NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS orycms_sessions_user_id_idx ON orycms_sessions ("userId");
  `);
}
