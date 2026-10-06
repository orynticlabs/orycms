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
import type { OryCMSHandlerContext } from "../http";
import type { OryCMSRoute } from "../dispatcher";
import { jsonOk, jsonRaw, statusError } from "../http";
import { readObjectBody } from "../request-body";
import { safeRouteError } from "../route-errors";

// ── Rules ───────────────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 50 * 1024 * 1024;
/** Allowance for the multipart envelope around the file, checked against Content-Length. */
const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;
const MAX_NAME_LENGTH = 255;
const MAX_ALT_TEXT = 500;
const MAX_CAPTION = 1000;
const MAX_FOLDER_ID_LENGTH = 64;
const MAX_SEARCH_LENGTH = 200;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SORT_FIELDS = ["name", "size", "created_at"] as const;
const DIRECTIONS = ["asc", "desc"] as const;
const MEDIA_TYPES = ["image", "video", "document"] as const;

// ── Helpers ─────────────────────────────────────────────────────────────────────

const invalid = (message: string): Error => statusError("VALIDATION_ERROR", message, 422);

/** Wraps a handler so a thrown error becomes the shared safe response. */
function guarded(
  context: string,
  fn: (ctx: OryCMSHandlerContext) => Promise<Response>,
): (ctx: OryCMSHandlerContext) => Promise<Response> {
  return async (ctx) => {
    try {
      return await fn(ctx);
    } catch (err) {
      return safeRouteError(context, err);
    }
  };
}

function requireUuid(id: string): string {
  if (!UUID_PATTERN.test(id)) throw invalid("Invalid media id.");
  return id;
}

/** Reads an optional whole-number query value within a range. Anything else is a 422. */
function wholeNumber(
  raw: string | null,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw === null || raw === "") return fallback;
  if (!/^\d+$/.test(raw)) throw invalid(`${name} must be a whole number.`);
  const value = Number(raw);
  if (value < min || value > max) throw invalid(`${name} must be between ${min} and ${max}.`);
  return value;
}

function choice<T extends string>(
  raw: string | null,
  allowed: readonly T[],
  fallback: T,
  name: string,
): T {
  if (raw === null || raw === "") return fallback;
  if (!(allowed as readonly string[]).includes(raw))
    throw invalid(`${name} is not a supported value.`);
  return raw as T;
}

/**
 * Keeps only the base name of a client-supplied filename, with control characters
 * removed. The result is a display name only. It is never used to build a stored path.
 */
export function sanitizeDisplayName(raw: string): string {
  const withoutControls = Array.from(raw)
    .filter((ch) => ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) !== 0x7f)
    .join("");
  const base = withoutControls.split(/[\\/]/).pop() ?? "";
  const trimmed = base.trim();
  const name = trimmed === "" || trimmed === "." || trimmed === ".." ? "upload" : trimmed;
  return name.slice(0, MAX_NAME_LENGTH);
}

function optionalString(value: unknown, name: string, max: number): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > max) {
    throw invalid(`${name} must be a string of at most ${max} characters.`);
  }
  return value;
}

// ── Media ───────────────────────────────────────────────────────────────────────

const listMedia: OryCMSRoute = {
  method: "GET",
  pattern: "media",
  handler: guarded("media.list", async ({ request, url }) => {
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "media", "read");
    const sp = url.searchParams;
    const page = wholeNumber(sp.get("page"), "page", 1, 1, 100000);
    const limit = wholeNumber(sp.get("limit"), "limit", 20, 1, 100);
    const search = sp.get("search") ?? undefined;
    if (search !== undefined && search.length > MAX_SEARCH_LENGTH) {
      throw invalid(`search must be at most ${MAX_SEARCH_LENGTH} characters.`);
    }
    const folderRaw = sp.get("folderId");
    if (folderRaw !== null && folderRaw.length > MAX_FOLDER_ID_LENGTH)
      throw invalid("folderId is invalid.");
    const folderId = sp.has("folderId") ? folderRaw : undefined;
    const type = sp.get("type") ?? undefined;
    if (type !== undefined) choice(type, MEDIA_TYPES, "image", "type");
    const sort = choice(sp.get("sort"), SORT_FIELDS, "created_at", "sort");
    const dir = choice(sp.get("dir"), DIRECTIONS, "desc", "dir");
    const result = await listOryCMSMedia({ page, limit, search, folderId, type, sort, dir });
    return jsonRaw({ success: true, ...result });
  }),
};

