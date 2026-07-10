import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// GET /api/orycms/roles/:id/permissions
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  void params;
  return NextResponse.json(
    { success: false, error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}

// PUT /api/orycms/roles/:id/permissions — replace permission matrix
export async function PUT(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  void params;
  return NextResponse.json(
    { success: false, error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}
