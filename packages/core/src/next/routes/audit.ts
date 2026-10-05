import { guardOryCMS, toErrorResponse, oryJsonOk } from "@/lib/route-guards";
import { listOryCMSAuditLogs } from "@/audit";
import type { OryCMSRoute } from "../dispatcher";
import { statusError } from "../http";

/** Reads an optional integer query parameter; anything that is not a whole number is a 400. */
function intParam(raw: string | null, name: string): number | undefined {
  if (raw === null || raw === "") return undefined;
  if (!/^-?\d+$/.test(raw.trim())) {
    throw statusError("VALIDATION_ERROR", `${name} must be an integer.`, 400);
  }
  return Number(raw);
}

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
        limit: intParam(sp.get("limit"), "limit"),
        offset: intParam(sp.get("offset"), "offset"),
      });
      return oryJsonOk(logs);
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};

export const auditRoutes: OryCMSRoute[] = [listAudit];
