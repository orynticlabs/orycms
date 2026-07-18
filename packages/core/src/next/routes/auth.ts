import {
  SESSION_COOKIE,
  OryCMSAuthError,
  hasOryCMSInitialUser,
  createOryCMSInitialOwner,
  authenticateOryCMSUser,
  createOryCMSUserSession,
  destroyOryCMSUserSession,
  destroyOryCMSUserSessions,
  getOryCMSCurrentSession,
  protectOryCMSAdminRoute,
  dispatchOryCMSTokenLink,
} from "@/auth";
import { getOryCMSUserPermissions } from "@/rbac";
import { getOryCMSPool } from "@/lib/db";
import { guardOryCMS, toErrorResponse, oryJsonOk } from "@/lib/route-guards";
import { bootstrapOryCMS } from "@/core";
import { createOryCMSUser, updateOryCMSUser, findOryCMSUserByEmail, setOryCMSUserStatus } from "@/users";
import { createOryCMSToken, consumeOryCMSToken } from "@/tokens";
import { recordOryCMSAuditLog } from "@/audit";
import type { OryCMSRoute } from "../dispatcher";
import {
  jsonOk,
  jsonError,
  jsonWithSession,
  jsonClearingSession,
  readCookie,
  readJsonBody,
  statusError,
} from "../http";

// POST /auth/setup — provision the first Owner (installs schema + seeds), no cookie.
const setup: OryCMSRoute = {
  method: "POST",
  pattern: "auth/setup",
  handler: async ({ request }) => {
    const { email = "", password = "" } = await readJsonBody<{ email?: string; password?: string }>(
      request,
    );
    if (!email || !password) {
      return jsonError("VALIDATION_ERROR", "Email and password are required.", 422);
    }
    const pool = getOryCMSPool();
    const bootstrap = await bootstrapOryCMS(pool);
    if (!bootstrap.install.success) {
      return jsonError(
        "SCHEMA_INSTALL_FAILED",
        "Could not install the OryCMS database schema. Check the database connection.",
        500,
      );
    }
    try {
      const user = await createOryCMSInitialOwner(pool, { email, password });
      return jsonOk({ userId: user.id, email: user.email }, 201);
    } catch (err) {
      if (err instanceof OryCMSAuthError) {
        return jsonError(err.code, err.message, err.statusCode);
      }
      return jsonError("INTERNAL_ERROR", "Setup failed.", 500);
    }
  },
};

// GET /auth/setup-status — has any user been created yet?
const setupStatus: OryCMSRoute = {
  method: "GET",
  pattern: "auth/setup-status",
  handler: async () => {
    try {
      const initialized = await hasOryCMSInitialUser(getOryCMSPool());
      return jsonOk({ initialized });
    } catch {
      return jsonError("DB_ERROR", "Could not check setup status.", 503);
    }
  },
};