const uploadMedia: OryCMSRoute = {
  method: "POST",
  pattern: "media",
  handler: guarded("media.upload", async ({ request }) => {
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "media", "create");

    // Refuse an oversized declared body before any of it is read.
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (declared > MAX_FILE_BYTES + MULTIPART_OVERHEAD_BYTES) {
      throw statusError("MEDIA_TOO_LARGE", "File exceeds the 50 MB limit.", 413);
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw invalid("Request must be multipart form data.");
    }

    const files = formData.getAll("file");
    if (files.length !== 1 || typeof files[0] === "string") {
      throw invalid("Send exactly one file in the 'file' field.");
    }
    const file = files[0] as File;

    const folderValue = formData.get("folderId");
    if (
      folderValue !== null &&
      (typeof folderValue !== "string" || folderValue.length > MAX_FOLDER_ID_LENGTH)
    ) {
      throw invalid("folderId is invalid.");
    }
    const folderId =
      typeof folderValue === "string" && folderValue !== "" ? folderValue : undefined;

    const buffer = Buffer.from(await file.arrayBuffer());
    const asset = await uploadOryCMSMedia(
      { buffer, name: sanitizeDisplayName(file.name), mimeType: file.type, size: file.size },
      session.email,
      folderId,
    );
    return jsonOk(asset, 201);
  }),
};

const listFolders: OryCMSRoute = {
  method: "GET",
  pattern: "media/folders",
  handler: guarded("media.folders.list", async ({ request, url }) => {
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "media", "read");
    const parentId = url.searchParams.get("parentId");
    const folders = await listOryCMSMediaFolders(
      parentId === "null" ? null : (parentId ?? undefined),
    );
    return jsonOk(folders);
  }),
};

const createFolder: OryCMSRoute = {
  method: "POST",
  pattern: "media/folders",
  handler: guarded("media.folders.create", async ({ request }) => {
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "media", "create");
    const body = await readObjectBody(request);
    if (typeof body.name !== "string" || body.name.trim() === "" || body.name.length > 100) {
      throw invalid("Folder name must be a string of 1 to 100 characters.");
    }
    const parentId =
      body.parentId === null
        ? undefined
        : optionalString(body.parentId, "parentId", MAX_FOLDER_ID_LENGTH);
    const folder = await createOryCMSMediaFolder({ name: body.name, parentId });
    return jsonOk(folder, 201);
  }),
};

const getMedia: OryCMSRoute = {
  method: "GET",
  pattern: "media/:id",
  handler: guarded("media.get", async ({ request, params }) => {
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "media", "read");
    return jsonOk(await getOryCMSMedia(requireUuid(params.id)));
  }),
};

const patchMedia: OryCMSRoute = {
  method: "PATCH",
  pattern: "media/:id",
  handler: guarded("media.update", async ({ request, params }) => {
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "media", "update");
    const id = requireUuid(params.id);
    const body = await readObjectBody(request);

    if ("folderId" in body) {
      const folderId =
        body.folderId === null
          ? null
          : optionalString(body.folderId, "folderId", MAX_FOLDER_ID_LENGTH);
      return jsonOk(await moveOryCMSMedia(id, folderId ?? null));
    }

    const name = optionalString(body.name, "name", MAX_NAME_LENGTH);
    if (name !== undefined && name.trim() === "") throw invalid("name must not be empty.");
    const altText = optionalString(body.altText, "altText", MAX_ALT_TEXT);
    const caption = optionalString(body.caption, "caption", MAX_CAPTION);
    return jsonOk(await updateOryCMSMedia(id, { name, altText, caption }));
  }),
};

const deleteMedia: OryCMSRoute = {
  method: "DELETE",
  pattern: "media/:id",
  handler: guarded("media.delete", async ({ request, params }) => {
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "media", "delete");
    await deleteOryCMSMedia(requireUuid(params.id));
    return jsonOk(null);
  }),
};

// Folders must be registered BEFORE media/:id so the literal "folders" wins over the param.
export const mediaRoutes: OryCMSRoute[] = [
  listMedia,
  uploadMedia,
  listFolders,
  createFolder,
  getMedia,
  patchMedia,
  deleteMedia,
];
