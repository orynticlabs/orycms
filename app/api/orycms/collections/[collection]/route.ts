import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getOryCMSCollection } from "@/schema";

// GET /api/orycms/collections/:collection — get a single collection schema
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ collection: string }> },
) {
  const { collection } = await params;
  const schema = getOryCMSCollection(collection);
  if (!schema) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "NOT_FOUND", message: `Collection "${collection}" not found.` },
      },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true, data: schema });
}

// PATCH /api/orycms/collections/:collection (stub)
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ collection: string }> },
) {
  void params;
  return NextResponse.json(
    { success: false, error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}

// DELETE /api/orycms/collections/:collection (stub)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ collection: string }> },
) {
  void params;
  return NextResponse.json(
    { success: false, error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}
