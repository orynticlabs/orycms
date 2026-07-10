import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// POST /api/orycms/auth/login — authenticate and receive tokens
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { success: false, error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}
