import type { NextRequest } from "next/server";
import {
  createOryCMSUserSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "@/auth";
import { getOryCMSPool } from "@/lib/db";
import { consumeOryCMSToken } from "@/tokens";
import { updateOryCMSUser } from "@/users";
import { recordOryCMSAuditLog } from "@/audit";
import { toErrorResponse, oryJsonOk } from "@/lib/route-guards";

// POST /api/orycms/auth/accept-invite — public: complete an invite.
// Consumes the invite token, sets the user's password + activates them, logs them in.
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { token?: string; password?: string };
    if (!body.token || !body.password) {
      return toErrorResponse(
        Object.assign(new Error("Token and password are required."), {
          code: "VALIDATION_ERROR",
          statusCode: 422,
        }),
      );
    }

    const pool = getOryCMSPool();
    const token = await consumeOryCMSToken("invite", body.token, pool);
    if (!token.userId) {
      return toErrorResponse(
        Object.assign(new Error("This invite is not linked to an account."), {
          code: "INVALID_CREDENTIALS",
          statusCode: 400,
        }),
      );
    }

    // updateOryCMSUser enforces the min-length (WEAK_PASSWORD) rule.
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

    const response = oryJsonOk({ userId: token.userId, email: token.email });
    response.cookies.set({
      name: SESSION_COOKIE,
      value: rawToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });
    return response;
  } catch (err) {
    return toErrorResponse(err);
  }
}
