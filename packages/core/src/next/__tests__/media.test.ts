import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, readdir, readFile, rm, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import type { OryCMSRoute } from "../dispatcher";
import { safeRouteError } from "../route-errors";

// Media routes. Auth, RBAC and the pool are mocked. Files are written only inside an
// OS temp directory that each test creates and removes. The repository is never written.

const protectOryCMSAdminRoute = vi.fn();
const requireOryCMSPermission = vi.fn();
const fakeQuery = vi.fn();
const fakePool = { query: (...args: unknown[]) => fakeQuery(...args) };

const { OryCMSAuthError } = vi.hoisted(() => {
  class OryCMSAuthError extends Error {
    code: string;
    statusCode: number;
    constructor(code: string, message: string, statusCode = 401) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
    }
  }
  return { OryCMSAuthError };
});

vi.mock("@/auth", () => ({
  protectOryCMSAdminRoute: (...args: unknown[]) => protectOryCMSAdminRoute(...args),
  OryCMSAuthError,
}));

vi.mock("@/rbac", () => ({
  requireOryCMSPermission: (...args: unknown[]) => requireOryCMSPermission(...args),
  getOryCMSUserPermissions: vi.fn(async () => new Set<string>()),
  clearOryCMSPermissionCache: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getOryCMSPool: () => fakePool,
}));

// Import AFTER mocks are registered.
const { mediaRoutes } = await import("../routes/media");
const { deleteOryCMSMedia } = await import("@/media");

function findRoute(method: string, pattern: string): OryCMSRoute {
  const route = mediaRoutes.find((r) => r.method === method && r.pattern === pattern);
  if (!route) throw new Error(`${method} ${pattern} not found in mediaRoutes`);
  return route;
}

const listRoute = findRoute("GET", "media");
const uploadRoute = findRoute("POST", "media");
const getRoute = findRoute("GET", "media/:id");
const patchRoute = findRoute("PATCH", "media/:id");
const deleteRoute = findRoute("DELETE", "media/:id");

const SESSION = { userId: "admin-1", email: "admin@example.test", roleName: "Owner" };
const VALID_ID = "11111111-1111-4111-8111-111111111111";

// Byte signatures of real files, used so uploads match their claimed type.
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0,
]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const PDF_BYTES = Buffer.from("%PDF-1.4\n%test\n", "utf8");

const FAKE_URL = "postgresql://svc_user:Hunter2-fake@db.internal.example:5432/orycms_prod";
const FAKE_PASSWORD = "Hunter2-fake";

function driverError(message: string, code = "28P01"): Error {
  return Object.assign(new Error(message), { code });
}

const FORBIDDEN = new OryCMSAuthError(
  "FORBIDDEN",
  "You do not have permission to perform this action.",
  403,
);

let tmpRoot: string;
let cwdSpy: ReturnType<typeof vi.spyOn>;
let consoleError: ReturnType<typeof vi.spyOn>;

/** Stored media rows, as the pool returns them. */
const MEDIA_ROW = {
  id: VALID_ID,
  name: "photo.png",
  original_name: "photo.png",
  mime_type: "image/png",
  media_type: "image",
  size: 16,
  width: null,
  height: null,
  url: "/uploads/stored.png",
  file_path: "",
  folder_id: null,
  uploaded_by: "admin@example.test",
  alt_text: null,
  caption: null,
  created_at: "2026-10-06T00:00:00.000Z",
  updated_at: "2026-10-06T00:00:00.000Z",
};

/** The display name of the most recent insert, so the returned row reflects what was stored. */
let lastInsertedName = "photo.png";

function defaultQuery(sql: string, params: unknown[] = []): { rows: unknown[]; count?: string } {
  if (sql.includes("CREATE TABLE")) return { rows: [] };
  if (sql.includes("INSERT INTO orycms_media") && !sql.includes("folders")) {
    lastInsertedName = String(params[0]);
    return { rows: [{ id: VALID_ID }] };
  }
  if (sql.includes("SELECT COUNT(*)")) return { rows: [{ count: "1" }] };
  if (sql.includes("SELECT * FROM orycms_media WHERE id")) {
    return { rows: params[0] === VALID_ID ? [{ ...MEDIA_ROW, name: lastInsertedName }] : [] };
  }
  if (sql.includes("SELECT file_path FROM orycms_media")) {
    return {
      rows:
        params[0] === VALID_ID
          ? [{ file_path: path.join(tmpRoot, "public", "uploads", "stored.png") }]
          : [],
    };
  }
  if (sql.includes("SELECT * FROM orycms_media")) return { rows: [MEDIA_ROW] };
  return { rows: [] };
}

