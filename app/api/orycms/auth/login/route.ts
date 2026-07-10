import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  authenticateOryCMSUser,
  createOryCMSUserSession,
  OryCMSAuthError,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "@/auth";
import { getOryCMSPool } from "@/lib/db";

// POST /api/orycms/auth/login
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const { email = "", password = "" } = body;

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Email and password are required." },
        },
        { status: 422 },
      );
    }

    const pool = getOryCMSPool();
    const user = await authenticateOryCMSUser(pool, email, password);
    const rawToken = await createOryCMSUserSession(pool, user.id);

    const response = NextResponse.json({
      success: true,
      data: { userId: user.id, email: user.email },
    });
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
    if (err instanceof OryCMSAuthError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode },
      );
    }
    console.error("Login error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Login failed." } },
      { status: 500 },
    );
  }
}
