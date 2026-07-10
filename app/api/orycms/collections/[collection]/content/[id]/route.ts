import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getOryCMSContentEntry,
  updateOryCMSContentEntry,
  deleteOryCMSContentEntry,
  OryCMSContentError,
} from "@/content";
import { protectOryCMSAdminRoute, OryCMSAuthError } from "@/auth";

type RouteCtx = { params: Promise<{ collection: string; id: string }> };

// GET /api/orycms/collections/:collection/content/:id
export async function GET(request: NextRequest, { params }: RouteCtx) {
  try {
    const { collection, id } = await params;
    const entry = await getOryCMSContentEntry(collection, id);
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
    await protectOryCMSAdminRoute(request);
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
    await protectOryCMSAdminRoute(request);
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
