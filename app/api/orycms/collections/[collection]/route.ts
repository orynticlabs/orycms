import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { OryCMSAuthError, protectOryCMSAdminRoute } from "@/auth";
import {
  getOryCMSCollection,
  listOryCMSCollections,
  updateOryCMSCollectionSchema,
  validateOryCMSCollectionSchema,
} from "@/schema";
import type { OryCMSCollectionDefinition } from "@/schema";

// GET /api/orycms/collections/:collection — get a single collection schema
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ collection: string }> },
) {
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

function canManageCollections(roleName: string | null): boolean {
  return roleName === "Owner" || roleName === "Admin";
}

// PATCH /api/orycms/collections/:collection — update registry schema only
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ collection: string }> },
) {
  try {
    const session = await protectOryCMSAdminRoute(request);
    if (!canManageCollections(session.roleName)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Owner or Admin role required." } },
        { status: 403 },
      );
    }

    const { collection } = await params;
    const body = (await request.json()) as OryCMSCollectionDefinition;
    const existingSlugs = new Set(
      listOryCMSCollections()
        .map((registered) => registered.slug)
        .filter((slug) => slug !== collection),
    );
    const relationTargets = new Set(listOryCMSCollections().map((registered) => registered.slug));
    relationTargets.add(collection);

    const result = validateOryCMSCollectionSchema(
      { ...body, slug: collection },
      {
        registeredSlugs: existingSlugs,
        registeredCollectionSlugs: relationTargets,
      },
    );

    if (!result.valid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SCHEMA_VALIDATION_ERROR",
            message: "Collection schema is invalid.",
            issues: result.issues,
          },
        },
        { status: 400 },
      );
    }

    const { slug: _slug, ...updates } = body;
    const updated = updateOryCMSCollectionSchema(collection, updates);
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    if (err instanceof OryCMSAuthError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode },
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Could not update schema." } },
      { status: 500 },
    );
  }
}

// DELETE /api/orycms/collections/:collection (stub)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ collection: string }> },
) {
  void params;
  return NextResponse.json(
    { success: false, error: { code: "NOT_IMPLEMENTED", message: "Not implemented" } },
    { status: 501 },
  );
}
