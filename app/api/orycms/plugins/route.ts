import type { NextRequest } from "next/server";
import { guardOryCMS, toErrorResponse, oryJsonError } from "@/lib/route-guards";

// GET /api/orycms/plugins — list installed plugins (guarded; listing impl pending)
export async function GET(request: NextRequest) {
  try {
    await guardOryCMS(request, "plugins", "read");
    return oryJsonError("NOT_IMPLEMENTED", "Plugin listing is not yet implemented.", 501);
  } catch (err) {
    return toErrorResponse(err);
  }
}
