import type { Pool } from "pg";
import { getOryCMSPool } from "@/lib/db";
import { OryCMSAuthError } from "@/auth";
import type { OryCMSSessionData } from "@/auth";

// ── Resource / action types ───────────────────────────────────────────────────

export type OryCMSResource =
  | "collections"
  | "content"
  | "media"
  | "users"
  | "roles"
  | "plugins"
  | "settings"
  | "migrations"
  | "seo";

export type OryCMSAction = "create" | "read" | "update" | "delete" | "publish" | "manage";

// ── Default role permission matrix ────────────────────────────────────────────

type PermMatrix = Record<string, Record<string, OryCMSAction[]>>;

const M: OryCMSAction[] = ["manage"];
const CRUD: OryCMSAction[] = ["create", "read", "update", "delete"];
const CRUDP: OryCMSAction[] = ["create", "read", "update", "delete", "publish"];

export const ORYCMS_DEFAULT_PERMISSIONS: PermMatrix = {
  Owner: {
    collections: M,
    content: M,
    media: M,
    users: M,
    roles: M,
    plugins: M,
    settings: M,
    migrations: M,
    seo: M,
  },
  Admin: {
    collections: M,
    content: M,
    media: M,
    users: CRUD,
    roles: ["read"],
    plugins: M,
    settings: M,
    migrations: M,
    seo: M,
  },
  Editor: {
    collections: ["read"],
    content: CRUDP,
    media: CRUD,
    users: ["read"],
    seo: CRUD,
  },
  Author: {
    collections: ["read"],
    content: ["create", "read", "update"],
    media: ["create", "read"],
  },
  Viewer: {
    collections: ["read"],
    content: ["read"],
    media: ["read"],
    seo: ["read"],
  },
};

// ── Request-level TTL permission cache ────────────────────────────────────────

// ponytail: module-level TTL; per-role entry; upgrade to Redis if multi-instance
const _cache = new Map<string, { perms: Set<string>; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export function clearOryCMSPermissionCache(): void {
  _cache.clear();
}

// ── Seed functions ────────────────────────────────────────────────────────────

export async function syncOryCMSDefaultRoles(pool: Pool = getOryCMSPool()): Promise<void> {
  for (const name of Object.keys(ORYCMS_DEFAULT_PERMISSIONS)) {
    await pool.query(
      `INSERT INTO orycms_roles (id, name)
       VALUES (gen_random_uuid(), $1)
       ON CONFLICT (name) DO NOTHING`,
      [name],
    );
  }
}

export async function syncOryCMSDefaultPermissions(pool: Pool = getOryCMSPool()): Promise<void> {
  for (const [roleName, resources] of Object.entries(ORYCMS_DEFAULT_PERMISSIONS)) {
    const roleRes = await pool.query<{ id: string }>(
      `SELECT id FROM orycms_roles WHERE name = $1`,
      [roleName],
    );
    const roleId = roleRes.rows[0]?.id;
    if (!roleId) continue;

    for (const [resource, actions] of Object.entries(resources)) {
      for (const action of actions) {
        const permName = `${resource}:${action}`;
        const permRes = await pool.query<{ id: string }>(
          `INSERT INTO orycms_permissions (id, name, resource, action)
           VALUES (gen_random_uuid(), $1, $2, $3)
           ON CONFLICT (name) DO UPDATE SET resource = EXCLUDED.resource, action = EXCLUDED.action
           RETURNING id`,
          [permName, resource, action],
        );
        const permId = permRes.rows[0]?.id;
        if (!permId) continue;

        // Guard against missing unique constraint on (roleId, permissionId)
        await pool.query(
          `INSERT INTO orycms_role_permissions ("roleId", "permissionId")
           SELECT $1, $2
           WHERE NOT EXISTS (
             SELECT 1 FROM orycms_role_permissions WHERE "roleId" = $1 AND "permissionId" = $2
           )`,
          [roleId, permId],
        );
      }
    }
  }
}

// ── Permission query (with cache) ─────────────────────────────────────────────

export async function getOryCMSUserPermissions(
  roleName: string,
  pool: Pool = getOryCMSPool(),
): Promise<Set<string>> {
  const cached = _cache.get(roleName);
  if (cached && cached.expiresAt > Date.now()) return cached.perms;

  const res = await pool.query<{ resource: string; action: string }>(
    `SELECT p.resource, p.action
     FROM orycms_permissions p
     JOIN orycms_role_permissions rp ON rp."permissionId" = p.id
     JOIN orycms_roles r ON r.id = rp."roleId"
     WHERE r.name = $1`,
    [roleName],
  );

  const perms = new Set(res.rows.map((row) => `${row.resource}:${row.action}`));
  _cache.set(roleName, { perms, expiresAt: Date.now() + CACHE_TTL_MS });
  return perms;
}

// ── Permission checks ─────────────────────────────────────────────────────────

export async function hasOryCMSPermission(
  roleName: string | null,
  resource: OryCMSResource,
  action: OryCMSAction,
  pool: Pool = getOryCMSPool(),
): Promise<boolean> {
  if (!roleName) return false;
  const perms = await getOryCMSUserPermissions(roleName, pool);
  // manage implies all actions on the same resource
  return perms.has(`${resource}:${action}`) || perms.has(`${resource}:manage`);
}

export async function requireOryCMSPermission(
  session: Pick<OryCMSSessionData, "roleName">,
  resource: OryCMSResource,
  action: OryCMSAction,
  pool: Pool = getOryCMSPool(),
): Promise<void> {
  const allowed = await hasOryCMSPermission(session.roleName, resource, action, pool);
  if (!allowed) {
    throw new OryCMSAuthError("FORBIDDEN", `Permission denied: ${resource}:${action}.`, 403);
  }
}
