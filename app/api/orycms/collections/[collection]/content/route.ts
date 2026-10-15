import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { listOryCMSContentEntries, createOryCMSContentEntry, OryCMSContentError } from "@/content";
import { protectOryCMSAdminRoute, OryCMSAuthError } from "@/auth";
import { requireOryCMSPermission } from "@/rbac";
import type { OryCMSDatabaseQueryFilter, OryCMSDatabaseSortOptions } from "@/database";

type RouteCtx = { params: Promise<{ collection: string }> };

// List and get are intentionally reachable without a session (middleware allow-lists
// GET on these paths for public-site reads of published content). The one thing an
// unauthenticated or unprivileged caller must never get back is a draft:
// canSeeDrafts() is the single place that decides it.

/** True only for a session that holds content:read — the gate for ever returning a draft. */
async function canSeeDrafts(request: NextRequest): Promise<boolean> {
  try {
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "content", "read");
    return true;
  } catch {
    return false;
  }
}

// GET /api/orycms/collections/:collection/content
export async function GET(request: NextRequest, { params }: RouteCtx) {
  try {
    const { collection } = await params;
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? 1);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
    const requestedDrafts = url.searchParams.get("drafts") === "true";
    const includeDrafts = requestedDrafts && (await canSeeDrafts(request));

    // filters: ?filter[field][op]=value
    const filters: OryCMSDatabaseQueryFilter[] = [];
    for (const [key, val] of url.searchParams.entries()) {
      const m = key.match(/^filter\[(.+?)\]\[(.+?)\]$/);
      if (m)
        filters.push({
          field: m[1],
          operator: m[2] as OryCMSDatabaseQueryFilter["operator"],
          value: val,
        });
    }

    // sort: ?sort=field:asc,other:desc
    const sort: OryCMSDatabaseSortOptions[] = (url.searchParams.get("sort") ?? "")
      .split(",")
      .filter(Boolean)
      .map((s) => {
        const [field, dir] = s.split(":");
        return { field, direction: (dir === "asc" ? "asc" : "desc") as "asc" | "desc" };
      });

    const result = await listOryCMSContentEntries(collection, {
      filters,
      sort,
      page,
      limit,
      includeDrafts,
    });

    return NextResponse.json({ success: true, ...result });
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

// POST /api/orycms/collections/:collection/content
export async function POST(request: NextRequest, { params }: RouteCtx) {
  try {
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "content", "create");
    const { collection } = await params;
    const body = (await request.json()) as { data?: Record<string, unknown>; asDraft?: boolean };

    if (!body.data || typeof body.data !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Body must contain a `data` object." },
        },
        { status: 422 },
      );
    }

    const entry = await createOryCMSContentEntry(collection, {
      data: body.data,
      asDraft: body.asDraft,
    });

    return NextResponse.json({ success: true, data: entry }, { status: 201 });
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
