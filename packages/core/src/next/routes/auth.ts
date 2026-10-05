import {
  SESSION_COOKIE,
  OryCMSAuthError,
  authenticateOryCMSUser,
  createOryCMSInitialOwner,
  createOryCMSUserSession,
  destroyOryCMSUserSession,
  hasOryCMSInitialUser,
  protectOryCMSAdminRoute,
} from "@/auth";
import { bootstrapOryCMS } from "@/core";
import { getOryCMSUserPermissions } from "@/rbac";
import { getOryCMSPool } from "@/lib/db";
import type { OryCMSRoute } from "../dispatcher";
import {
  jsonClearingSession,
  jsonError,
  jsonOk,
  jsonRaw,
  jsonWithSession,
  readCookie,
  readJsonBody,
} from "../http";

const setup: OryCMSRoute = {
  method: "POST",
  pattern: "auth/setup",
  handler: async ({ request }) => {
    const { email = "", password = "" } = await readJsonBody<{ email?: string; password?: string }>(
      request,
    );
    if (!email || !password)
      return jsonError("VALIDATION_ERROR", "Email and password are required.", 422);
    try {
      const pool = getOryCMSPool();
      // Install the core schema (11 tables) AND seed the default roles + permission
      // matrix before creating the Owner, so a fresh database works end-to-end.
      // bootstrapOryCMS is idempotent — safe to re-run.
      const bootstrap = await bootstrapOryCMS(pool);
      if (!bootstrap.install.success) {
        return jsonError(
          "SCHEMA_INSTALL_FAILED",
          "Could not install the OryCMS database schema. Check the database connection.",
          500,
        );
      }
      const user = await createOryCMSInitialOwner(pool, { email, password });
      return jsonOk({ userId: user.id, email: user.email }, 201);
    } catch (error) {
      if (error instanceof OryCMSAuthError)
        return jsonError(error.code, error.message, error.statusCode);
      return jsonError("SETUP_FAILED", "Setup failed. Check ORYCMS_DATABASE_URL.", 500);
    }
  },
};

const setupStatus: OryCMSRoute = {
  method: "GET",
  pattern: "auth/setup-status",
  handler: async () => {
    try {
      const pool = getOryCMSPool();
      return jsonOk({ initialized: await hasOryCMSInitialUser(pool) });
    } catch {
      return jsonError("DB_ERROR", "Could not connect to the OryCMS database.", 503);
    }
  },
};

const login: OryCMSRoute = {
  method: "POST",
  pattern: "auth/login",
  handler: async ({ request }) => {
    const { email = "", password = "" } = await readJsonBody<{ email?: string; password?: string }>(
      request,
    );
    if (!email || !password)
      return jsonError("VALIDATION_ERROR", "Email and password are required.", 422);
    try {
      const pool = getOryCMSPool();
      const user = await authenticateOryCMSUser(pool, email, password);
      return jsonWithSession(
        { userId: user.id, email: user.email },
        await createOryCMSUserSession(pool, user.id),
      );
    } catch (error) {
      if (error instanceof OryCMSAuthError)
        return jsonError(error.code, error.message, error.statusCode);
      return jsonError("LOGIN_FAILED", "Login failed.", 500);
    }
  },
};

// GET /auth/session — matches root's app/api/orycms/auth/session/route.ts exactly:
// success nests the session under `user`; ANY failure returns {success:false,data:null}
// (no error object) with the failure's status code (or 500 for a non-auth error).
const sessionRoute: OryCMSRoute = {
  method: "GET",
  pattern: "auth/session",
  handler: async ({ request }) => {
    try {
      const value = await protectOryCMSAdminRoute(request);
      return jsonOk({ user: value });
    } catch (error) {
      if (error instanceof OryCMSAuthError)
        return jsonRaw({ success: false, data: null }, error.statusCode);
      return jsonRaw({ success: false, data: null }, 500);
    }
  },
};

// GET /auth/me — matches root's app/api/orycms/auth/me/route.ts: the flat
// user/roleName/permissions shape, with the REAL permission list for the role.
const meRoute: OryCMSRoute = {
  method: "GET",
  pattern: "auth/me",
  handler: async ({ request }) => {
    try {
      const value = await protectOryCMSAdminRoute(request);
      const permissions = value.roleName
        ? Array.from(await getOryCMSUserPermissions(value.roleName))
        : [];
      return jsonOk({
        user: { id: value.userId, email: value.email },
        roleName: value.roleName,
        permissions,
      });
    } catch (error) {
      if (error instanceof OryCMSAuthError)
        return jsonError(error.code, error.message, error.statusCode);
      return jsonError("SESSION_FAILED", "Could not read session.", 500);
    }
  },
};

const logout: OryCMSRoute = {
  method: "POST",
  pattern: "auth/logout",
  handler: async ({ request }) => {
    const token = readCookie(request, SESSION_COOKIE);
    if (token) await destroyOryCMSUserSession(getOryCMSPool(), token).catch(() => {});
    return jsonClearingSession(null);
  },
};

export const authRoutes: OryCMSRoute[] = [setup, setupStatus, login, logout, sessionRoute, meRoute];
