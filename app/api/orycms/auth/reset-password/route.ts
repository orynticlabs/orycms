import type { NextRequest } from "next/server";
import { destroyOryCMSUserSessions } from "@/auth";
import { getOryCMSPool } from "@/lib/db";
import { consumeOryCMSToken } from "@/tokens";
import { updateOryCMSUser } from "@/users";
import { recordOryCMSAuditLog } from "@/audit";
import { toErrorResponse, oryJsonOk } from "@/lib/route-guards";

// POST /api/orycms/auth/reset-password — public.
// Consumes a reset token, sets the new password, and revokes ALL of the user's
// existing sessions (so a stolen session can't outlive the reset).
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
    const token = await consumeOryCMSToken("reset", body.token, pool);
    if (!token.userId) {
      return toErrorResponse(
        Object.assign(new Error("This reset link is not linked to an account."), {
          code: "INVALID_CREDENTIALS",
          statusCode: 400,
        }),
      );
    }

    // updateOryCMSUser enforces WEAK_PASSWORD (min length).
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
}
