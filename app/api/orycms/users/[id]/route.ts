import type { NextRequest } from "next/server";
import { guardOryCMS, toErrorResponse, oryJsonOk } from "@/lib/route-guards";
import { getOryCMSUser, updateOryCMSUser, deleteOryCMSUser } from "@/users";
import { recordOryCMSAuditLog } from "@/audit";

type RouteCtx = { params: Promise<{ id: string }> };

// GET /api/orycms/users/:id
export async function GET(request: NextRequest, { params }: RouteCtx) {
  try {
    await guardOryCMS(request, "users", "read");
    const { id } = await params;
    return oryJsonOk(await getOryCMSUser(id));
  } catch (err) {
    return toErrorResponse(err);
  }
}

// PATCH /api/orycms/users/:id
export async function PATCH(request: NextRequest, { params }: RouteCtx) {
  try {
    const session = await guardOryCMS(request, "users", "update");
    const { id } = await params;
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      roleId?: string | null;
      status?: "active" | "inactive" | "pending";
    };
    const user = await updateOryCMSUser(id, body);
    await recordOryCMSAuditLog({
      userId: session.userId,
      action: "update",
      resource: "users",
      resourceId: id,
      metadata: { fields: Object.keys(body) },
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    });
    return oryJsonOk(user);
  } catch (err) {
    return toErrorResponse(err);
  }
}

// DELETE /api/orycms/users/:id
export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  try {
    const session = await guardOryCMS(request, "users", "delete");
    const { id } = await params;
    await deleteOryCMSUser(id);
    await recordOryCMSAuditLog({
      userId: session.userId,
      action: "delete",
      resource: "users",
      resourceId: id,
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    });
    return oryJsonOk({ id, deleted: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
