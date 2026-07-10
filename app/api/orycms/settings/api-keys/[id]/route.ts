import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// DELETE /api/orycms/settings/api-keys/:id — revoke an API key
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  void params;
  return NextResponse.json(
    { success: false, error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}