function multipart(parts: {
  file?: { name: string; type: string; bytes: Buffer };
  extra?: Array<{ name: string; bytes: Buffer; filename: string; type: string }>;
  fields?: Record<string, string>;
}): FormData {
  const form = new FormData();
  if (parts.file) {
    form.append(
      "file",
      new File([new Uint8Array(parts.file.bytes)], parts.file.name, { type: parts.file.type }),
    );
  }
  for (const extra of parts.extra ?? []) {
    form.append(
      extra.name,
      new File([new Uint8Array(extra.bytes)], extra.filename, { type: extra.type }),
    );
  }
  for (const [k, v] of Object.entries(parts.fields ?? {})) form.append(k, v);
  return form;
}

function ctxFor(
  route: OryCMSRoute,
  opts: {
    id?: string;
    body?: unknown;
    form?: FormData;
    query?: string;
    headers?: Record<string, string>;
  } = {},
) {
  const path = opts.id ? `/api/orycms/media/${opts.id}` : "/api/orycms/media";
  const url = `http://localhost${path}${opts.query ? `?${opts.query}` : ""}`;
  const init: RequestInit & { duplex?: string } = {
    method: route.method,
    headers: opts.headers ?? {},
  };
  if (opts.form) init.body = opts.form;
  else if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
    (init.headers as Record<string, string>)["content-type"] = "application/json";
  }
  const request = new Request(url, init);
  const params: Record<string, string> = opts.id ? { id: opts.id } : {};
  return { request, params, url: new URL(url) };
}

/** Calls a route the way the dispatcher does: a thrown error becomes a response. */
async function call(
  route: OryCMSRoute,
  opts: Parameters<typeof ctxFor>[1] = {},
): Promise<Response> {
  try {
    return await route.handler(ctxFor(route, opts));
  } catch (err) {
    return safeRouteError(route.pattern, err);
  }
}

/** Every write to the media table, as SQL text. */
function mediaWrites(): string[] {
  return fakeQuery.mock.calls
    .map((c) => String(c[0]))
    .filter((sql) => /^\s*(INSERT|UPDATE|DELETE)\b/.test(sql) && sql.includes("orycms_media"));
}

async function listFiles(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(tmpdir(), "orycms-media-test-"));
  cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  protectOryCMSAdminRoute.mockReset();
  requireOryCMSPermission.mockReset();
  fakeQuery.mockReset();
  protectOryCMSAdminRoute.mockResolvedValue(SESSION);
  requireOryCMSPermission.mockResolvedValue(undefined);
  fakeQuery.mockImplementation(async (sql: string, params?: unknown[]) =>
    defaultQuery(sql, params),
  );
});

afterEach(async () => {
  cwdSpy.mockRestore();
  consoleError.mockRestore();
  await rm(tmpRoot, { recursive: true, force: true });
});

