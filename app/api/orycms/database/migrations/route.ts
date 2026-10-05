import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getOryCMSPool } from "@/lib/db";
import { bootstrapOryCMS } from "@/core";
import { guardOryCMS, toErrorResponse, oryJsonOk, redactDetail } from "@/lib/route-guards";
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

    if (!result.install.success) {
      // Driver text stays in the server log. The response names the failed migrations only.
      for (const failure of result.install.failed) {
        console.error(
          `[orycms] database.migrations.run: migration ${failure.migrationId} failed: ${redactDetail(failure.error)}`,
        );
      }
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SCHEMA_INSTALL_FAILED",
            message: "Database schema install failed. See server logs.",
            failed: result.install.failed.map(({ migrationId, name }) => ({ migrationId, name })),
          },
        },
        { status: 500 },
      );
    }
    return oryJsonOk(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
