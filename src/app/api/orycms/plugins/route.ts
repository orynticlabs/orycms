import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// GET /api/orycms/plugins
export async function GET(_request: NextRequest) {
  return NextResponse.json(
    { success: false, error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}
