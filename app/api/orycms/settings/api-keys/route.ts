import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// GET /api/orycms/settings/api-keys
export async function GET(_request: NextRequest) {
  return NextResponse.json(
    { success: false, error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}

// POST /api/orycms/settings/api-keys
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { success: false, error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}
