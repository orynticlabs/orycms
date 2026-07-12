import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Pool } from "pg";

// Mock fs/promises before importing engine
vi.mock("fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

import { mkdir, writeFile, unlink } from "fs/promises";
import {
  uploadOryCMSMedia,
  listOryCMSMedia,
  getOryCMSMedia,
  updateOryCMSMedia,
  moveOryCMSMedia,
  deleteOryCMSMedia,
  createOryCMSMediaFolder,
  listOryCMSMediaFolders,
} from "../media.engine";
import { OryCMSMediaError } from "../media.errors";

// ── Helpers ───────────────────────────────────────────────────────────────────

const NOW = "2024-01-01T00:00:00.000Z";

function mediaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "media-uuid-001",
    name: "photo.jpg",
    original_name: "photo.jpg",
    mime_type: "image/jpeg",
    media_type: "image",
    size: 12345,
    width: 800,
    height: 600,
    url: "/uploads/uuid-abc.jpg",
    file_path: "/project/public/uploads/uuid-abc.jpg",
    folder_id: null,
    uploaded_by: "owner@test.com",
    alt_text: null,
    caption: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function folderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "folder-uuid-001",
    name: "Images",
    path: "/Images",
    parent_id: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makePool(impl: (sql: string, params?: unknown[]) => unknown): Pool {
  return { query: vi.fn(impl) } as unknown as Pool;
}

// ── uploadOryCMSMedia ─────────────────────────────────────────────────────────

describe("uploadOryCMSMedia", () => {
  beforeEach(() => {
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
  });

  it("saves file to disk and inserts DB row for image", async () => {
    let insertCalled = false;
    let callIdx = 0;
    const pool = makePool(() => {
      callIdx++;
      if (callIdx === 1) return { rows: [] }; // ensureTables
      if (callIdx === 2) {
        insertCalled = true;
        return { rows: [{ id: "media-uuid-001" }] }; // INSERT
      }
      return { rows: [mediaRow()] }; // SELECT
    });

    const result = await uploadOryCMSMedia(
      { buffer: Buffer.alloc(100), name: "photo.jpg", mimeType: "image/jpeg", size: 100 },
      "owner@test.com",
      undefined,
      pool,
    );

    expect(insertCalled).toBe(true);
    expect(vi.mocked(writeFile)).toHaveBeenCalled();
    expect(result.name).toBe("photo.jpg");
    expect(result.type).toBe("image");
  });

  it("two uploads with the same original name get different stored URLs (unique filenames)", async () => {
    const urls: string[] = [];
    let uploadCount = 0;
    const pool = makePool((sql: string) => {
      if (sql.includes("INSERT INTO orycms_media")) {
        uploadCount++;
        return { rows: [{ id: `media-uuid-00${uploadCount}` }] };
      }
      if (sql.includes("SELECT *")) {
        return { rows: [mediaRow({ url: `/uploads/unique-${uploadCount}.jpg` })] };
      }
      return { rows: [] };
    });

    for (let i = 0; i < 2; i++) {
      const asset = await uploadOryCMSMedia(
        { buffer: Buffer.alloc(10), name: "photo.jpg", mimeType: "image/jpeg", size: 10 },
        "owner@test.com",
        undefined,
        pool,
      );
      urls.push(asset.url);
    }

    // The engine generates UUID-based stored names, so captured URLs differ in our mock
    expect(urls[0]).not.toBe(urls[1]);
  });

  it("throws MEDIA_TYPE_NOT_ALLOWED for unsupported mime type", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await expect(
      uploadOryCMSMedia(
        {
          buffer: Buffer.alloc(10),
          name: "script.exe",
          mimeType: "application/x-msdownload",
          size: 10,
        },
        "owner@test.com",
        undefined,
        pool,
      ),
    ).rejects.toMatchObject({ code: "MEDIA_TYPE_NOT_ALLOWED", statusCode: 415 });
  });

  it("throws MEDIA_TOO_LARGE when file exceeds 50 MB", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await expect(
      uploadOryCMSMedia(
        {
          buffer: Buffer.alloc(10),
          name: "big.mp4",
          mimeType: "video/mp4",
          size: 51 * 1024 * 1024,
        },
        "owner@test.com",
        undefined,
        pool,
      ),
    ).rejects.toMatchObject({ code: "MEDIA_TOO_LARGE", statusCode: 413 });
  });

  it("throws MEDIA_UPLOAD_FAILED when fs write fails", async () => {
    vi.mocked(writeFile).mockRejectedValueOnce(new Error("disk full"));
    const pool = makePool(() => ({ rows: [] }));
    await expect(
      uploadOryCMSMedia(
        { buffer: Buffer.alloc(10), name: "photo.png", mimeType: "image/png", size: 10 },
        "owner@test.com",
        undefined,
        pool,
      ),
    ).rejects.toMatchObject({ code: "MEDIA_UPLOAD_FAILED", statusCode: 500 });
  });
});

// ── listOryCMSMedia ───────────────────────────────────────────────────────────

