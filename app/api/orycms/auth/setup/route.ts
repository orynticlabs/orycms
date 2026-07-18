import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createOryCMSInitialOwner, OryCMSAuthError } from "@/auth";
import { bootstrapOryCMS } from "@/core";
import { getOryCMSPool } from "@/lib/db";

// POST /api/orycms/auth/setup — create the first Owner account
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

    // Install the core schema (11 tables) AND seed the default roles + permission
    // matrix before creating the Owner, so a fresh database works end-to-end.
    // bootstrapOryCMS is idempotent — safe to re-run.
    const bootstrap = await bootstrapOryCMS(pool);
    if (!bootstrap.install.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SCHEMA_INSTALL_FAILED",
            message:
              "Could not install the OryCMS database schema. Check the database connection.",
          },
        },
        { status: 500 },
      );
    }

    const user = await createOryCMSInitialOwner(pool, { email, password });

    // Account is provisioned; the user signs in on /login to mint a session.
    return NextResponse.json(
      { success: true, data: { userId: user.id, email: user.email } },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof OryCMSAuthError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode },
      );
    }
    console.error("Setup error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Setup failed." } },
      { status: 500 },
    );
  }
}
