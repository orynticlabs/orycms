import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// GET /api/orycms/plugins/:slug
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  void params;
  return NextResponse.json(
    { success: false, error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}

// POST /api/orycms/plugins/:slug — install plugin
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  void params;
  return NextResponse.json(
    { success: false, error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}

// PATCH /api/orycms/plugins/:slug — update config or enable/disable
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  void params;
  return NextResponse.json(
    { success: false, error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}

// DELETE /api/orycms/plugins/:slug — uninstall plugin
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  void params;
  return NextResponse.json(
    { success: false, error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}
