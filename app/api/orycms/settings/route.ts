import type { NextRequest } from "next/server";
import { guardOryCMS, toErrorResponse, oryJsonOk } from "@/lib/route-guards";
import { getAllOryCMSSettings, setOryCMSSetting } from "@/settings";
import { recordOryCMSAuditLog } from "@/audit";

// GET /api/orycms/settings — list all settings
export async function GET(request: NextRequest) {
  try {
    await guardOryCMS(request, "settings", "read");
    return oryJsonOk(await getAllOryCMSSettings());
  } catch (err) {
    return toErrorResponse(err);
  }
}

// PATCH /api/orycms/settings — upsert one or more settings
export async function PATCH(request: NextRequest) {
  try {
    const session = await guardOryCMS(request, "settings", "update");
    const body = (await request.json()) as {
      key?: string;
      value?: unknown;
      description?: string | null;
    };
    if (!body.key) {
      return toErrorResponse(
        Object.assign(new Error("Setting key is required."), { code: "VALIDATION_ERROR", statusCode: 422 }),
      );
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
}
