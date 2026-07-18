import type { NextRequest } from "next/server";
import { guardOryCMS, toErrorResponse, oryJsonError } from "@/lib/route-guards";

// GET /api/orycms/seo/redirects — list SEO redirects (guarded; impl pending)
export async function GET(request: NextRequest) {
  try {
    await guardOryCMS(request, "seo", "read");
    return oryJsonError("NOT_IMPLEMENTED", "SEO redirects are not yet implemented.", 501);
  } catch (err) {
    return toErrorResponse(err);
  }
}

// POST /api/orycms/seo/redirects — create SEO redirect (guarded; impl pending)
export async function POST(request: NextRequest) {
  try {
    await guardOryCMS(request, "seo", "create");
    return oryJsonError("NOT_IMPLEMENTED", "SEO redirects are not yet implemented.", 501);
  } catch (err) {
    return toErrorResponse(err);
  }
}
