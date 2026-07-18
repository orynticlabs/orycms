import type { NextRequest } from "next/server";
import { guardOryCMS, toErrorResponse, oryJsonError } from "@/lib/route-guards";

// GET /api/orycms/customers — list customers (guarded; impl pending)
export async function GET(request: NextRequest) {
  try {
    await guardOryCMS(request, "collections", "read");
    return oryJsonError("NOT_IMPLEMENTED", "Customers are not yet implemented.", 501);
  } catch (err) {
    return toErrorResponse(err);
  }
}
