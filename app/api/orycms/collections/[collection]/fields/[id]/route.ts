import type { NextRequest } from "next/server";
import { guardOryCMS, toErrorResponse, oryJsonError } from "@/lib/route-guards";

type RouteCtx = { params: Promise<{ collection: string; id: string }> };

// PATCH /api/orycms/collections/:collection/fields/:id — update collection field (guarded; impl pending)
export async function PATCH(request: NextRequest, { params }: RouteCtx) {
  try {
    await guardOryCMS(request, "collections", "update");
    await params;
    return oryJsonError("NOT_IMPLEMENTED", "Collection fields are not yet implemented.", 501);
  } catch (err) {
    return toErrorResponse(err);
  }
}

// DELETE /api/orycms/collections/:collection/fields/:id — delete collection field (guarded; impl pending)
export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  try {
    await guardOryCMS(request, "collections", "delete");
    await params;
    return oryJsonError("NOT_IMPLEMENTED", "Collection fields are not yet implemented.", 501);
  } catch (err) {
    return toErrorResponse(err);
  }
}
