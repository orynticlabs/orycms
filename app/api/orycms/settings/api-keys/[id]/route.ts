import type { NextRequest } from "next/server";
import { guardOryCMS, toErrorResponse, oryJsonError } from "@/lib/route-guards";

type RouteCtx = { params: Promise<{ id: string }> };

// DELETE /api/orycms/settings/api-keys/:id — revoke an API key (guarded; impl pending)
export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  try {
    await guardOryCMS(request, "settings", "delete");
    await params;
    return oryJsonError("NOT_IMPLEMENTED", "API keys are not yet implemented.", 501);
  } catch (err) {
    return toErrorResponse(err);
  }
}
