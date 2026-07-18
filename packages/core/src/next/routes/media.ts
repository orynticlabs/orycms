import { protectOryCMSAdminRoute } from "@/auth";
import { requireOryCMSPermission } from "@/rbac";
import {
  uploadOryCMSMedia,
  listOryCMSMedia,
  getOryCMSMedia,
  updateOryCMSMedia,
  deleteOryCMSMedia,
  moveOryCMSMedia,
  createOryCMSMediaFolder,
  listOryCMSMediaFolders,
} from "@/media";
import type { OryCMSRoute } from "../dispatcher";
import { jsonOk, jsonRaw, jsonError } from "../http";

const listMedia: OryCMSRoute = {
  method: "GET",
  pattern: "media",
  handler: async ({ request, url }) => {
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "media", "read");
    const sp = url.searchParams;
    const page = parseInt(sp.get("page") ?? "1", 10);
    const limit = Math.min(parseInt(sp.get("limit") ?? "20", 10), 100);
    const search = sp.get("search") ?? undefined;
    const folderId = sp.has("folderId") ? (sp.get("folderId") ?? null) : undefined;
    const type = sp.get("type") ?? undefined;
    const sort = (sp.get("sort") as "name" | "size" | "created_at") ?? "created_at";
    const dir = (sp.get("dir") as "asc" | "desc") ?? "desc";
    const result = await listOryCMSMedia({ page, limit, search, folderId, type, sort, dir });
    return jsonRaw({ success: true, ...result });
  },
};

const uploadMedia: OryCMSRoute = {
  method: "POST",
  pattern: "media",
  handler: async ({ request }) => {
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "media", "create");
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return jsonError("VALIDATION_ERROR", "file is required.", 422);
    }
    const folderId = (formData.get("folderId") as string | null) ?? undefined;
    const buffer = Buffer.from(await file.arrayBuffer());
    const asset = await uploadOryCMSMedia(
      { buffer, name: file.name, mimeType: file.type, size: file.size },
      session.email,
      folderId,
    );
    return jsonOk(asset, 201);
  },
};

// Folders must be registered BEFORE media/:id so the literal "folders" wins over the param.
const listFolders: OryCMSRoute = {
  method: "GET",
  pattern: "media/folders",
  handler: async ({ request, url }) => {
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "media", "read");
    const parentId = url.searchParams.get("parentId");
    const folders = await listOryCMSMediaFolders(
      parentId === "null" ? null : (parentId ?? undefined),
    );
    return jsonOk(folders);
  },
};

const createFolder: OryCMSRoute = {
  method: "POST",
  pattern: "media/folders",
  handler: async ({ request }) => {
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "media", "create");
    const body = (await request.json()) as { name: string; parentId?: string };
    const folder = await createOryCMSMediaFolder({ name: body.name, parentId: body.parentId });
    return jsonOk(folder, 201);
  },
};

const getMedia: OryCMSRoute = {
  method: "GET",
  pattern: "media/:id",
  handler: async ({ request, params }) => {
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "media", "read");
    const asset = await getOryCMSMedia(params.id);
    return jsonOk(asset);
  },
};

const patchMedia: OryCMSRoute = {
  method: "PATCH",
  pattern: "media/:id",
  handler: async ({ request, params }) => {
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "media", "update");
    const body = (await request.json()) as {
      name?: string;
      altText?: string;
      caption?: string;
      folderId?: string | null;
    };
    if ("folderId" in body) {
      const asset = await moveOryCMSMedia(params.id, body.folderId ?? null);
      return jsonOk(asset);
    }
    const asset = await updateOryCMSMedia(params.id, {
      name: body.name,
      altText: body.altText,
      caption: body.caption,
    });
    return jsonOk(asset);
  },
};

const deleteMedia: OryCMSRoute = {
  method: "DELETE",
  pattern: "media/:id",
  handler: async ({ request, params }) => {
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "media", "delete");
    await deleteOryCMSMedia(params.id);
    return jsonOk(null);
  },
};

export const mediaRoutes: OryCMSRoute[] = [
  listMedia,
  uploadMedia,
  listFolders,
  createFolder,
  getMedia,
  patchMedia,
  deleteMedia,
];
