import type { NextRequest } from "next/server";
import { guardOryCMS, toErrorResponse, oryJsonOk } from "@/lib/route-guards";
import { listOryCMSAuditLogs } from "@/audit";

// GET /api/orycms/audit — list audit-log entries (guarded: audit:read)
export async function GET(request: NextRequest) {
  try {
    await guardOryCMS(request, "audit", "read");
    const { searchParams } = request.nextUrl;
    const logs = await listOryCMSAuditLogs({
      userId: searchParams.get("userId") ?? undefined,
      resource: searchParams.get("resource") ?? undefined,
      action: searchParams.get("action") ?? undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
      offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined,
    });
    return oryJsonOk(logs);
  } catch (err) {
    return toErrorResponse(err);
  }
}
