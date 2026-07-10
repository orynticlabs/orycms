import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// GET /api/orycms/database/migrations
export async function GET(_request: NextRequest) {
  return NextResponse.json(
    { success: false, error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}

// POST /api/orycms/database/migrations — run pending migrations
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { success: false, error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}
