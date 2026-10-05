import { toErrorResponse, oryJsonOk, guardOryCMS } from "@/lib/route-guards";
import {
  SESSION_COOKIE,
  getOryCMSCurrentSession,
  createOryCMSUserSession,
  destroyOryCMSUserSession,
  destroyOryCMSUserSessions,
} from "@/auth";
import { getOryCMSPool } from "@/lib/db";
import {
  findOryCMSUserByEmail,
  createOryCMSUser,
  updateOryCMSUser,
  setOryCMSUserStatus,
} from "@/users";
import { createOryCMSToken, consumeOryCMSToken } from "@/tokens";
import { dispatchOryCMSTokenLink } from "@/auth/token-links";
import { recordOryCMSAuditLog } from "@/audit";
import type { OryCMSRoute } from "../dispatcher";
import { jsonWithSession, readCookie, readJsonBody, statusError } from "../http";

// Ported from app/api/orycms/auth/{refresh,forgot-password,reset-password,activate,
// invite,accept-invite}/route.ts — see internal/PROGRESS.md's U1-3.2 log entry for
// the full route-by-route parity table and the root inconsistencies found (and
// deliberately NOT fixed here) along the way.

// POST /auth/refresh — rotate the session token.
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
      const session = await getOryCMSCurrentSession(pool, rawToken);
      if (!session) {
        return toErrorResponse(statusError("SESSION_EXPIRED", "Session expired or invalid.", 401));
      }

      const newToken = await createOryCMSUserSession(pool, session.userId);
      await destroyOryCMSUserSession(pool, rawToken);

      return jsonWithSession({ refreshed: true }, newToken);
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};

// POST /auth/forgot-password — public. ALWAYS 200 regardless of whether the email
// exists (no user enumeration via status code/message — see PROGRESS.md for the one
// real shape-based signal root still has, which this port deliberately replicates).
const forgotPassword: OryCMSRoute = {
  method: "POST",
  pattern: "auth/forgot-password",
  handler: async ({ request }) => {
    try {
      const body = await readJsonBody<{ email?: string }>(request);
      const email = (body.email ?? "").toLowerCase().trim();

      const generic = oryJsonOk({
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
      const dispatch = await dispatchOryCMSTokenLink(request, "reset", email, rawToken);

      await recordOryCMSAuditLog({
        userId: user.id,
        action: "forgot-password",
        resource: "auth",
        resourceId: user.id,
        metadata: { emailed: dispatch.emailed },
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      }).catch(() => {});

      return oryJsonOk({
        message: "If an account exists for that email, a reset link has been sent.",
        resetLink: dispatch.link,
      });
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};

// POST /auth/reset-password — public (token-gated). Revokes ALL of the user's
// sessions on success (plural — no hooks fire, unlike the singular logout path).
const resetPassword: OryCMSRoute = {
  method: "POST",
  pattern: "auth/reset-password",
  handler: async ({ request }) => {
    try {
      const body = await readJsonBody<{ token?: string; password?: string }>(request);
      if (!body.token || !body.password) {
        return toErrorResponse(
          statusError("VALIDATION_ERROR", "Token and password are required.", 422),
        );
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

      return oryJsonOk({ message: "Password updated. Please sign in with your new password." });
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};

// POST /auth/activate — public (token-gated). Consumes an activation token.
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
          statusError(
            "INVALID_CREDENTIALS",
            "This activation link is not linked to an account.",
            400,
          ),
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

      return oryJsonOk({ userId: token.userId, email: token.email, status: "active" });
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};

// POST /auth/invite — guarded (users:create). Creates a pending account + invite
// token. NOTE: the audit-log call below is NOT wrapped in .catch() — matching
// root exactly (see PROGRESS.md: a failure here surfaces as a 500 even though the
// user and token were already created, which is a real root inconsistency, not
// fixed here).
const invite: OryCMSRoute = {
  method: "POST",
  pattern: "auth/invite",
  handler: async ({ request }) => {
    try {
      const session = await guardOryCMS(request, "users", "create");
      const body = await readJsonBody<{ email?: string; roleId?: string | null }>(request);
      if (!body.email) {
        return toErrorResponse(statusError("VALIDATION_ERROR", "Email is required.", 422));
      }

      const email = body.email.toLowerCase().trim();
      const user = await createOryCMSUser({
        email,
        roleId: body.roleId ?? null,
        status: "pending",
      });
      const rawToken = await createOryCMSToken({
        type: "invite",
        email,
        userId: user.id,
        metadata: { roleId: body.roleId ?? null },
      });

      const dispatch = await dispatchOryCMSTokenLink(request, "invite", email, rawToken);

      await recordOryCMSAuditLog({
        userId: session.userId,
        action: "invite",
        resource: "users",
        resourceId: user.id,
        metadata: { email, emailed: dispatch.emailed },
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      });

      return oryJsonOk(
        { userId: user.id, email, emailed: dispatch.emailed, inviteLink: dispatch.link },
        201,
      );
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};

// POST /auth/accept-invite — public (token-gated). Consumes the invite, sets the
// password, activates, and logs the user in. NOTE: the audit-log call below is
// also NOT wrapped in .catch() — same root inconsistency as /invite (see
// PROGRESS.md): a failure here surfaces as a 500 even though the password was
// already changed and a session token already minted (just never returned).
const acceptInvite: OryCMSRoute = {
  method: "POST",
  pattern: "auth/accept-invite",
  handler: async ({ request }) => {
    try {
      const body = await readJsonBody<{ token?: string; password?: string }>(request);
      if (!body.token || !body.password) {
        return toErrorResponse(
          statusError("VALIDATION_ERROR", "Token and password are required.", 422),
        );
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

export const authTokenRoutes: OryCMSRoute[] = [
  refresh,
  forgotPassword,
  resetPassword,
  activate,
  invite,
  acceptInvite,
];
