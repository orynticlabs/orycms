import { getOryCMSPool } from "@/lib/db";
import { guardOryCMS, oryJsonOk } from "@/lib/route-guards";
import { getOryCMSUserPermissions } from "@/rbac";
import { getOryCMSRolePermissions } from "@/roles";
import {
  listOryCMSUsers,
  createOryCMSUser,
  getOryCMSUser,
  updateOryCMSUser,
  deleteOryCMSUser,
} from "@/users";
import { recordOryCMSAuditLog } from "@/audit";
import type { OryCMSRoute } from "../dispatcher";
import { statusError } from "../http";
import { readObjectBody } from "../request-body";
import { safeRouteError } from "../route-errors";

// ── Rules ───────────────────────────────────────────────────────────────────────

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 254;
const PASSWORD_MIN = 8;
/** bcrypt uses only the first 72 bytes of a password, so longer values are refused. */
const PASSWORD_MAX_BYTES = 72;
const ROLE_ID_MAX = 64;
const STATUSES = ["active", "inactive", "pending"] as const;
type UserStatus = (typeof STATUSES)[number];

/** Postgres SQLSTATE for a unique-constraint violation. */
const UNIQUE_VIOLATION = "23505";

// ── Helpers ─────────────────────────────────────────────────────────────────────

const invalid = (message: string): Error => statusError("VALIDATION_ERROR", message, 422);
const conflict = (code: string, message: string): Error => statusError(code, message, 409);

type UserFields = {
  email?: string;
  password?: string;
  roleId?: string | null;
  status?: UserStatus;
};

/**
 * Validates the body fields. `requireEmail` is true for create. Unknown keys are ignored.
 * A key that is absent is left out, so an update changes only what it names.
 */
function parseUserFields(body: Record<string, unknown>, requireEmail: boolean): UserFields {
  const out: UserFields = {};

  if (body.email === undefined) {
    if (requireEmail) throw invalid("Email is required.");
  } else {
    if (typeof body.email !== "string") throw invalid("Email is invalid.");
    const email = body.email.trim();
    if (email.length === 0 || email.length > EMAIL_MAX || !EMAIL_PATTERN.test(email)) {
      throw invalid("Email is invalid.");
    }
    out.email = email;
  }

  if (body.password !== undefined) {
    if (typeof body.password !== "string" || body.password.length < PASSWORD_MIN) {
      throw invalid(`Password must be at least ${PASSWORD_MIN} characters.`);
    }
    if (Buffer.byteLength(body.password, "utf8") > PASSWORD_MAX_BYTES) {
      throw invalid(`Password must be at most ${PASSWORD_MAX_BYTES} bytes.`);
    }
    out.password = body.password;
  }

  if (body.roleId !== undefined) {
    if (body.roleId === null) {
      out.roleId = null;
    } else if (
      typeof body.roleId === "string" &&
      body.roleId.length > 0 &&
      body.roleId.length <= ROLE_ID_MAX
    ) {
      out.roleId = body.roleId;
    } else {
      throw invalid("Role id must be a non-empty string or null.");
    }
  }

  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as UserStatus)) {
      throw invalid(`Status must be one of ${STATUSES.join(", ")}.`);
    }
    out.status = body.status as UserStatus;
  }

  return out;
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: unknown } | null)?.code === UNIQUE_VIOLATION;
}

/** Confirms the role exists. A role id that matches nothing is a validation error. */
async function assertRoleExists(roleId: string): Promise<void> {
  const pool = getOryCMSPool();
  const result = await pool.query<{ id: string }>(
    `SELECT id FROM orycms_roles WHERE id = $1 LIMIT 1`,
    [roleId],
  );
  if (result.rows.length === 0) throw invalid("Role not found.");
}

/**
 * Refuses unless the caller holds every permission the role carries (directly or through
 * `resource:manage`). This stops a caller from assigning, or acting on, a stronger role.
 */
async function requireHeldPermissions(
  callerRoleName: string | null,
  roleId: string,
  message: string,
): Promise<void> {
  const pool = getOryCMSPool();
  const held = callerRoleName
    ? await getOryCMSUserPermissions(callerRoleName, pool)
    : new Set<string>();
  const perms = await getOryCMSRolePermissions(roleId, pool);
  for (const perm of perms) {
    const ok = held.has(`${perm.resource}:${perm.action}`) || held.has(`${perm.resource}:manage`);
    if (!ok) throw statusError("FORBIDDEN", message, 403);
  }
}

