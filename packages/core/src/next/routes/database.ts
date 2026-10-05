import { getOryCMSPool } from "@/lib/db";
import { bootstrapOryCMS } from "@/core";
import { guardOryCMS, oryJsonOk } from "@/lib/route-guards";
import { recordOryCMSAuditLog } from "@/audit";
import type { OryCMSRoute } from "../dispatcher";
import { jsonError } from "../http";
import { logRouteDetail, safeRouteError } from "../route-errors";

const listMigrations: OryCMSRoute = {
  method: "GET",
  pattern: "database/migrations",
  handler: async ({ request }) => {
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
      return safeRouteError("database.migrations.list", err);
    }
  },
};

const runMigrations: OryCMSRoute = {
  method: "POST",
  pattern: "database/migrations",
  handler: async ({ request }) => {
    try {
      const session = await guardOryCMS(request, "migrations", "create");
      // The request body and query string are never read: the install takes no input.
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
        for (const failure of result.install.failed) {
          logRouteDetail(
            `database.migrations.run: migration ${failure.migrationId} failed`,
            failure.error,
          );
        }
        return Response.json(
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
      return safeRouteError("database.migrations.run", err);
    }
  },
};

// database/schemas — 501 stub (guarded on migrations:read, matching the reference).
const listSchemas: OryCMSRoute = {
  method: "GET",
  pattern: "database/schemas",
  handler: async ({ request }) => {
    try {
      await guardOryCMS(request, "migrations", "read");
      return jsonError(
        "NOT_IMPLEMENTED",
        "Database schema introspection is not yet implemented.",
        501,
      );
    } catch (err) {
      return safeRouteError("database.schemas.list", err);
    }
  },
};

export const databaseRoutes: OryCMSRoute[] = [listMigrations, runMigrations, listSchemas];
