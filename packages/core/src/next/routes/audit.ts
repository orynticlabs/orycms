import { guardOryCMS, toErrorResponse, oryJsonOk } from "@/lib/route-guards";
import { listOryCMSAuditLogs } from "@/audit";
import type { OryCMSRoute } from "../dispatcher";

const listAudit: OryCMSRoute = {
  method: "GET",
  pattern: "audit",
  handler: async ({ request, url }) => {
    try {
      await guardOryCMS(request, "audit", "read");
      const sp = url.searchParams;
      const logs = await listOryCMSAuditLogs({
        userId: sp.get("userId") ?? undefined,
        resource: sp.get("resource") ?? undefined,
        action: sp.get("action") ?? undefined,
        limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
        offset: sp.get("offset") ? Number(sp.get("offset")) : undefined,
      });
      return oryJsonOk(logs);
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};

export const auditRoutes: OryCMSRoute[] = [listAudit];
