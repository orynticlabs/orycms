import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { OryCMSAuthError, protectOryCMSAdminRoute } from "@/auth";
import { requireOryCMSPermission } from "@/rbac";
import { createOryCMSMediaFolder, listOryCMSMediaFolders, OryCMSMediaError } from "@/media";

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

// GET /api/orycms/media/folders
export async function GET(request: NextRequest) {
  try {
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "media", "read");

    const parentId = request.nextUrl.searchParams.get("parentId");
    const folders = await listOryCMSMediaFolders(
      parentId === "null" ? null : (parentId ?? undefined),
    );
    return NextResponse.json({ success: true, data: folders });
  } catch (err) {
    return errResponse(err);
  }
}

// POST /api/orycms/media/folders
export async function POST(request: NextRequest) {
  try {
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "media", "create");

    const body = (await request.json()) as { name: string; parentId?: string };
    const folder = await createOryCMSMediaFolder({ name: body.name, parentId: body.parentId });
    return NextResponse.json({ success: true, data: folder }, { status: 201 });
  } catch (err) {
    return errResponse(err);
  }
}
