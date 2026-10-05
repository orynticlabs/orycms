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

/** Setting keys: letters, digits, `.`, `_`, `-`; starts with a letter or digit; at most 128 characters. */
const SETTING_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SETTING_DESCRIPTION_MAX = 1000;

function invalid(message: string): Error {
  return statusError("VALIDATION_ERROR", message, 422);
}

const updateSetting: OryCMSRoute = {
  method: "PATCH",
  pattern: "settings",
  handler: async ({ request }) => {
    try {
      const session = await guardOryCMS(request, "settings", "update");
      let parsed: unknown;
      try {
        parsed = await request.json();
      } catch {
        throw invalid("Request body must be valid JSON.");
      }
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw invalid("Request body must be a JSON object.");
      }
      const body = parsed as { key?: unknown; value?: unknown; description?: unknown };
      if (body.key === undefined || body.key === "") {
        throw invalid("Setting key is required.");
      }
      if (typeof body.key !== "string" || !SETTING_KEY_PATTERN.test(body.key)) {
        throw invalid("Setting key is invalid.");
      }
      if (body.value === undefined) {
        throw invalid("Setting value is required.");
      }
      if (
        body.description !== undefined &&
        body.description !== null &&
        (typeof body.description !== "string" || body.description.length > SETTING_DESCRIPTION_MAX)
      ) {
        throw invalid(
          `Setting description must be a string of at most ${SETTING_DESCRIPTION_MAX} characters.`,
        );
      }
      const setting = await setOryCMSSetting(
        body.key,
        body.value,
        (body.description as string | null | undefined) ?? null,
      );
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
