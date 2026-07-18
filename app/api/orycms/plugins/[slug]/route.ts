import type { NextRequest } from "next/server";
import { guardOryCMS, toErrorResponse, oryJsonError } from "@/lib/route-guards";

type RouteCtx = { params: Promise<{ slug: string }> };

// GET /api/orycms/plugins/:slug — plugin detail (guarded; impl pending)
export async function GET(request: NextRequest, { params }: RouteCtx) {
  try {
    await guardOryCMS(request, "plugins", "read");
    await params;
    return oryJsonError("NOT_IMPLEMENTED", "Plugin detail is not yet implemented.", 501);
  } catch (err) {
    return toErrorResponse(err);
  }
}

// POST /api/orycms/plugins/:slug — install plugin (guarded; impl pending)
export async function POST(request: NextRequest, { params }: RouteCtx) {
  try {
    await guardOryCMS(request, "plugins", "create");
    await params;
    return oryJsonError("NOT_IMPLEMENTED", "Plugin install is not yet implemented.", 501);
  } catch (err) {
    return toErrorResponse(err);
  }
}

// PATCH /api/orycms/plugins/:slug — update config or enable/disable (guarded; impl pending)
export async function PATCH(request: NextRequest, { params }: RouteCtx) {
  try {
    await guardOryCMS(request, "plugins", "update");
    await params;
    return oryJsonError("NOT_IMPLEMENTED", "Plugin update is not yet implemented.", 501);
  } catch (err) {
    return toErrorResponse(err);
  }
}

// DELETE /api/orycms/plugins/:slug — uninstall plugin (guarded; impl pending)
export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  try {
    await guardOryCMS(request, "plugins", "delete");
    await params;
    return oryJsonError("NOT_IMPLEMENTED", "Plugin uninstall is not yet implemented.", 501);
  } catch (err) {
    return toErrorResponse(err);
  }
}
