import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { OryCMSAuthError, protectOryCMSAdminRoute } from "@/auth";
import { requireOryCMSPermission } from "@/rbac";
import { uploadOryCMSMedia, listOryCMSMedia, OryCMSMediaError } from "@/media";

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

// GET /api/orycms/media — list media assets
export async function GET(request: NextRequest) {
  try {
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "media", "read");

    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
    const search = searchParams.get("search") ?? undefined;
    const folderId = searchParams.has("folderId")
      ? (searchParams.get("folderId") ?? null)
      : undefined;
    const type = searchParams.get("type") ?? undefined;
    const sort = (searchParams.get("sort") as "name" | "size" | "created_at") ?? "created_at";
    const dir = (searchParams.get("dir") as "asc" | "desc") ?? "desc";

    const result = await listOryCMSMedia({ page, limit, search, folderId, type, sort, dir });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return errResponse(err);
  }
}

// POST /api/orycms/media — upload a media asset (multipart/form-data)
export async function POST(request: NextRequest) {
  try {
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "media", "create");

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "file is required." } },
        { status: 422 },
      );
    }

    const folderId = (formData.get("folderId") as string | null) ?? undefined;
    const buffer = Buffer.from(await file.arrayBuffer());

    const asset = await uploadOryCMSMedia(
      { buffer, name: file.name, mimeType: file.type, size: file.size },
      session.email,
      folderId,
    );

    return NextResponse.json({ success: true, data: asset }, { status: 201 });
  } catch (err) {
    return errResponse(err);
  }
}
