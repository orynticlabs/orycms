import { getOryCMSPool } from "@/lib/db";
import { guardOryCMS, oryJsonOk } from "@/lib/route-guards";
import { getOryCMSUserPermissions } from "@/rbac";
import {
  listOryCMSRoles,
  createOryCMSRole,
  getOryCMSRole,
  updateOryCMSRole,
  deleteOryCMSRole,
  getOryCMSRolePermissions,
  setOryCMSRolePermissions,
  listOryCMSPermissions,
} from "@/roles";
import { recordOryCMSAuditLog } from "@/audit";
import type { OryCMSRoute } from "../dispatcher";
import { statusError } from "../http";
import { readObjectBody } from "../request-body";
import { safeRouteError } from "../route-errors";

// ── Rules ───────────────────────────────────────────────────────────────────────

/** Must match the role names in ORYCMS_DEFAULT_PERMISSIONS (orycms/rbac/rbac.engine.ts). */
const BUILT_IN_ROLE_NAMES: readonly string[] = ["Owner", "Admin", "Editor", "Author", "Viewer"];

const ROLE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9 _-]{0,63}$/;
const ROLE_DESCRIPTION_MAX = 500;
const PERMISSION_ID_MAX_COUNT = 500;
const PERMISSION_ID_MAX_LENGTH = 64;

/** Postgres SQLSTATE for a unique-constraint violation. */
const UNIQUE_VIOLATION = "23505";

// ── Helpers ─────────────────────────────────────────────────────────────────────

const invalid = (message: string): Error => statusError("VALIDATION_ERROR", message, 422);
const conflict = (code: string, message: string): Error => statusError(code, message, 409);

/** Validates the name and description fields. `requireName` is true for create. */
function parseRoleFields(
  body: Record<string, unknown>,
  requireName: boolean,
): { name?: string; description?: string | null } {
  const out: { name?: string; description?: string | null } = {};

  if (body.name === undefined || body.name === "") {
    if (requireName) throw invalid("Role name is required.");
  } else {
    if (typeof body.name !== "string" || !ROLE_NAME_PATTERN.test(body.name)) {
      throw invalid("Role name is invalid.");
    }
    out.name = body.name;
  }

  if (body.description !== undefined) {
    if (
      body.description !== null &&
      (typeof body.description !== "string" || body.description.length > ROLE_DESCRIPTION_MAX)
    ) {
      throw invalid(
        `Role description must be a string of at most ${ROLE_DESCRIPTION_MAX} characters.`,
      );
    }
    out.description = body.description as string | null;
  }

  return out;
}

/** Validates the permission-id list shape. Existence is checked separately. */
function parsePermissionIds(body: Record<string, unknown>): string[] {
  const ids = body.permissionIds;
  if (!Array.isArray(ids)) throw invalid("permissionIds must be an array of permission ids.");
  if (ids.length > PERMISSION_ID_MAX_COUNT) {
    throw invalid(`At most ${PERMISSION_ID_MAX_COUNT} permission ids may be sent.`);
  }
  for (const id of ids) {
    if (typeof id !== "string" || id.length === 0 || id.length > PERMISSION_ID_MAX_LENGTH) {
      throw invalid("Each permission id must be a non-empty string.");
    }
  }
  return ids as string[];
}

/** Built-in roles and the role the caller holds cannot be changed or deleted. */
function assertRoleMutable(role: { name: string }, callerRoleName: string | null): void {
  if (BUILT_IN_ROLE_NAMES.includes(role.name)) {
    throw conflict("BUILT_IN_ROLE", "Built-in roles cannot be changed or deleted.");
  }
  if (callerRoleName !== null && role.name === callerRoleName) {
    throw conflict("SELF_ROLE", "You cannot change the role you hold.");
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: unknown } | null)?.code === UNIQUE_VIOLATION;
}

// ── Routes ──────────────────────────────────────────────────────────────────────

const listRoles: OryCMSRoute = {
  method: "GET",
  pattern: "roles",
  handler: async ({ request }) => {
    try {
      await guardOryCMS(request, "roles", "read");
      return oryJsonOk(await listOryCMSRoles());
    } catch (err) {
      return safeRouteError("roles.list", err);
    }
  },
};

const createRole: OryCMSRoute = {
  method: "POST",
  pattern: "roles",
  handler: async ({ request }) => {
    try {
      const session = await guardOryCMS(request, "roles", "create");
      const fields = parseRoleFields(await readObjectBody(request), true);
      let role;
      try {
        role = await createOryCMSRole({
          name: fields.name as string,
          description: fields.description,
        });
      } catch (err) {
        if (isUniqueViolation(err))
          throw conflict("ROLE_NAME_TAKEN", "A role with this name already exists.");
        throw err;
      }
      await recordOryCMSAuditLog({
        userId: session.userId,
        action: "create",
        resource: "roles",
        resourceId: role.id,
        metadata: { name: role.name },
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      });
      return oryJsonOk(role, 201);
    } catch (err) {
      return safeRouteError("roles.create", err);
    }
  },
};

