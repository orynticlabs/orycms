import type { NextRequest } from "next/server";
import { guardOryCMS, toErrorResponse, oryJsonError } from "@/lib/route-guards";

type RouteCtx = { params: Promise<{ id: string }> };

// PATCH /api/orycms/seo/redirects/:id — update SEO redirect (guarded; impl pending)
export async function PATCH(request: NextRequest, { params }: RouteCtx) {
  try {
    await guardOryCMS(request, "seo", "update");
    await params;
    return oryJsonError("NOT_IMPLEMENTED", "SEO redirects are not yet implemented.", 501);
  } catch (err) {
    return toErrorResponse(err);
  }
}

// DELETE /api/orycms/seo/redirects/:id — delete SEO redirect (guarded; impl pending)
export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  try {
    await guardOryCMS(request, "seo", "delete");
    await params;
    return oryJsonError("NOT_IMPLEMENTED", "SEO redirects are not yet implemented.", 501);
  } catch (err) {
    return toErrorResponse(err);
  }
}