/** Counts the other active users who hold the Owner role. */
async function countOtherActiveOwners(userId: string): Promise<number> {
  const pool = getOryCMSPool();
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM orycms_users u
     JOIN orycms_roles r ON r.id = u."roleId"
     WHERE r.name = 'Owner' AND u.status = 'active' AND u.id <> $1`,
    [userId],
  );
  return Number(result.rows[0]?.count ?? 0);
}

// ── Routes ──────────────────────────────────────────────────────────────────────

const listUsers: OryCMSRoute = {
  method: "GET",
  pattern: "users",
  handler: async ({ request }) => {
    try {
      await guardOryCMS(request, "users", "read");
      return oryJsonOk(await listOryCMSUsers());
    } catch (err) {
      return safeRouteError("users.list", err);
    }
  },
};

const createUser: OryCMSRoute = {
  method: "POST",
  pattern: "users",
  handler: async ({ request }) => {
    try {
      const session = await guardOryCMS(request, "users", "create");
      const fields = parseUserFields(await readObjectBody(request), true);
      if (fields.roleId) {
        await assertRoleExists(fields.roleId);
        await requireHeldPermissions(
          session.roleName,
          fields.roleId,
          "You cannot assign a role with permissions you do not hold.",
        );
      }
      let user;
      try {
        user = await createOryCMSUser({
          email: fields.email as string,
          password: fields.password,
          roleId: fields.roleId,
          status: fields.status,
        });
      } catch (err) {
        if (isUniqueViolation(err))
          throw conflict("EMAIL_TAKEN", "A user with this email already exists.");
        throw err;
      }
      await recordOryCMSAuditLog({
        userId: session.userId,
        action: "create",
        resource: "users",
        resourceId: user.id,
        metadata: { email: user.email },
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      });
      return oryJsonOk(user, 201);
    } catch (err) {
      return safeRouteError("users.create", err);
    }
  },
};

const getUser: OryCMSRoute = {
  method: "GET",
  pattern: "users/:id",
  handler: async ({ request, params }) => {
    try {
      await guardOryCMS(request, "users", "read");
      return oryJsonOk(await getOryCMSUser(params.id));
    } catch (err) {
      return safeRouteError("users.get", err);
    }
  },
};

const updateUser: OryCMSRoute = {
  method: "PATCH",
  pattern: "users/:id",
  handler: async ({ request, params }) => {
    try {
      const session = await guardOryCMS(request, "users", "update");
      const target = await getOryCMSUser(params.id);
      const fields = parseUserFields(await readObjectBody(request), false);
      const isSelf = session.userId === params.id;

      const roleChanges = fields.roleId !== undefined && fields.roleId !== target.roleId;
      const statusChanges = fields.status !== undefined && fields.status !== target.status;
      if (isSelf && (roleChanges || (statusChanges && fields.status !== "active"))) {
        throw conflict(
          "SELF_ACTION",
          "You cannot change your own role or deactivate your own account.",
        );
      }

      if (target.roleId) {
        await requireHeldPermissions(
          session.roleName,
          target.roleId,
          "You cannot change a user whose role has permissions you do not hold.",
        );
      }
      if (fields.roleId) {
        await assertRoleExists(fields.roleId);
        await requireHeldPermissions(
          session.roleName,
          fields.roleId,
          "You cannot assign a role with permissions you do not hold.",
        );
      }

      const losesOwner =
        target.roleName === "Owner" &&
        target.status === "active" &&
        (roleChanges || (statusChanges && fields.status !== "active"));
      if (losesOwner && (await countOtherActiveOwners(params.id)) === 0) {
        throw conflict("LAST_OWNER", "This is the last active Owner. Assign another Owner first.");
      }

      const user = await updateOryCMSUser(params.id, fields);
      await recordOryCMSAuditLog({
        userId: session.userId,
        action: "update",
        resource: "users",
        resourceId: params.id,
        metadata: { fields: Object.keys(fields) },
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      });
      return oryJsonOk(user);
    } catch (err) {
      return safeRouteError("users.update", err);
    }
  },
};

const deleteUser: OryCMSRoute = {
  method: "DELETE",
  pattern: "users/:id",
  handler: async ({ request, params }) => {
    try {
      const session = await guardOryCMS(request, "users", "delete");
      if (session.userId === params.id) {
        throw conflict("SELF_ACTION", "You cannot delete your own account.");
      }
      const target = await getOryCMSUser(params.id);
      if (target.roleId) {
        await requireHeldPermissions(
          session.roleName,
          target.roleId,
          "You cannot delete a user whose role has permissions you do not hold.",
        );
      }
      if (target.roleName === "Owner" && target.status === "active") {
        if ((await countOtherActiveOwners(params.id)) === 0) {
          throw conflict(
            "LAST_OWNER",
            "This is the last active Owner. Assign another Owner first.",
          );
        }
      }
      await deleteOryCMSUser(params.id);
      await recordOryCMSAuditLog({
        userId: session.userId,
        action: "delete",
        resource: "users",
        resourceId: params.id,
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      });
      return oryJsonOk({ id: params.id, deleted: true });
    } catch (err) {
      return safeRouteError("users.delete", err);
    }
  },
};

export const userRoutes: OryCMSRoute[] = [listUsers, createUser, getUser, updateUser, deleteUser];
