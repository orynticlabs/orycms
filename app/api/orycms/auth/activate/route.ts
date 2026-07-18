import type { NextRequest } from "next/server";
import { getOryCMSPool } from "@/lib/db";
import { consumeOryCMSToken } from "@/tokens";
import { setOryCMSUserStatus } from "@/users";
import { recordOryCMSAuditLog } from "@/audit";
import { toErrorResponse, oryJsonOk } from "@/lib/route-guards";

// POST /api/orycms/auth/activate — public.
// Consumes an activation token and marks the account active.
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { token?: string };
    if (!body.token) {
      return toErrorResponse(
        Object.assign(new Error("Token is required."), { code: "VALIDATION_ERROR", statusCode: 422 }),
      );
    }

    const pool = getOryCMSPool();
    const token = await consumeOryCMSToken("activation", body.token, pool);
    if (!token.userId) {
      return toErrorResponse(
        Object.assign(new Error("This activation link is not linked to an account."), {
          code: "INVALID_CREDENTIALS",
          statusCode: 400,
        }),
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
}
