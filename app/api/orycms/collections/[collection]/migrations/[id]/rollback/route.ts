import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { OryCMSAuthError, protectOryCMSAdminRoute } from "@/auth";
import { loadOryCMSPersistedCollectionsOnStartup } from "@/schema";
import { rollbackOryCMSMigration, OryCMSMigrationError } from "@/migrations";
import { requireOryCMSPermission } from "@/rbac";

type RouteCtx = { params: Promise<{ collection: string; id: string }> };

// POST /api/orycms/collections/:collection/migrations/:id/rollback
export async function POST(request: NextRequest, { params }: RouteCtx) {
  try {
    await loadOryCMSPersistedCollectionsOnStartup();
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "migrations", "manage");

    const { id } = await params;
    const record = await rollbackOryCMSMigration(id, session.email);
    return NextResponse.json({ success: true, data: record });
  } catch (err) {
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
    console.error(err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Rollback failed." } },
      { status: 500 },
    );
  }
}