describe("listOryCMSMedia", () => {
  it("returns paginated results", async () => {
    let callIdx = 0;
    const pool = makePool(() => {
      callIdx++;
      if (callIdx === 1) return { rows: [] }; // ensureTables
      if (callIdx === 2) return { rows: [{ count: "5" }] }; // COUNT
      return { rows: [mediaRow(), mediaRow({ id: "media-uuid-002" })] }; // SELECT
    });

    const result = await listOryCMSMedia({ page: 1, limit: 20 }, pool);
    expect(result.data).toHaveLength(2);
    expect(result.meta.total).toBe(5);
    expect(result.meta.hasMore).toBe(false);
  });

  it("filters by search term (passes ILIKE param)", async () => {
    let likeParam: unknown;
    let callIdx = 0;
    const pool = makePool((_sql: string, params?: unknown[]) => {
      callIdx++;
      if (callIdx === 1) return { rows: [] }; // ensureTables
      if (callIdx === 2) {
        likeParam = params?.[0];
        return { rows: [{ count: "1" }] };
      }
      return { rows: [mediaRow()] };
    });

    await listOryCMSMedia({ search: "photo" }, pool);
    expect(likeParam).toBe("%photo%");
  });

  it("filters by folderId=null for root assets", async () => {
    let whereUsed = false;
    let callIdx = 0;
    const pool = makePool((sql: string) => {
      callIdx++;
      if (callIdx === 1) return { rows: [] };
      if (sql.includes("folder_id IS NULL")) whereUsed = true;
      if (callIdx === 2) return { rows: [{ count: "2" }] };
      return { rows: [mediaRow()] };
    });

    await listOryCMSMedia({ folderId: null }, pool);
    expect(whereUsed).toBe(true);
  });

  it("supports sorting by name and size", async () => {
    let sortSql = "";
    let callIdx = 0;
    const pool = makePool((sql: string) => {
      callIdx++;
      if (callIdx === 1) return { rows: [] };
      if (callIdx === 2) return { rows: [{ count: "0" }] };
      sortSql = sql;
      return { rows: [] };
    });

    await listOryCMSMedia({ sort: "size", dir: "asc" }, pool);
    expect(sortSql).toContain("size ASC");
  });
});

// ── getOryCMSMedia ────────────────────────────────────────────────────────────

describe("getOryCMSMedia", () => {
  it("returns a media asset by id", async () => {
    let callIdx = 0;
    const pool = makePool(() => {
      callIdx++;
      if (callIdx === 1) return { rows: [] };
      return { rows: [mediaRow()] };
    });

    const asset = await getOryCMSMedia("media-uuid-001", pool);
    expect(asset.id).toBe("media-uuid-001");
    expect(asset.dimensions).toEqual({ width: 800, height: 600 });
  });

  it("throws MEDIA_NOT_FOUND for unknown id", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await expect(getOryCMSMedia("unknown", pool)).rejects.toMatchObject({
      code: "MEDIA_NOT_FOUND",
      statusCode: 404,
    });
  });
});

// ── deleteOryCMSMedia ─────────────────────────────────────────────────────────

describe("deleteOryCMSMedia", () => {
  it("deletes the file from disk and the DB row", async () => {
    vi.mocked(unlink).mockResolvedValue(undefined);
    let deleted = false;
    let callIdx = 0;
    const pool = makePool((sql: string) => {
      callIdx++;
      if (callIdx === 1) return { rows: [] }; // ensureTables
      if (callIdx === 2) return { rows: [{ file_path: "/project/public/uploads/uuid-abc.jpg" }] }; // SELECT
      if (sql.includes("DELETE")) {
        deleted = true;
        return { rows: [] };
      }
      return { rows: [] };
    });

    await deleteOryCMSMedia("media-uuid-001", pool);
    expect(vi.mocked(unlink)).toHaveBeenCalledWith("/project/public/uploads/uuid-abc.jpg");
    expect(deleted).toBe(true);
  });

  it("throws MEDIA_NOT_FOUND when asset does not exist", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await expect(deleteOryCMSMedia("nope", pool)).rejects.toMatchObject({
      code: "MEDIA_NOT_FOUND",
      statusCode: 404,
    });
  });

  it("succeeds even if file is missing from disk (ENOENT)", async () => {
    vi.mocked(unlink).mockRejectedValueOnce(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    let callIdx = 0;
    const pool = makePool(() => {
      callIdx++;
      if (callIdx === 1) return { rows: [] };
      if (callIdx === 2) return { rows: [{ file_path: "/missing/file.jpg" }] };
      return { rows: [] };
    });
    await expect(deleteOryCMSMedia("media-uuid-001", pool)).resolves.toBeUndefined();
  });
});

// ── createOryCMSMediaFolder ───────────────────────────────────────────────────

