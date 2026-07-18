import {
  SESSION_COOKIE,
  OryCMSAuthError,
  authenticateOryCMSUser,
  createOryCMSInitialOwner,
  createOryCMSUserSession,
  destroyOryCMSUserSession,
  hasOryCMSInitialUser,
  installOryCMSAuthSchema,
  protectOryCMSAdminRoute,
} from "@/auth";
import { getOryCMSPool } from "@/lib/db";
import type { OryCMSRoute } from "../dispatcher";
import {
  jsonClearingSession,
  jsonError,
  jsonOk,
  jsonWithSession,
  readCookie,
  readJsonBody,
} from "../http";

const setup: OryCMSRoute = {
  method: "POST",
  pattern: "auth/setup",
  handler: async ({ request }) => {
    const { email = "", password = "" } = await readJsonBody<{ email?: string; password?: string }>(request);
    if (!email || !password) return jsonError("VALIDATION_ERROR", "Email and password are required.", 422);
    try {
      const pool = getOryCMSPool();
      await installOryCMSAuthSchema(pool);
      const user = await createOryCMSInitialOwner(pool, { email, password });
      return jsonOk({ userId: user.id, email: user.email }, 201);
    } catch (error) {
      if (error instanceof OryCMSAuthError) return jsonError(error.code, error.message, error.statusCode);
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
      await installOryCMSAuthSchema(pool);
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
    const { email = "", password = "" } = await readJsonBody<{ email?: string; password?: string }>(request);
    if (!email || !password) return jsonError("VALIDATION_ERROR", "Email and password are required.", 422);
    try {
      const pool = getOryCMSPool();
      const user = await authenticateOryCMSUser(pool, email, password);
      return jsonWithSession({ userId: user.id, email: user.email }, await createOryCMSUserSession(pool, user.id));
    } catch (error) {
      if (error instanceof OryCMSAuthError) return jsonError(error.code, error.message, error.statusCode);
      return jsonError("LOGIN_FAILED", "Login failed.", 500);
    }
  },
};

const session = (pattern: "auth/session" | "auth/me"): OryCMSRoute => ({
  method: "GET",
  pattern,
  handler: async ({ request }) => {
    try {
      const value = await protectOryCMSAdminRoute(request);
      return jsonOk(pattern === "auth/me"
        ? { user: { id: value.userId, email: value.email }, roleName: value.roleName, permissions: [] }
        : value);
    } catch (error) {
      if (error instanceof OryCMSAuthError) return jsonError(error.code, error.message, error.statusCode);
      return jsonError("SESSION_FAILED", "Could not read session.", 500);
    }
  },
});

const logout: OryCMSRoute = {
  method: "POST",
  pattern: "auth/logout",
  handler: async ({ request }) => {
    const token = readCookie(request, SESSION_COOKIE);
    if (token) await destroyOryCMSUserSession(getOryCMSPool(), token).catch(() => {});
    return jsonClearingSession(null);
  },
};

export const authRoutes: OryCMSRoute[] = [setup, setupStatus, login, logout, session("auth/session"), session("auth/me")];