const getRole: OryCMSRoute = {
  method: "GET",
  pattern: "roles/:id",
  handler: async ({ request, params }) => {
    try {
      await guardOryCMS(request, "roles", "read");
      return oryJsonOk(await getOryCMSRole(params.id));
    } catch (err) {
      return safeRouteError("roles.get", err);
    }
  },
};

const updateRole: OryCMSRoute = {
  method: "PATCH",
  pattern: "roles/:id",
  handler: async ({ request, params }) => {
    try {
      const session = await guardOryCMS(request, "roles", "update");
      const existing = await getOryCMSRole(params.id);
      assertRoleMutable(existing, session.roleName);
      const body = await readObjectBody(request);
      const fields = parseRoleFields(body, false);
      let role;
      try {
        role = await updateOryCMSRole(params.id, fields);
      } catch (err) {
        if (isUniqueViolation(err))
          throw conflict("ROLE_NAME_TAKEN", "A role with this name already exists.");
        throw err;
      }
      await recordOryCMSAuditLog({
        userId: session.userId,
        action: "update",
        resource: "roles",
        resourceId: params.id,
        metadata: { fields: Object.keys(fields) },
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      });
      return oryJsonOk(role);
    } catch (err) {
      return safeRouteError("roles.update", err);
    }
  },
};

const deleteRole: OryCMSRoute = {
  method: "DELETE",
  pattern: "roles/:id",
  handler: async ({ request, params }) => {
    try {
      const session = await guardOryCMS(request, "roles", "delete");
      const existing = await getOryCMSRole(params.id);
      assertRoleMutable(existing, session.roleName);

      const pool = getOryCMSPool();
      const usage = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM orycms_users WHERE "roleId" = $1`,
        [params.id],
      );
      if (Number(usage.rows[0]?.count ?? 0) > 0) {
        throw conflict("ROLE_IN_USE", "This role still has users assigned. Reassign them first.");
      }

      await deleteOryCMSRole(params.id);
      await recordOryCMSAuditLog({
        userId: session.userId,
        action: "delete",
        resource: "roles",
        resourceId: params.id,
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      });
      return oryJsonOk({ id: params.id, deleted: true });
    } catch (err) {
      return safeRouteError("roles.delete", err);
    }
  },
};

const getRolePermissions: OryCMSRoute = {
  method: "GET",
  pattern: "roles/:id/permissions",
  handler: async ({ request, params }) => {
    try {
      await guardOryCMS(request, "roles", "read");
      return oryJsonOk(await getOryCMSRolePermissions(params.id));
    } catch (err) {
      return safeRouteError("roles.permissions.get", err);
    }
  },
};

const setRolePermissions: OryCMSRoute = {
  method: "PUT",
  pattern: "roles/:id/permissions",
  handler: async ({ request, params }) => {
    try {
      const session = await guardOryCMS(request, "roles", "update");
      const existing = await getOryCMSRole(params.id);
      assertRoleMutable(existing, session.roleName);
      const permissionIds = parsePermissionIds(await readObjectBody(request));

      // Unknown ids are rejected, and the caller may grant only what it holds itself.
      const pool = getOryCMSPool();
      const known = new Map((await listOryCMSPermissions(pool)).map((p) => [p.id, p]));
      const callerPerms = session.roleName
        ? await getOryCMSUserPermissions(session.roleName, pool)
        : new Set<string>();
      for (const id of permissionIds) {
        const perm = known.get(id);
        if (!perm) throw invalid("Unknown permission id.");
        const held =
          callerPerms.has(`${perm.resource}:${perm.action}`) ||
          callerPerms.has(`${perm.resource}:manage`);
        if (!held)
          throw statusError("FORBIDDEN", "You cannot grant permissions you do not hold.", 403);
      }

      await setOryCMSRolePermissions(params.id, permissionIds);
      await recordOryCMSAuditLog({
        userId: session.userId,
        action: "update",
        resource: "roles",
        resourceId: params.id,
        metadata: { permissionCount: permissionIds.length },
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      });
      return oryJsonOk({ roleId: params.id, permissionIds });
    } catch (err) {
      return safeRouteError("roles.permissions.set", err);
    }
  },
};

export const roleRoutes: OryCMSRoute[] = [
  listRoles,
  createRole,
  getRole,
  updateRole,
  deleteRole,
  getRolePermissions,
  setRolePermissions,
];
