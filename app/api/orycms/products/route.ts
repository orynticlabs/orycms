import type { NextRequest } from "next/server";
import { guardOryCMS, toErrorResponse, oryJsonError } from "@/lib/route-guards";

// GET /api/orycms/products — list products (guarded; impl pending)
export async function GET(request: NextRequest) {
  try {
    await guardOryCMS(request, "collections", "read");
    return oryJsonError("NOT_IMPLEMENTED", "Product catalog is not yet implemented.", 501);
  } catch (err) {
    return toErrorResponse(err);
  }
}

// POST /api/orycms/products — create product (guarded; impl pending)
export async function POST(request: NextRequest) {
  try {
    await guardOryCMS(request, "collections", "create");
    return oryJsonError("NOT_IMPLEMENTED", "Product catalog is not yet implemented.", 501);
  } catch (err) {
    return toErrorResponse(err);
  }
}
