import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  getOryCMSCurrentSession,
  createOryCMSUserSession,
  destroyOryCMSUserSession,
} from "@/auth";
import { getOryCMSPool } from "@/lib/db";
import { toErrorResponse, oryJsonOk } from "@/lib/route-guards";

// POST /api/orycms/auth/refresh — rotate the session token.
// Validates the current cookie, issues a fresh token, and revokes the old one
// (defense against fixation / long-lived stolen tokens).
export async function POST(request: NextRequest) {
  try {
    const rawToken = request.cookies.get(SESSION_COOKIE)?.value;
    if (!rawToken) {
      return toErrorResponse(
        Object.assign(new Error("Authentication required."), {
          code: "UNAUTHORIZED",
          statusCode: 401,
        }),
      );
    }

    const pool = getOryCMSPool();
    const session = await getOryCMSCurrentSession(pool, rawToken);
    if (!session) {
      return toErrorResponse(
        Object.assign(new Error("Session expired or invalid."), {
          code: "SESSION_EXPIRED",
          statusCode: 401,
        }),
      );
    }

    const newToken = await createOryCMSUserSession(pool, session.userId);
    await destroyOryCMSUserSession(pool, rawToken);

    const response = oryJsonOk({ refreshed: true });
    response.cookies.set({
      name: SESSION_COOKIE,
      value: newToken,
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
