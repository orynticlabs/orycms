import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getOryCMSContentEntry,
  updateOryCMSContentEntry,
  deleteOryCMSContentEntry,
  OryCMSContentError,
} from "@/content";
import { protectOryCMSAdminRoute, OryCMSAuthError } from "@/auth";
import { requireOryCMSPermission } from "@/rbac";

type RouteCtx = { params: Promise<{ collection: string; id: string }> };

/** True only for a session that holds content:read — the gate for ever returning a draft. */
async function canSeeDrafts(request: NextRequest): Promise<boolean> {
  try {
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "content", "read");
    return true;
  } catch {
    return false;
  }
}

// GET /api/orycms/collections/:collection/content/:id — reachable without a session
// (see the sibling content/route.ts comment); a draft is never returned to a caller
// who can't see drafts.
export async function GET(request: NextRequest, { params }: RouteCtx) {
  try {
    const { collection, id } = await params;
    const entry = await getOryCMSContentEntry(collection, id);
    if (entry.status === "draft" && !(await canSeeDrafts(request))) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "ENTRY_NOT_FOUND", message: `Entry "${id}" not found.` },
        },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, data: entry });
  } catch (err) {
    if (err instanceof OryCMSContentError)
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode },
      );
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Request failed." } },
      { status: 500 },
    );
  }
}

// PATCH /api/orycms/collections/:collection/content/:id
export async function PATCH(request: NextRequest, { params }: RouteCtx) {
  try {
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "content", "update");
    const { collection, id } = await params;
    const body = (await request.json()) as { data?: Record<string, unknown> };

    if (!body.data || typeof body.data !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Body must contain a `data` object." },
        },
        { status: 422 },
      );
    }

    const entry = await updateOryCMSContentEntry(collection, id, { data: body.data });
    return NextResponse.json({ success: true, data: entry });
  } catch (err) {
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
  }
}

// DELETE /api/orycms/collections/:collection/content/:id
export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  try {
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "content", "delete");
    const { collection, id } = await params;
    await deleteOryCMSContentEntry(collection, id);
    return NextResponse.json({ success: true, data: null });
  } catch (err) {
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
  }
}
