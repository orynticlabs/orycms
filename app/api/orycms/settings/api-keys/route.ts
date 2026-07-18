import type { NextRequest } from "next/server";
import { guardOryCMS, toErrorResponse, oryJsonError } from "@/lib/route-guards";

// GET /api/orycms/settings/api-keys — list API keys (guarded; impl pending)
export async function GET(request: NextRequest) {
  try {
    await guardOryCMS(request, "settings", "read");
    return oryJsonError("NOT_IMPLEMENTED", "API keys are not yet implemented.", 501);
  } catch (err) {
    return toErrorResponse(err);
  }
}

// POST /api/orycms/settings/api-keys — create API key (guarded; impl pending)
export async function POST(request: NextRequest) {
  try {
    await guardOryCMS(request, "settings", "create");
    return oryJsonError("NOT_IMPLEMENTED", "API keys are not yet implemented.", 501);
  } catch (err) {
    return toErrorResponse(err);
  }
}
