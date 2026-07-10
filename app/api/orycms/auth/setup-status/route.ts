import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hasOryCMSInitialUser } from "@/auth";
import { getOryCMSPool } from "@/lib/db";

// GET /api/orycms/auth/setup-status
export async function GET(_request: NextRequest) {
  try {
    const initialized = await hasOryCMSInitialUser(getOryCMSPool());
    return NextResponse.json({ success: true, data: { initialized } });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "DB_ERROR", message: "Could not check setup status." } },
      { status: 503 },
    );
  }
}
