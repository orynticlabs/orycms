import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// POST /api/orycms/collections/:collection/content/:id/publish
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ collection: string; id: string }> },
) {
  void params;
  return NextResponse.json(
    { success: false, error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}
