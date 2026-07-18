import type { NextRequest } from "next/server";
import { getOryCMSPool } from "@/lib/db";
import { bootstrapOryCMS } from "@/core";
import { guardOryCMS, toErrorResponse, oryJsonOk } from "@/lib/route-guards";
import { recordOryCMSAuditLog } from "@/audit";

// GET /api/orycms/database/migrations — list applied core migrations
export async function GET(request: NextRequest) {
  try {
    await guardOryCMS(request, "migrations", "read");
    const pool = getOryCMSPool();
    const result = await pool.query(
      `SELECT "migrationId", name, "appliedAt", "durationMs"
       FROM orycms_migrations
       ORDER BY "appliedAt" ASC`,
    );
    return oryJsonOk(result.rows);
  } catch (err) {
    return toErrorResponse(err);
  }
}

// POST /api/orycms/database/migrations — install core schema + seed roles/permissions
export async function POST(request: NextRequest) {
  try {
    const session = await guardOryCMS(request, "migrations", "create");
    const result = await bootstrapOryCMS();

    await recordOryCMSAuditLog({
      userId: session.userId,
      action: "migrate",
      resource: "migrations",
      metadata: { applied: result.install.applied, seeded: result.seeded },
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    });

    return oryJsonOk(result, result.install.success ? 200 : 500);
  } catch (err) {
    return toErrorResponse(err);
  }
}
