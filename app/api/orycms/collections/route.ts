import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { listOryCMSCollections } from "@/schema";

// GET /api/orycms/collections — list all registered collection schemas
export async function GET(_request: NextRequest) {
  const collections = listOryCMSCollections();
  return NextResponse.json({ success: true, data: collections });
}

// POST /api/orycms/collections — create a new collection schema (stub)
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { success: false, error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}
