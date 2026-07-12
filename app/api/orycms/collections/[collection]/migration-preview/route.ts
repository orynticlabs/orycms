import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { OryCMSAuthError, protectOryCMSAdminRoute } from "@/auth";
import {
  getOryCMSPersistedCollection,
  loadOryCMSPersistedCollectionsOnStartup,
  OryCMSCollectionPersistenceError,
} from "@/schema";
import { generateOryCMSMigrationPreview } from "@/mapper";
import { requireOryCMSPermission } from "@/rbac";

// POST /api/orycms/collections/:collection/migration-preview
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ collection: string }> },
) {
  try {
    await loadOryCMSPersistedCollectionsOnStartup();
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "migrations", "manage");

    const { collection } = await params;
    const schema = await getOryCMSPersistedCollection(collection);
    if (!schema) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: `Collection "${collection}" not found.` },
        },
        { status: 404 },
      );
    }

    const preview = await generateOryCMSMigrationPreview(schema);
    return NextResponse.json({ success: true, data: preview });
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
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Could not generate migration preview." },
      },
      { status: 500 },
    );
  }
}
