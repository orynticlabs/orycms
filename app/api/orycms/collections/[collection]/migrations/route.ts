import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { OryCMSAuthError, protectOryCMSAdminRoute } from "@/auth";
import {
  getOryCMSPersistedCollection,
  loadOryCMSPersistedCollectionsOnStartup,
  OryCMSCollectionPersistenceError,
} from "@/schema";
import { generateOryCMSMigrationPreview } from "@/mapper";
import {
  approveOryCMSMigration,
  executeOryCMSMigration,
  getOryCMSMigrationHistory,
  OryCMSMigrationError,
} from "@/migrations";
import { requireOryCMSPermission } from "@/rbac";

function errResponse(err: unknown) {
  if (err instanceof OryCMSAuthError)
    return NextResponse.json(
      { success: false, error: { code: err.code, message: err.message } },
      { status: err.statusCode },
    );
  if (err instanceof OryCMSMigrationError)
    return NextResponse.json(
      { success: false, error: { code: err.code, message: err.message } },
      { status: err.statusCode },
    );
  if (err instanceof OryCMSCollectionPersistenceError)
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

type RouteCtx = { params: Promise<{ collection: string }> };

// GET /api/orycms/collections/:collection/migrations — migration history
export async function GET(request: NextRequest, { params }: RouteCtx) {
  try {
    await loadOryCMSPersistedCollectionsOnStartup();
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "migrations", "manage");

    const { collection } = await params;
    const history = await getOryCMSMigrationHistory(collection);
    return NextResponse.json({ success: true, data: history });
  } catch (err) {
    return errResponse(err);
  }
}

// POST /api/orycms/collections/:collection/migrations
// Body: { action: "approve" | "execute", migrationId?: string, confirmDestructive?: boolean }
export async function POST(request: NextRequest, { params }: RouteCtx) {
  try {
    await loadOryCMSPersistedCollectionsOnStartup();
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "migrations", "manage");

    const { collection } = await params;
    const body = (await request.json()) as {
      action: "approve" | "execute";
      migrationId?: string;
      confirmDestructive?: boolean;
    };

    if (body.action === "approve") {
      const schema = await getOryCMSPersistedCollection(collection);
      if (!schema)
        return NextResponse.json(
          {
            success: false,
            error: { code: "NOT_FOUND", message: `Collection "${collection}" not found.` },
          },
          { status: 404 },
        );

      const preview = await generateOryCMSMigrationPreview(schema);
      const record = await approveOryCMSMigration(preview, session.email, {
        confirmDestructive: body.confirmDestructive,
      });
      return NextResponse.json({ success: true, data: record }, { status: 201 });
    }

    if (body.action === "execute") {
      if (!body.migrationId)
        return NextResponse.json(
          {
            success: false,
            error: { code: "VALIDATION_ERROR", message: "migrationId required for execute." },
          },
          { status: 422 },
        );

      const record = await executeOryCMSMigration(body.migrationId, session.email);
      return NextResponse.json({ success: true, data: record });
    }

    return NextResponse.json(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: 'action must be "approve" or "execute".' },
      },
      { status: 422 },
    );
  } catch (err) {
    return errResponse(err);
  }
}
