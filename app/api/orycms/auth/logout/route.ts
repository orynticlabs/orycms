import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { destroyOryCMSUserSession, SESSION_COOKIE } from "@/auth";
import { getOryCMSPool } from "@/lib/db";

// POST /api/orycms/auth/logout
export async function POST(request: NextRequest) {
  const rawToken = request.cookies.get(SESSION_COOKIE)?.value;

  if (rawToken) {
    try {
      await destroyOryCMSUserSession(getOryCMSPool(), rawToken);
    } catch {
      // Best-effort: clear the cookie regardless
    }
  }

  const response = NextResponse.json({ success: true, data: null });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
