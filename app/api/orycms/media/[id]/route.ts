import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { OryCMSAuthError, protectOryCMSAdminRoute } from "@/auth";
import { requireOryCMSPermission } from "@/rbac";
import {
  getOryCMSMedia,
  updateOryCMSMedia,
  deleteOryCMSMedia,
  moveOryCMSMedia,
  OryCMSMediaError,
} from "@/media";

function errResponse(err: unknown) {
  if (err instanceof OryCMSAuthError)
    return NextResponse.json(
      { success: false, error: { code: err.code, message: err.message } },
      { status: err.statusCode },
    );
  if (err instanceof OryCMSMediaError)
    return NextResponse.json(
      { success: false, error: { code: err.code, message: err.message } },
      { status: err.statusCode },
    );
  console.error(err);
  return NextResponse.json(
    { success: false, error: { code: "INTERNAL_ERROR", message: "Request failed." } },
    { status: 500 },
  );
}

type RouteCtx = { params: Promise<{ id: string }> };

// GET /api/orycms/media/:id
export async function GET(request: NextRequest, { params }: RouteCtx) {
  try {
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "media", "read");
    const { id } = await params;
    const asset = await getOryCMSMedia(id);
    return NextResponse.json({ success: true, data: asset });
  } catch (err) {
    return errResponse(err);
  }
}

// PATCH /api/orycms/media/:id
// Body: { name?, altText?, caption? } for metadata update
//       { folderId: string | null }   for move
export async function PATCH(request: NextRequest, { params }: RouteCtx) {
  try {
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "media", "update");

    const { id } = await params;
    const body = (await request.json()) as {
      name?: string;
      altText?: string;
      caption?: string;
      folderId?: string | null;
    };

    // move takes priority if folderId key is present
    if ("folderId" in body) {
      const asset = await moveOryCMSMedia(id, body.folderId ?? null);
      return NextResponse.json({ success: true, data: asset });
    }

    const asset = await updateOryCMSMedia(id, {
      name: body.name,
      altText: body.altText,
      caption: body.caption,
    });
    return NextResponse.json({ success: true, data: asset });
  } catch (err) {
    return errResponse(err);
  }
}

// DELETE /api/orycms/media/:id
export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  try {
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "media", "delete");
    const { id } = await params;
    await deleteOryCMSMedia(id);
    return NextResponse.json({ success: true, data: null });
  } catch (err) {
    return errResponse(err);
  }
}
