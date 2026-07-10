import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { OryCMSAuthError, protectOryCMSAdminRoute } from "@/auth";
import {
  listOryCMSCollections,
  registerOryCMSCollection,
  validateOryCMSCollectionSchema,
} from "@/schema";
import type { OryCMSCollectionDefinition } from "@/schema";

// GET /api/orycms/collections — list all registered collection schemas
export async function GET(_request: NextRequest) {
  const collections = listOryCMSCollections();
  return NextResponse.json({ success: true, data: collections });
}

function canManageCollections(roleName: string | null): boolean {
  return roleName === "Owner" || roleName === "Admin";
}

// POST /api/orycms/collections — create a new collection schema in the registry only
export async function POST(request: NextRequest) {
  try {
    const session = await protectOryCMSAdminRoute(request);
    if (!canManageCollections(session.roleName)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Owner or Admin role required." } },
        { status: 403 },
      );
    }

    const body = (await request.json()) as OryCMSCollectionDefinition;
    const existingSlugs = new Set(listOryCMSCollections().map((collection) => collection.slug));
    const relationTargets = new Set(existingSlugs);
    if (body.slug) relationTargets.add(body.slug);
    const result = validateOryCMSCollectionSchema(body, {
      registeredSlugs: existingSlugs,
      registeredCollectionSlugs: relationTargets,
    });

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

    const collection = registerOryCMSCollection(body);
    return NextResponse.json({ success: true, data: collection }, { status: 201 });
  } catch (err) {
    if (err instanceof OryCMSAuthError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode },
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Could not save schema." } },
      { status: 500 },
    );
  }
}
