import type { NextRequest } from "next/server";
import { guardOryCMS, toErrorResponse, oryJsonError } from "@/lib/route-guards";

type RouteCtx = { params: Promise<{ collection: string }> };

// GET /api/orycms/collections/:collection/fields — list collection fields (guarded; impl pending)
export async function GET(request: NextRequest, { params }: RouteCtx) {
  try {
    await guardOryCMS(request, "collections", "read");
    await params;
    return oryJsonError("NOT_IMPLEMENTED", "Collection fields are not yet implemented.", 501);
  } catch (err) {
    return toErrorResponse(err);
  }
}

// POST /api/orycms/collections/:collection/fields — create collection field (guarded; impl pending)
export async function POST(request: NextRequest, { params }: RouteCtx) {
  try {
    await guardOryCMS(request, "collections", "create");
    await params;
    return oryJsonError("NOT_IMPLEMENTED", "Collection fields are not yet implemented.", 501);
  } catch (err) {
    return toErrorResponse(err);
  }
}
