import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { OryCMSAuthError, protectOryCMSAdminRoute } from "@/auth";
import {
  deleteOryCMSPersistedCollection,
  getOryCMSCollection,
  loadOryCMSPersistedCollectionsOnStartup,
  OryCMSCollectionPersistenceError,
  updateOryCMSPersistedCollection,
} from "@/schema";
import type { OryCMSCollectionDefinition } from "@/schema";
import { requireOryCMSPermission } from "@/rbac";

// GET /api/orycms/collections/:collection — get a single collection schema
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ collection: string }> },
) {
  await loadOryCMSPersistedCollectionsOnStartup();
  const { collection } = await params;
  const schema = getOryCMSCollection(collection);
  if (!schema) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "NOT_FOUND", message: `Collection "${collection}" not found.` },
      },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true, data: schema });
}

// PATCH /api/orycms/collections/:collection — update persisted registry schema
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ collection: string }> },
) {
  try {
    await loadOryCMSPersistedCollectionsOnStartup();
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "collections", "update");

    const { collection } = await params;
    const body = (await request.json()) as OryCMSCollectionDefinition;
    const updated = await updateOryCMSPersistedCollection(collection, body);
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    if (err instanceof OryCMSAuthError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode },
      );
    }
    if (err instanceof OryCMSCollectionPersistenceError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: err.code, message: err.message, issues: err.issues },
        },
        { status: err.statusCode },
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Could not update schema." } },
      { status: 500 },
    );
  }
}

// DELETE /api/orycms/collections/:collection — delete persisted registry schema
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ collection: string }> },
) {
  try {
    await loadOryCMSPersistedCollectionsOnStartup();
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "collections", "delete");

    const { collection } = await params;
    await deleteOryCMSPersistedCollection(collection);
    return NextResponse.json({ success: true, data: null });
  } catch (err) {
    if (err instanceof OryCMSAuthError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode },
      );
    }
    if (err instanceof OryCMSCollectionPersistenceError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: err.code, message: err.message, issues: err.issues },
        },
        { status: err.statusCode },
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Could not delete schema." } },
      { status: 500 },
    );
  }
}
