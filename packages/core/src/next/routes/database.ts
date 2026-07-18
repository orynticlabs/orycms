import { getOryCMSPool } from "@/lib/db";
import { bootstrapOryCMS } from "@/core";
import { guardOryCMS, toErrorResponse, oryJsonOk } from "@/lib/route-guards";
import { recordOryCMSAuditLog } from "@/audit";
import type { OryCMSRoute } from "../dispatcher";
import { jsonError } from "../http";

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
      return toErrorResponse(err);
    }
  },
};

const runMigrations: OryCMSRoute = {
  method: "POST",
  pattern: "database/migrations",
  handler: async ({ request }) => {
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
  },
};

// database/schemas — 501 stub (guarded on migrations:read, matching the reference).
const listSchemas: OryCMSRoute = {
  method: "GET",
  pattern: "database/schemas",
  handler: async ({ request }) => {
    try {
      await guardOryCMS(request, "migrations", "read");
      return jsonError("NOT_IMPLEMENTED", "Database schema introspection is not yet implemented.", 501);
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};

export const databaseRoutes: OryCMSRoute[] = [listMigrations, runMigrations, listSchemas];
