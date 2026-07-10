import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { protectOryCMSAdminRoute, OryCMSAuthError } from "@/auth";

// GET /api/orycms/auth/session — returns the current session user
export async function GET(request: NextRequest) {
  try {
    const session = await protectOryCMSAdminRoute(request);
    return NextResponse.json({ success: true, data: { user: session } });
  } catch (err) {
    if (err instanceof OryCMSAuthError) {
      return NextResponse.json({ success: false, data: null }, { status: err.statusCode });
    }
    return NextResponse.json({ success: false, data: null }, { status: 500 });
  }
}
