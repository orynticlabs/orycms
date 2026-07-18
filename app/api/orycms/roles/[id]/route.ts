import type { NextRequest } from "next/server";
import { guardOryCMS, toErrorResponse, oryJsonOk } from "@/lib/route-guards";
import { getOryCMSRole, updateOryCMSRole, deleteOryCMSRole } from "@/roles";
import { recordOryCMSAuditLog } from "@/audit";

type RouteCtx = { params: Promise<{ id: string }> };

// GET /api/orycms/roles/:id
export async function GET(request: NextRequest, { params }: RouteCtx) {
  try {
    await guardOryCMS(request, "roles", "read");
    const { id } = await params;
    return oryJsonOk(await getOryCMSRole(id));
  } catch (err) {
    return toErrorResponse(err);
  }
}

// PATCH /api/orycms/roles/:id
export async function PATCH(request: NextRequest, { params }: RouteCtx) {
  try {
    const session = await guardOryCMS(request, "roles", "update");
    const { id } = await params;
    const body = (await request.json()) as { name?: string; description?: string | null };
    const role = await updateOryCMSRole(id, body);
    await recordOryCMSAuditLog({
      userId: session.userId,
      action: "update",
      resource: "roles",
      resourceId: id,
      metadata: { fields: Object.keys(body) },
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    });
    return oryJsonOk(role);
  } catch (err) {
    return toErrorResponse(err);
  }
}

// DELETE /api/orycms/roles/:id
export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  try {
    const session = await guardOryCMS(request, "roles", "delete");
    const { id } = await params;
    await deleteOryCMSRole(id);
    await recordOryCMSAuditLog({
      userId: session.userId,
      action: "delete",
      resource: "roles",
      resourceId: id,
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    });
    return oryJsonOk({ id, deleted: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
