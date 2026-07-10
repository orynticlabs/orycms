import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// POST /api/orycms/auth/refresh — exchange a refresh token for a new access token
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { success: false, error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}
