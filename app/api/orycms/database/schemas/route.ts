import type { NextRequest } from "next/server";
import { guardOryCMS, toErrorResponse, oryJsonError } from "@/lib/route-guards";

// GET /api/orycms/database/schemas — database schema introspection (guarded; impl pending)
export async function GET(request: NextRequest) {
  try {
    await guardOryCMS(request, "migrations", "read");
    return oryJsonError("NOT_IMPLEMENTED", "Database schema introspection is not yet implemented.", 501);
  } catch (err) {
    return toErrorResponse(err);
  }
}
