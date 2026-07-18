import type { NextRequest } from "next/server";
import { guardOryCMS, toErrorResponse, oryJsonOk } from "@/lib/route-guards";
import { listOryCMSRoles, createOryCMSRole } from "@/roles";
import { recordOryCMSAuditLog } from "@/audit";

// GET /api/orycms/roles — list all roles
export async function GET(request: NextRequest) {
  try {
    await guardOryCMS(request, "roles", "read");
    return oryJsonOk(await listOryCMSRoles());
  } catch (err) {
    return toErrorResponse(err);
  }
}

// POST /api/orycms/roles — create a role
export async function POST(request: NextRequest) {
  try {
    const session = await guardOryCMS(request, "roles", "create");
    const body = (await request.json()) as { name?: string; description?: string | null };
    if (!body.name) {
      return toErrorResponse(
        Object.assign(new Error("Role name is required."), { code: "VALIDATION_ERROR", statusCode: 422 }),
      );
    }
    const role = await createOryCMSRole({ name: body.name, description: body.description });
    await recordOryCMSAuditLog({
      userId: session.userId,
      action: "create",
      resource: "roles",
      resourceId: role.id,
      metadata: { name: role.name },
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    });
    return oryJsonOk(role, 201);
  } catch (err) {
    return toErrorResponse(err);
  }
}
