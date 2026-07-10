import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// GET /api/orycms/collections/:collection/content/:id
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ collection: string; id: string }> },
) {
  void params;
  return NextResponse.json(
    { success: false, error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}

// PATCH /api/orycms/collections/:collection/content/:id
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ collection: string; id: string }> },
) {
  void params;
  return NextResponse.json(
    { success: false, error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}

// DELETE /api/orycms/collections/:collection/content/:id
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ collection: string; id: string }> },
) {
  void params;
  return NextResponse.json(
    { success: false, error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}
