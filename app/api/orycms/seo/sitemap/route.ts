import type { NextRequest } from "next/server";
import { guardOryCMS, toErrorResponse, oryJsonError } from "@/lib/route-guards";

// GET /api/orycms/seo/sitemap — read sitemap config (guarded; impl pending)
export async function GET(request: NextRequest) {
  try {
    await guardOryCMS(request, "seo", "read");
    return oryJsonError("NOT_IMPLEMENTED", "SEO sitemap is not yet implemented.", 501);
  } catch (err) {
    return toErrorResponse(err);
  }
}

// PATCH /api/orycms/seo/sitemap — update sitemap config (guarded; impl pending)
export async function PATCH(request: NextRequest) {
  try {
    await guardOryCMS(request, "seo", "update");
    return oryJsonError("NOT_IMPLEMENTED", "SEO sitemap is not yet implemented.", 501);
  } catch (err) {
    return toErrorResponse(err);
  }
}
