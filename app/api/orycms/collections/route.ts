import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { OryCMSAuthError, protectOryCMSAdminRoute } from "@/auth";
import {
  loadOryCMSPersistedCollectionsOnStartup,
  listOryCMSCollections,
  OryCMSCollectionPersistenceError,
  saveOryCMSCollectionSchema,
} from "@/schema";
import type { OryCMSCollectionDefinition } from "@/schema";
import { requireOryCMSPermission } from "@/rbac";

// GET /api/orycms/collections — list all registered collection schemas
export async function GET(_request: NextRequest) {
  await loadOryCMSPersistedCollectionsOnStartup();
  const collections = listOryCMSCollections();
  return NextResponse.json({ success: true, data: collections });
}

// POST /api/orycms/collections — persist a new collection schema
export async function POST(request: NextRequest) {
  try {
    await loadOryCMSPersistedCollectionsOnStartup();
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "collections", "create");

    const body = (await request.json()) as OryCMSCollectionDefinition;
    const collection = await saveOryCMSCollectionSchema(body);
    return NextResponse.json({ success: true, data: collection }, { status: 201 });
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
      { success: false, error: { code: "INTERNAL_ERROR", message: "Could not save schema." } },
      { status: 500 },
    );
  }
}
