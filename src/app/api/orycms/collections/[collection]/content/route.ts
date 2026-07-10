import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// GET /api/orycms/collections/:collection/content
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ collection: string }> },
) {
  void params;
  return NextResponse.json(
    { success: false, error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}

// POST /api/orycms/collections/:collection/content
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ collection: string }> },
) {
  void params;
  return NextResponse.json(
    { success: false, error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}
