import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  publishOryCMSContentEntry,
  unpublishOryCMSContentEntry,
  OryCMSContentError,
} from "@/content";
import { protectOryCMSAdminRoute, OryCMSAuthError } from "@/auth";
import { requireOryCMSPermission } from "@/rbac";
import { recordOryCMSAuditLog } from "@/audit";

type RouteCtx = { params: Promise<{ collection: string; id: string }> };

const handleError = (err: unknown) => {
  if (err instanceof OryCMSAuthError)
    return NextResponse.json(
      { success: false, error: { code: err.code, message: err.message } },
      { status: err.statusCode },
    );
  if (err instanceof OryCMSContentError)
    return NextResponse.json(
      { success: false, error: { code: err.code, message: err.message } },
      { status: err.statusCode },
    );
  return NextResponse.json(
    { success: false, error: { code: "INTERNAL_ERROR", message: "Request failed." } },
    { status: 500 },
  );
};

// POST /api/orycms/collections/:collection/content/:id/publish — publish
export async function POST(request: NextRequest, { params }: RouteCtx) {
  try {
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "content", "publish");
    const { collection, id } = await params;
    const entry = await publishOryCMSContentEntry(collection, id);
    await recordOryCMSAuditLog({
      userId: session.userId,
      action: "publish",
      resource: "content",
      resourceId: id,
      metadata: { collection },
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    }).catch((err) => console.error("[OryCMS] audit log failed:", err));
    return NextResponse.json({ success: true, data: entry });
  } catch (err) {
    return handleError(err);
  }
}

// DELETE /api/orycms/collections/:collection/content/:id/publish — unpublish
export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  try {
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "content", "publish");
    const { collection, id } = await params;
    const entry = await unpublishOryCMSContentEntry(collection, id);
    await recordOryCMSAuditLog({
      userId: session.userId,
      action: "unpublish",
      resource: "content",
      resourceId: id,
      metadata: { collection },
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    }).catch((err) => console.error("[OryCMS] audit log failed:", err));
    return NextResponse.json({ success: true, data: entry });
  } catch (err) {
    return handleError(err);
  }
}
