import type { Pool } from "pg";
import { getOryCMSPool } from "@/lib/db";
import { OryCMSAuthError } from "@/auth";
import { clearOryCMSPermissionCache } from "@/rbac";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface OryCMSRoleRecord {
  id: string;
  name: string;
  description: string | null;
}

export interface OryCMSPermissionRecord {
  id: string;
  name: string;
  resource: string;
  action: string;
}

// ── Roles ──────────────────────────────────────────────────────────────────────

export async function listOryCMSRoles(pool: Pool = getOryCMSPool()): Promise<OryCMSRoleRecord[]> {
  const result = await pool.query<OryCMSRoleRecord>(
    `SELECT id, name, description FROM orycms_roles ORDER BY name ASC`,
  );
  return result.rows;
}

export async function getOryCMSRole(
  id: string,
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSRoleRecord> {
  const result = await pool.query<OryCMSRoleRecord>(
    `SELECT id, name, description FROM orycms_roles WHERE id = $1 LIMIT 1`,
    [id],
  );
  const role = result.rows[0];
  if (!role) throw new OryCMSAuthError("UNAUTHORIZED", "Role not found.", 404);
  return role;
}

export async function createOryCMSRole(
  input: { name: string; description?: string | null },
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSRoleRecord> {
  const result = await pool.query<OryCMSRoleRecord>(
    `INSERT INTO orycms_roles (id, name, description)
     VALUES (gen_random_uuid(), $1, $2)
     RETURNING id, name, description`,
    [input.name, input.description ?? null],
  );
  return result.rows[0];
}

export async function updateOryCMSRole(
  id: string,
  input: { name?: string; description?: string | null },
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSRoleRecord> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (input.name !== undefined) {
    sets.push(`name = $${i++}`);
    values.push(input.name);
  }
  if (input.description !== undefined) {
    sets.push(`description = $${i++}`);
    values.push(input.description);
  }
  if (sets.length === 0) return getOryCMSRole(id, pool);

  values.push(id);
  const result = await pool.query<OryCMSRoleRecord>(
    `UPDATE orycms_roles SET ${sets.join(", ")} WHERE id = $${i}
     RETURNING id, name, description`,
    values,
  );
  const role = result.rows[0];
  if (!role) throw new OryCMSAuthError("UNAUTHORIZED", "Role not found.", 404);
  clearOryCMSPermissionCache();
  return role;
}

export async function deleteOryCMSRole(id: string, pool: Pool = getOryCMSPool()): Promise<void> {
  await pool.query(`DELETE FROM orycms_roles WHERE id = $1`, [id]);
  clearOryCMSPermissionCache();
}

// ── Role ↔ permission assignment ────────────────────────────────────────────────

export async function getOryCMSRolePermissions(
  roleId: string,
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSPermissionRecord[]> {
  const result = await pool.query<OryCMSPermissionRecord>(
    `SELECT p.id, p.name, p.resource, p.action
     FROM orycms_permissions p
     JOIN orycms_role_permissions rp ON rp."permissionId" = p.id
     WHERE rp."roleId" = $1
     ORDER BY p.resource, p.action`,
    [roleId],
  );
  return result.rows;
}

/**
 * Replace the full permission set for a role. Deletes existing assignments,
 * then inserts the given permission ids. Clears the RBAC cache so the change
 * takes effect immediately.
 */
export async function setOryCMSRolePermissions(
  roleId: string,
  permissionIds: string[],
  pool: Pool = getOryCMSPool(),
): Promise<void> {
  await pool.query(`DELETE FROM orycms_role_permissions WHERE "roleId" = $1`, [roleId]);
  for (const permissionId of permissionIds) {
    await pool.query(
      `INSERT INTO orycms_role_permissions ("roleId", "permissionId")
       SELECT $1, $2
       WHERE NOT EXISTS (
         SELECT 1 FROM orycms_role_permissions WHERE "roleId" = $1 AND "permissionId" = $2
       )`,
      [roleId, permissionId],
    );
  }
  clearOryCMSPermissionCache();
}

export async function listOryCMSPermissions(
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSPermissionRecord[]> {
  const result = await pool.query<OryCMSPermissionRecord>(
    `SELECT id, name, resource, action FROM orycms_permissions ORDER BY resource, action`,
  );
  return result.rows;
}
