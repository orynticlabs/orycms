import { guardOryCMS, toErrorResponse, oryJsonOk } from "@/lib/route-guards";
import { getAllOryCMSSettings, setOryCMSSetting } from "@/settings";
import { recordOryCMSAuditLog } from "@/audit";
import type { OryCMSRoute } from "../dispatcher";
import { jsonError, statusError } from "../http";

const listSettings: OryCMSRoute = {
  method: "GET",
  pattern: "settings",
  handler: async ({ request }) => {
    try {
      await guardOryCMS(request, "settings", "read");
      return oryJsonOk(await getAllOryCMSSettings());
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};

const updateSetting: OryCMSRoute = {
  method: "PATCH",
  pattern: "settings",
  handler: async ({ request }) => {
    try {
      const session = await guardOryCMS(request, "settings", "update");
      const body = (await request.json()) as {
        key?: string;
        value?: unknown;
        description?: string | null;
      };
      if (!body.key) {
        return toErrorResponse(statusError("VALIDATION_ERROR", "Setting key is required.", 422));
      }
      const setting = await setOryCMSSetting(body.key, body.value, body.description ?? null);
      await recordOryCMSAuditLog({
        userId: session.userId,
        action: "update",
        resource: "settings",
        resourceId: body.key,
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      });
      return oryJsonOk(setting);
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};

// api-keys — 501 stubs (guarded).
const listApiKeys: OryCMSRoute = {
  method: "GET",
  pattern: "settings/api-keys",
  handler: async ({ request }) => {
    try {
      await guardOryCMS(request, "settings", "read");
      return jsonError("NOT_IMPLEMENTED", "API keys are not yet implemented.", 501);
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};
const createApiKey: OryCMSRoute = {
  method: "POST",
  pattern: "settings/api-keys",
  handler: async ({ request }) => {
    try {
      await guardOryCMS(request, "settings", "create");
      return jsonError("NOT_IMPLEMENTED", "API keys are not yet implemented.", 501);
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};
const deleteApiKey: OryCMSRoute = {
  method: "DELETE",
  pattern: "settings/api-keys/:id",
  handler: async ({ request }) => {
    try {
      await guardOryCMS(request, "settings", "delete");
      return jsonError("NOT_IMPLEMENTED", "API keys are not yet implemented.", 501);
    } catch (err) {
      return toErrorResponse(err);
    }
  },
};

export const settingsRoutes: OryCMSRoute[] = [
  listSettings,
  updateSetting,
  listApiKeys,
  createApiKey,
  deleteApiKey,
];