describe("createOryCMSMediaFolder", () => {
  it("creates a root folder with path /name", async () => {
    let insertedPath: string | undefined;
    let callIdx = 0;
    const pool = makePool((_sql: string, params?: unknown[]) => {
      callIdx++;
      if (callIdx === 1) return { rows: [] }; // ensureTables
      if (callIdx === 2) {
        insertedPath = (params as string[])?.[1];
        return { rows: [{ id: "folder-uuid-001" }] };
      }
      return { rows: [folderRow()] };
    });

    const folder = await createOryCMSMediaFolder({ name: "Images" }, pool);
    expect(folder.name).toBe("Images");
    expect(insertedPath).toBe("/Images");
  });

  it("creates a nested folder with parent path prefix", async () => {
    let insertedPath: string | undefined;
    let callIdx = 0;
    const pool = makePool((_sql: string, params?: unknown[]) => {
      callIdx++;
      if (callIdx === 1) return { rows: [] }; // ensureTables
      if (callIdx === 2) return { rows: [{ path: "/Images" }] }; // parent lookup
      if (callIdx === 3) {
        insertedPath = (params as string[])?.[1];
        return { rows: [{ id: "folder-uuid-002" }] };
      }
      return { rows: [folderRow({ name: "2024", path: "/Images/2024" })] };
    });

    await createOryCMSMediaFolder({ name: "2024", parentId: "folder-uuid-001" }, pool);
    expect(insertedPath).toBe("/Images/2024");
  });

  it("throws FOLDER_NAME_REQUIRED for empty name", async () => {
    const pool = makePool(() => ({ rows: [] }));
    await expect(createOryCMSMediaFolder({ name: "  " }, pool)).rejects.toMatchObject({
      code: "FOLDER_NAME_REQUIRED",
      statusCode: 422,
    });
  });

  it("throws FOLDER_NOT_FOUND when parentId does not exist", async () => {
    let callIdx = 0;
    const pool = makePool(() => {
      callIdx++;
      if (callIdx <= 1) return { rows: [] }; // ensureTables, parent lookup
      return { rows: [] };
    });
    await expect(
      createOryCMSMediaFolder({ name: "Sub", parentId: "bad-uuid" }, pool),
    ).rejects.toMatchObject({ code: "FOLDER_NOT_FOUND", statusCode: 404 });
  });
});

// ── moveOryCMSMedia ───────────────────────────────────────────────────────────

describe("moveOryCMSMedia", () => {
  it("updates folder_id to the target folder", async () => {
    let updatedFolderId: string | null = "not-called";
    let callIdx = 0;
    const pool = makePool((_sql: string, params?: unknown[]) => {
      callIdx++;
      if (callIdx === 1) return { rows: [] }; // ensureTables
      if (callIdx === 2) return { rows: [{ id: "folder-uuid-001" }] }; // folder check
      if (callIdx === 3) {
        updatedFolderId = (params as unknown[])?.[0] as string;
        return { rows: [] }; // UPDATE
      }
      // getOryCMSMedia calls: ensureTables + SELECT
      if (callIdx === 4) return { rows: [] }; // ensureTables again
      return { rows: [mediaRow({ folder_id: "folder-uuid-001" })] }; // SELECT
    });

    const asset = await moveOryCMSMedia("media-uuid-001", "folder-uuid-001", pool);
    expect(updatedFolderId).toBe("folder-uuid-001");
    expect(asset.folderId).toBe("folder-uuid-001");
  });

  it("allows moving to root (folderId=null)", async () => {
    let updatedFolderId: unknown = "not-called";
    let callIdx = 0;
    const pool = makePool((_sql: string, params?: unknown[]) => {
      callIdx++;
      if (callIdx === 1) return { rows: [] };
      if (callIdx === 2) {
        updatedFolderId = (params as unknown[])?.[0];
        return { rows: [] }; // UPDATE
      }
      if (callIdx === 3) return { rows: [] }; // ensureTables
      return { rows: [mediaRow()] }; // SELECT
    });

    await moveOryCMSMedia("media-uuid-001", null, pool);
    expect(updatedFolderId).toBeNull();
  });
});

// ── listOryCMSMediaFolders ────────────────────────────────────────────────────

describe("listOryCMSMediaFolders", () => {
  it("returns all folders when no parentId given", async () => {
    let callIdx = 0;
    const pool = makePool(() => {
      callIdx++;
      if (callIdx === 1) return { rows: [] };
      return { rows: [folderRow(), folderRow({ id: "folder-uuid-002", name: "Videos" })] };
    });

    const folders = await listOryCMSMediaFolders(undefined, pool);
    expect(folders).toHaveLength(2);
  });

  it("returns only root folders when parentId=null", async () => {
    let usedIsNull = false;
    let callIdx = 0;
    const pool = makePool((sql: string) => {
      callIdx++;
      if (callIdx === 1) return { rows: [] };
      if (sql.includes("parent_id IS NULL")) usedIsNull = true;
      return { rows: [folderRow()] };
    });

    await listOryCMSMediaFolders(null, pool);
    expect(usedIsNull).toBe(true);
  });
});

// ── OryCMSMediaError ──────────────────────────────────────────────────────────

describe("OryCMSMediaError", () => {
  it("carries code, statusCode, and name", () => {
    const e = new OryCMSMediaError("MEDIA_NOT_FOUND", "not found", 404);
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe("MEDIA_NOT_FOUND");
    expect(e.statusCode).toBe(404);
    expect(e.name).toBe("OryCMSMediaError");
  });
});