// GET /auth/session — return the current authenticated session.
const session: OryCMSRoute = {
  method: "GET",
  pattern: "auth/session",
  handler: async ({ request }) => {
    try {
      const s = await protectOryCMSAdminRoute(request);
      return jsonOk(s);
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};

// POST /auth/login — authenticate and start a session (sets cookie).
const login: OryCMSRoute = {
  method: "POST",
  pattern: "auth/login",
  handler: async ({ request }) => {
    const { email = "", password = "" } = await readJsonBody<{ email?: string; password?: string }>(
      request,
    );
    if (!email || !password) {
      return jsonError("VALIDATION_ERROR", "Email and password are required.", 422);
    }
    try {
      const pool = getOryCMSPool();
      const user = await authenticateOryCMSUser(pool, email, password);
      const rawToken = await createOryCMSUserSession(pool, user.id);
      return jsonWithSession({ userId: user.id, email: user.email }, rawToken);
    } catch (err) {
      if (err instanceof OryCMSAuthError) {
        return jsonError(err.code, err.message, err.statusCode);
      }
      return jsonError("INTERNAL_ERROR", "Login failed.", 500);
    }
  },
};

// POST /auth/logout — destroy the session and clear the cookie.
const logout: OryCMSRoute = {
  method: "POST",
  pattern: "auth/logout",
  handler: async ({ request }) => {
    const rawToken = readCookie(request, SESSION_COOKIE);
    if (rawToken) {
      try {
        await destroyOryCMSUserSession(getOryCMSPool(), rawToken);
      } catch {
        // Best-effort: clear the cookie regardless.
      }
    }
    return jsonClearingSession(null);
  },
};

// GET /auth/me — current user, role, and flat permission list.
const me: OryCMSRoute = {
  method: "GET",
  pattern: "auth/me",
  handler: async ({ request }) => {
    try {
      const s = await protectOryCMSAdminRoute(request);
      const permissions = s.roleName
        ? Array.from(await getOryCMSUserPermissions(s.roleName))
        : [];
      return oryJsonOk({
        user: { id: s.userId, email: s.email },
        roleName: s.roleName,
        permissions,
      });
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};

// POST /auth/refresh — rotate the session token (revokes the old one).
const refresh: OryCMSRoute = {
  method: "POST",
  pattern: "auth/refresh",
  handler: async ({ request }) => {
    try {
      const rawToken = readCookie(request, SESSION_COOKIE);
      if (!rawToken) {
        return toErrorResponse(statusError("UNAUTHORIZED", "Authentication required.", 401));
      }
      const pool = getOryCMSPool();
      const s = await getOryCMSCurrentSession(pool, rawToken);
      if (!s) {
        return toErrorResponse(statusError("SESSION_EXPIRED", "Session expired or invalid.", 401));
      }
      const newToken = await createOryCMSUserSession(pool, s.userId);
      await destroyOryCMSUserSession(pool, rawToken);
      return jsonWithSession({ refreshed: true }, newToken);
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};

// POST /auth/invite — invite a new user (guarded users:create).
const invite: OryCMSRoute = {
  method: "POST",
  pattern: "auth/invite",
  handler: async ({ request }) => {
    try {
      const s = await guardOryCMS(request, "users", "create");
      const body = await readJsonBody<{ email?: string; roleId?: string | null }>(request);
      if (!body.email) {
        return toErrorResponse(statusError("VALIDATION_ERROR", "Email is required.", 422));
      }
      const email = body.email.toLowerCase().trim();
      const user = await createOryCMSUser({ email, roleId: body.roleId ?? null, status: "pending" });
      const rawToken = await createOryCMSToken({
        type: "invite",
        email,
        userId: user.id,
        metadata: { roleId: body.roleId ?? null },
      });
      const dispatched = await dispatchOryCMSTokenLink(request, "invite", email, rawToken);
      await recordOryCMSAuditLog({
        userId: s.userId,
        action: "invite",
        resource: "users",
        resourceId: user.id,
        metadata: { email, emailed: dispatched.emailed },
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      });
      return oryJsonOk(
        { userId: user.id, email, emailed: dispatched.emailed, inviteLink: dispatched.link },
        201,
      );
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};

// POST /auth/accept-invite — set password, activate, sign in (sets cookie).
const acceptInvite: OryCMSRoute = {
  method: "POST",
  pattern: "auth/accept-invite",
  handler: async ({ request }) => {
    try {
      const body = await readJsonBody<{ token?: string; password?: string }>(request);
      if (!body.token || !body.password) {
        return toErrorResponse(statusError("VALIDATION_ERROR", "Token and password are required.", 422));
      }
      const pool = getOryCMSPool();
      const token = await consumeOryCMSToken("invite", body.token, pool);
      if (!token.userId) {
        return toErrorResponse(
          statusError("INVALID_CREDENTIALS", "This invite is not linked to an account.", 400),
        );
      }
      await updateOryCMSUser(token.userId, { password: body.password, status: "active" }, pool);
      const rawToken = await createOryCMSUserSession(pool, token.userId);
      await recordOryCMSAuditLog({
        userId: token.userId,
        action: "accept-invite",
        resource: "users",
        resourceId: token.userId,
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      });
      return jsonWithSession({ userId: token.userId, email: token.email }, rawToken);
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};

// POST /auth/forgot-password — always 200 (no enumeration).
const forgotPassword: OryCMSRoute = {
  method: "POST",
  pattern: "auth/forgot-password",
  handler: async ({ request }) => {
    try {
      const body = await readJsonBody<{ email?: string }>(request);
      const email = (body.email ?? "").toLowerCase().trim();
      const generic = jsonOk({
        message: "If an account exists for that email, a reset link has been sent.",
      });
      if (!email) return generic;

      const pool = getOryCMSPool();
      const user = await findOryCMSUserByEmail(email, pool);
      if (!user) {
        await recordOryCMSAuditLog({
          action: "forgot-password",
          resource: "auth",
          metadata: { email, found: false },
          ipAddress: request.headers.get("x-forwarded-for"),
          userAgent: request.headers.get("user-agent"),
        }).catch(() => {});
        return generic;
      }
      const rawToken = await createOryCMSToken({ type: "reset", email, userId: user.id }, pool);
      const dispatched = await dispatchOryCMSTokenLink(request, "reset", email, rawToken);
      await recordOryCMSAuditLog({
        userId: user.id,
        action: "forgot-password",
        resource: "auth",
        resourceId: user.id,
        metadata: { emailed: dispatched.emailed },
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      }).catch(() => {});
      return jsonOk({
        message: "If an account exists for that email, a reset link has been sent.",
        resetLink: dispatched.link,
      });
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};

// POST /auth/reset-password — set new password, revoke all sessions.
const resetPassword: OryCMSRoute = {
  method: "POST",
  pattern: "auth/reset-password",
  handler: async ({ request }) => {
    try {
      const body = await readJsonBody<{ token?: string; password?: string }>(request);
      if (!body.token || !body.password) {
        return toErrorResponse(statusError("VALIDATION_ERROR", "Token and password are required.", 422));
      }
      const pool = getOryCMSPool();
      const token = await consumeOryCMSToken("reset", body.token, pool);
      if (!token.userId) {
        return toErrorResponse(
          statusError("INVALID_CREDENTIALS", "This reset link is not linked to an account.", 400),
        );
      }
      await updateOryCMSUser(token.userId, { password: body.password }, pool);
      await destroyOryCMSUserSessions(pool, token.userId);
      await recordOryCMSAuditLog({
        userId: token.userId,
        action: "reset-password",
        resource: "auth",
        resourceId: token.userId,
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      }).catch(() => {});
      return jsonOk({ message: "Password updated. Please sign in with your new password." });
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};

// POST /auth/activate — activate an account via activation token.
const activate: OryCMSRoute = {
  method: "POST",
  pattern: "auth/activate",
  handler: async ({ request }) => {
    try {
      const body = await readJsonBody<{ token?: string }>(request);
      if (!body.token) {
        return toErrorResponse(statusError("VALIDATION_ERROR", "Token is required.", 422));
      }
      const pool = getOryCMSPool();
      const token = await consumeOryCMSToken("activation", body.token, pool);
      if (!token.userId) {
        return toErrorResponse(
          statusError("INVALID_CREDENTIALS", "This activation link is not linked to an account.", 400),
        );
      }
      await setOryCMSUserStatus(token.userId, "active", pool);
      await recordOryCMSAuditLog({
        userId: token.userId,
        action: "activate",
        resource: "users",
        resourceId: token.userId,
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      }).catch(() => {});
      return jsonOk({ userId: token.userId, email: token.email, status: "active" });
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};

export const authRoutes: OryCMSRoute[] = [
  setup,
  setupStatus,
  session,
  login,
  logout,
  me,
  refresh,
  invite,
  acceptInvite,
  forgotPassword,
  resetPassword,
  activate,
];
