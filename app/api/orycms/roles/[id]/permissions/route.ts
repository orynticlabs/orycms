import type { NextRequest } from "next/server";
import { guardOryCMS, toErrorResponse, oryJsonOk } from "@/lib/route-guards";
import { getOryCMSRolePermissions, setOryCMSRolePermissions } from "@/roles";
import { recordOryCMSAuditLog } from "@/audit";

type RouteCtx = { params: Promise<{ id: string }> };

// GET /api/orycms/roles/:id/permissions — list a role's permissions
export async function GET(request: NextRequest, { params }: RouteCtx) {
  try {
    await guardOryCMS(request, "roles", "read");
    const { id } = await params;
    return oryJsonOk(await getOryCMSRolePermissions(id));
  } catch (err) {
    return toErrorResponse(err);
  }
}

// PUT /api/orycms/roles/:id/permissions — replace the role's permission set
export async function PUT(request: NextRequest, { params }: RouteCtx) {
  try {
    const session = await guardOryCMS(request, "roles", "update");
    const { id } = await params;
    const body = (await request.json()) as { permissionIds?: string[] };
    const permissionIds = Array.isArray(body.permissionIds) ? body.permissionIds : [];
    await setOryCMSRolePermissions(id, permissionIds);
    await recordOryCMSAuditLog({
      userId: session.userId,
      action: "update",
      resource: "roles",
      resourceId: id,
      metadata: { permissionCount: permissionIds.length },
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    });
    return oryJsonOk({ roleId: id, permissionIds });
  } catch (err) {
    return toErrorResponse(err);
  }
}