describe("media routes (packages/core)", () => {
  describe("authentication and permission", () => {
    it("rejects an unauthenticated list request with 401", async () => {
      protectOryCMSAdminRoute.mockRejectedValue(
        new OryCMSAuthError("UNAUTHORIZED", "Authentication required.", 401),
      );

      const res = await call(listRoute);

      expect(res.status).toBe(401);
      expect(fakeQuery).not.toHaveBeenCalled();
    });

    it("rejects an upload without media:create with 403 and writes nothing", async () => {
      requireOryCMSPermission.mockRejectedValue(FORBIDDEN);

      const res = await call(uploadRoute, {
        form: multipart({ file: { name: "a.png", type: "image/png", bytes: PNG_BYTES } }),
      });

      expect(res.status).toBe(403);
      expect(requireOryCMSPermission).toHaveBeenCalledWith(SESSION, "media", "create");
      expect(await listFiles(path.join(tmpRoot, "public", "uploads"))).toEqual([]);
      expect(mediaWrites()).toHaveLength(0);
    });

    it.each([
      ["PATCH media/:id", patchRoute, { id: VALID_ID, body: { name: "x" } }, "update"],
      ["DELETE media/:id", deleteRoute, { id: VALID_ID }, "delete"],
    ])(
      "%s rejects a caller without media:%s with 403 and never writes",
      async (_label, route, opts, action) => {
        requireOryCMSPermission.mockRejectedValue(FORBIDDEN);

        const res = await call(route, opts);

        expect(res.status).toBe(403);
        expect(requireOryCMSPermission).toHaveBeenCalledWith(SESSION, "media", action);
        expect(mediaWrites()).toHaveLength(0);
      },
    );
  });

  describe("upload: success", () => {
    it("stores a valid PNG under a generated name and returns 201 with safe fields", async () => {
      const res = await call(uploadRoute, {
        form: multipart({ file: { name: "photo.png", type: "image/png", bytes: PNG_BYTES } }),
      });

      expect(res.status).toBe(201);
      const files = await listFiles(path.join(tmpRoot, "public", "uploads"));
      expect(files).toHaveLength(1);
      expect(files[0]).toMatch(/^[0-9a-f-]{36}\.png$/);
      const body = (await res.json()) as { data: Record<string, unknown> };
      expect(Object.keys(body.data)).not.toContain("file_path");
      expect(JSON.stringify(body)).not.toContain(tmpRoot);
    });
  });

  describe("upload: limits and types", () => {
    it("refuses a body whose declared length exceeds the limit with 413 before reading it", async () => {
      const res = await call(uploadRoute, {
        form: multipart({ file: { name: "a.png", type: "image/png", bytes: PNG_BYTES } }),
        headers: { "content-length": String(60 * 1024 * 1024) },
      });

      expect(res.status).toBe(413);
      expect(mediaWrites()).toHaveLength(0);
      expect(await listFiles(path.join(tmpRoot, "public", "uploads"))).toEqual([]);
    });

    it("rejects a disallowed MIME type with 415", async () => {
      const res = await call(uploadRoute, {
        form: multipart({
          file: { name: "run.exe", type: "application/x-msdownload", bytes: Buffer.from("MZ") },
        }),
      });

      expect(res.status).toBe(415);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
        "MEDIA_TYPE_NOT_ALLOWED",
      );
      expect(await listFiles(path.join(tmpRoot, "public", "uploads"))).toEqual([]);
    });

    it("rejects a PNG claim whose bytes are JPEG with 415 MEDIA_CONTENT_MISMATCH", async () => {
      const res = await call(uploadRoute, {
        form: multipart({ file: { name: "fake.png", type: "image/png", bytes: JPEG_BYTES } }),
      });

      expect(res.status).toBe(415);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
        "MEDIA_CONTENT_MISMATCH",
      );
      expect(await listFiles(path.join(tmpRoot, "public", "uploads"))).toEqual([]);
    });

    it("rejects an SVG that carries a script element", async () => {
      const svg = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      );
      const res = await call(uploadRoute, {
        form: multipart({ file: { name: "a.svg", type: "image/svg+xml", bytes: svg } }),
      });

      expect(res.status).toBe(415);
      expect(await listFiles(path.join(tmpRoot, "public", "uploads"))).toEqual([]);
    });

    it("rejects a text file that is not valid UTF-8 with 415", async () => {
      const res = await call(uploadRoute, {
        form: multipart({
          file: { name: "t.txt", type: "text/plain", bytes: Buffer.from([0xff, 0xfe, 0x00, 0x41]) },
        }),
      });

      expect(res.status).toBe(415);
    });

    it("rejects a request that carries more than one file with 422", async () => {
      const res = await call(uploadRoute, {
        form: multipart({
          file: { name: "a.png", type: "image/png", bytes: PNG_BYTES },
          extra: [{ name: "file", bytes: PDF_BYTES, filename: "b.pdf", type: "application/pdf" }],
        }),
      });

      expect(res.status).toBe(422);
      expect(await listFiles(path.join(tmpRoot, "public", "uploads"))).toEqual([]);
    });

    it("rejects a request with no file with 422", async () => {
      const res = await call(uploadRoute, { form: multipart({ fields: { folderId: "x" } }) });

      expect(res.status).toBe(422);
    });
  });

  describe("upload: hostile filenames", () => {
    it("never uses the client filename for the stored path", async () => {
      await call(uploadRoute, {
        form: multipart({ file: { name: "../../evil.png", type: "image/png", bytes: PNG_BYTES } }),
      });

      const files = await listFiles(path.join(tmpRoot, "public", "uploads"));
      expect(files).toHaveLength(1);
      expect(files[0]).not.toContain("evil");
      expect(await listFiles(path.join(tmpRoot, "public"))).toEqual(["uploads"]);
    });

    it("keeps only the base name of a path-like filename", async () => {
      const res = await call(uploadRoute, {
        form: multipart({ file: { name: "/etc/passwd.png", type: "image/png", bytes: PNG_BYTES } }),
      });

      const body = (await res.json()) as { data: { name: string } };
      expect(body.data.name).toBe("passwd.png");
    });

    it("strips null bytes and control characters from the display name", async () => {
      const res = await call(uploadRoute, {
        form: multipart({
          file: { name: "a\u0000b\u0007.png", type: "image/png", bytes: PNG_BYTES },
        }),
      });

      const body = (await res.json()) as { data: { name: string } };
      expect(body.data.name).toBe("ab.png");
    });

    it("limits a very long display name to 255 characters", async () => {
      const res = await call(uploadRoute, {
        form: multipart({
          file: { name: `${"n".repeat(1000)}.png`, type: "image/png", bytes: PNG_BYTES },
        }),
      });

      const body = (await res.json()) as { data: { name: string } };
      expect(body.data.name.length).toBeLessThanOrEqual(255);
    });
  });

  describe("upload: failures do not expose paths or driver text", () => {
    it("a failed write returns a generic 500 with no filesystem path", async () => {
      // A plain file where the upload directory should be makes the directory creation fail.
      await mkdir(path.join(tmpRoot, "public"), { recursive: true });
      await writeFile(path.join(tmpRoot, "public", "uploads"), "not a directory");

      const res = await call(uploadRoute, {
        form: multipart({ file: { name: "a.png", type: "image/png", bytes: PNG_BYTES } }),
      });
      const text = await res.text();

      expect(res.status).toBe(500);
      expect(text).not.toContain(tmpRoot);
      expect(text).not.toMatch(/ENOTDIR|ENOENT|EEXIST/);
    });

    it("a driver error on insert returns a generic 500 with no connection detail", async () => {
      fakeQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
        if (sql.includes("INSERT INTO orycms_media") && !sql.includes("folders")) {
          throw driverError(`connect failed for ${FAKE_URL}`, "08006");
        }
        return defaultQuery(sql, params);
      });

      const res = await call(uploadRoute, {
        form: multipart({ file: { name: "a.png", type: "image/png", bytes: PNG_BYTES } }),
      });
      const text = await res.text();

      expect(res.status).toBe(500);
      expect(text).not.toContain(FAKE_URL);
      expect(text).not.toContain(FAKE_PASSWORD);
    });
  });

  describe("list and get", () => {
    it("list returns 200 with safe fields only (no file path)", async () => {
      const res = await call(listRoute);

      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: Array<Record<string, unknown>> };
      for (const row of body.data) {
        expect(Object.keys(row)).not.toContain("file_path");
        expect(Object.keys(row)).not.toContain("filePath");
      }
      expect(await (await call(listRoute)).text()).not.toContain(tmpRoot);
    });

    it("get returns 200 with safe fields only", async () => {
      const res = await call(getRoute, { id: VALID_ID });

      expect(res.status).toBe(200);
      expect(JSON.stringify(await res.json())).not.toMatch(/file_path|filePath|\/etc\/|tmp/);
    });

    it("get rejects an id that is not a UUID with 422 and never queries", async () => {
      const res = await call(getRoute, { id: "../../etc/passwd" });

      expect(res.status).toBe(422);
      expect(fakeQuery).not.toHaveBeenCalled();
    });

    it("list rejects a non-numeric page with 422 and never queries", async () => {
      const res = await call(listRoute, { query: "page=abc" });

      expect(res.status).toBe(422);
      expect(fakeQuery).not.toHaveBeenCalled();
    });

    it("list rejects a page below 1 with 422", async () => {
      const res = await call(listRoute, { query: "page=0" });

      expect(res.status).toBe(422);
    });

    it("list rejects a limit outside 1 to 100 with 422", async () => {
      const res = await call(listRoute, { query: "limit=500" });

      expect(res.status).toBe(422);
    });
  });

  describe("update and delete", () => {
    it("patch updates the display name and returns 200", async () => {
      const res = await call(patchRoute, { id: VALID_ID, body: { name: "renamed.png" } });

      expect(res.status).toBe(200);
      expect(mediaWrites().some((s) => s.includes("UPDATE orycms_media"))).toBe(true);
    });

    it("patch rejects a non-string name with 422", async () => {
      const res = await call(patchRoute, { id: VALID_ID, body: { name: { x: 1 } } });

      expect(res.status).toBe(422);
      expect(mediaWrites()).toHaveLength(0);
    });

    it("patch rejects a name longer than 255 characters with 422", async () => {
      const res = await call(patchRoute, { id: VALID_ID, body: { name: "n".repeat(256) } });

      expect(res.status).toBe(422);
    });

    it("delete removes the row and the stored file, and returns 200", async () => {
      const dir = path.join(tmpRoot, "public", "uploads");
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, "stored.png"), PNG_BYTES);

      const res = await call(deleteRoute, { id: VALID_ID });

      expect(res.status).toBe(200);
      expect(await listFiles(dir)).toEqual([]);
    });

    it("delete with an id that is not a UUID returns 422 and removes nothing", async () => {
      const outside = path.join(tmpRoot, "keep.txt");
      await writeFile(outside, "keep");

      const res = await call(deleteRoute, { id: "../keep.txt" });

      expect(res.status).toBe(422);
      expect((await stat(outside)).isFile()).toBe(true);
    });

    it("delete never removes a file outside the upload directory, even if the stored path points there", async () => {
      const outside = path.join(tmpRoot, "outside.txt");
      await writeFile(outside, "keep");
      fakeQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
        if (sql.includes("SELECT file_path FROM orycms_media"))
          return { rows: [{ file_path: outside }] };
        return defaultQuery(sql, params);
      });

      await call(deleteRoute, { id: VALID_ID });

      expect((await stat(outside)).isFile()).toBe(true);
    });

    it("when the row delete fails, the file is kept so the row and file stay consistent", async () => {
      const dir = path.join(tmpRoot, "public", "uploads");
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, "stored.png"), PNG_BYTES);
      fakeQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
        if (sql.includes("DELETE FROM orycms_media"))
          throw driverError(`lost connection ${FAKE_URL}`, "08006");
        return defaultQuery(sql, params);
      });

      const res = await call(deleteRoute, { id: VALID_ID });
      const text = await res.text();

      expect(res.status).toBe(500);
      expect(text).not.toContain(FAKE_URL);
      expect(await listFiles(dir)).toEqual(["stored.png"]);
    });

    it("delete of an unknown id returns 404", async () => {
      const res = await call(deleteRoute, { id: "22222222-2222-4222-8222-222222222222" });

      expect(res.status).toBe(404);
    });

    it("engine delete rejects a stored path outside the upload root without touching it", async () => {
      const outside = path.join(tmpRoot, "other.txt");
      await writeFile(outside, "keep");
      fakeQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
        if (sql.includes("SELECT file_path FROM orycms_media"))
          return { rows: [{ file_path: outside }] };
        return defaultQuery(sql, params);
      });

      await deleteOryCMSMedia(VALID_ID, fakePool as never);

      expect((await stat(outside)).isFile()).toBe(true);
    });
  });
});
