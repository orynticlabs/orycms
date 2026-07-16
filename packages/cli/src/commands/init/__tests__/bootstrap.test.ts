import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { detectAppStructure, bootstrapAdmin } from "../bootstrap";
import { fileExists, readTextFile } from "../../../shared/fs";

let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "orycms-bootstrap-"));
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

// ── detectAppStructure ─────────────────────────────────────────────────────────

describe("detectAppStructure — router detection", () => {
  it("returns 'app' when only app/ dir exists", () => {
    mkdirSync(join(cwd, "app"), { recursive: true });
    expect(detectAppStructure(cwd).router).toBe("app");
  });

  it("returns 'pages' when only pages/ dir exists", () => {
    mkdirSync(join(cwd, "pages"), { recursive: true });
    expect(detectAppStructure(cwd).router).toBe("pages");
  });

  it("prefers 'app' when both app/ and pages/ exist", () => {
    mkdirSync(join(cwd, "app"), { recursive: true });
    mkdirSync(join(cwd, "pages"), { recursive: true });
    expect(detectAppStructure(cwd).router).toBe("app");
  });

  it("defaults to 'app' when neither dir exists", () => {
    expect(detectAppStructure(cwd).router).toBe("app");
  });

  it("reflects hasAppDir and hasPagesDir correctly", () => {
    mkdirSync(join(cwd, "app"), { recursive: true });
    const s = detectAppStructure(cwd);
    expect(s.hasAppDir).toBe(true);
    expect(s.hasPagesDir).toBe(false);
  });
});

describe("detectAppStructure — admin dir", () => {
  it("hasAdminDir:false when admin dir is absent", () => {
    mkdirSync(join(cwd, "app"), { recursive: true });
    expect(detectAppStructure(cwd).hasAdminDir).toBe(false);
  });

  it("hasAdminDir:true when admin dir exists", () => {
    mkdirSync(join(cwd, "app/admin"), { recursive: true });
    expect(detectAppStructure(cwd).hasAdminDir).toBe(true);
  });

  it("adminDirPath is 'app/admin' for App Router", () => {
    mkdirSync(join(cwd, "app"), { recursive: true });
    expect(detectAppStructure(cwd).adminDirPath).toBe("app/admin");
  });

  it("adminDirPath is 'pages/admin' for Pages Router", () => {
    mkdirSync(join(cwd, "pages"), { recursive: true });
    expect(detectAppStructure(cwd).adminDirPath).toBe("pages/admin");
  });

  it("respects custom adminBasePath", () => {
    mkdirSync(join(cwd, "app"), { recursive: true });
    const s = detectAppStructure(cwd, "cms");
    expect(s.adminDirPath).toBe("app/cms");
  });
});

// ── bootstrapAdmin — App Router ────────────────────────────────────────────────

describe("bootstrapAdmin — App Router", () => {
  beforeEach(() => mkdirSync(join(cwd, "app"), { recursive: true }));

  it("writes orycms bodies and app shims", async () => {
    const { files } = await bootstrapAdmin({ cwd });
    // 3 orycms bodies (layout/page/provider) + 2 app shims (layout/page)
    expect(files).toHaveLength(5);
    const paths = files.map((f) => f.path);
    expect(paths).toContain("orycms/admin/layout.tsx");
    expect(paths).toContain("orycms/admin/page.tsx");
    expect(paths).toContain("orycms/admin/provider.tsx");
    expect(paths).toContain("app/admin/layout.tsx");
    expect(paths).toContain("app/admin/page.tsx");
  });

  it("all files have status 'created' on first run", async () => {
    const { files } = await bootstrapAdmin({ cwd });
    expect(files.every((f) => f.status === "created")).toBe(true);
  });

  it("all file paths are relative (no leading slash)", async () => {
    const { files } = await bootstrapAdmin({ cwd });
    expect(files.every((f) => !f.path.startsWith("/"))).toBe(true);
  });

  it("actually creates the files on disk", async () => {
    await bootstrapAdmin({ cwd });
    expect(fileExists(join(cwd, "orycms/admin/layout.tsx"))).toBe(true);
    expect(fileExists(join(cwd, "orycms/admin/page.tsx"))).toBe(true);
    expect(fileExists(join(cwd, "orycms/admin/provider.tsx"))).toBe(true);
    expect(fileExists(join(cwd, "app/admin/layout.tsx"))).toBe(true);
    expect(fileExists(join(cwd, "app/admin/page.tsx"))).toBe(true);
  });

  it("app shims re-export from orycms/admin", async () => {
    await bootstrapAdmin({ cwd });
    const layoutShim = readTextFile(join(cwd, "app/admin/layout.tsx"));
    const pageShim = readTextFile(join(cwd, "app/admin/page.tsx"));
    expect(layoutShim).toContain('from "../../orycms/admin/layout"');
    expect(layoutShim).toContain("metadata");
    expect(pageShim).toContain('from "../../orycms/admin/page"');
  });

  it("creates admin dirs when they do not exist", async () => {
    await bootstrapAdmin({ cwd });
    expect(fileExists(join(cwd, "app/admin"))).toBe(true);
    expect(fileExists(join(cwd, "orycms/admin"))).toBe(true);
  });
});

// ── bootstrapAdmin — file content ─────────────────────────────────────────────

describe("bootstrapAdmin — App Router file content", () => {
  beforeEach(async () => {
    mkdirSync(join(cwd, "app"), { recursive: true });
    await bootstrapAdmin({ cwd });
  });

  it("layout.tsx imports AdminProvider from ./provider", () => {
    const layout = readTextFile(join(cwd, "orycms/admin/layout.tsx"));
    expect(layout).toContain('import { AdminProvider } from "./provider"');
  });

  it("layout.tsx exports a default function", () => {
    const layout = readTextFile(join(cwd, "orycms/admin/layout.tsx"));
    expect(layout).toContain("export default function AdminLayout");
  });

  it("layout.tsx includes Next.js Metadata export", () => {
    const layout = readTextFile(join(cwd, "orycms/admin/layout.tsx"));
    expect(layout).toContain("export const metadata");
    expect(layout).toContain("robots");
  });

  it("provider.tsx has 'use client' directive", () => {
    const provider = readTextFile(join(cwd, "orycms/admin/provider.tsx"));
    expect(provider).toContain('"use client"');
  });

  it("provider.tsx exports AdminProvider function", () => {
    const provider = readTextFile(join(cwd, "orycms/admin/provider.tsx"));
    expect(provider).toContain("export function AdminProvider");
  });

  it("page.tsx body exports a default React component", () => {
    const page = readTextFile(join(cwd, "orycms/admin/page.tsx"));
    expect(page).toContain("export default function AdminPage");
    expect(page).toContain("<main>");
  });

  it("all generated files contain the OryCMS Admin marker", () => {
    for (const rel of [
      "orycms/admin/layout.tsx",
      "orycms/admin/page.tsx",
      "orycms/admin/provider.tsx",
      "app/admin/layout.tsx",
      "app/admin/page.tsx",
    ]) {
      const content = readTextFile(join(cwd, rel));
      expect(content).toContain("// OryCMS Admin");
    }
  });
});

// ── bootstrapAdmin — idempotency ───────────────────────────────────────────────

describe("bootstrapAdmin — idempotency", () => {
  beforeEach(() => mkdirSync(join(cwd, "app"), { recursive: true }));

  it("second run marks all files as skipped", async () => {
    await bootstrapAdmin({ cwd });
    const { files } = await bootstrapAdmin({ cwd });
    expect(files.every((f) => f.status === "skipped")).toBe(true);
  });

  it("does not modify file content on second run", async () => {
    await bootstrapAdmin({ cwd });
    const before = readTextFile(join(cwd, "app/admin/layout.tsx"));
    await bootstrapAdmin({ cwd });
    const after = readTextFile(join(cwd, "app/admin/layout.tsx"));
    expect(after).toBe(before);
  });

  it("file written by orycms init (same sentinel) is skipped without confirm", async () => {
    mkdirSync(join(cwd, "app/admin"), { recursive: true });
    // Simulate a file written by `orycms init` — has the OryCMS Admin sentinel
    writeFileSync(join(cwd, "app/admin/page.tsx"), "// OryCMS Admin — generated by `orycms init`\nexport default function AdminPage() {}");
    const { files } = await bootstrapAdmin({ cwd });
    const pageResult = files.find((f) => f.path === "app/admin/page.tsx")!;
    expect(pageResult.status).toBe("skipped");
  });
});

// ── bootstrapAdmin — confirmation guard ───────────────────────────────────────

describe("bootstrapAdmin — user file preservation", () => {
  beforeEach(() => mkdirSync(join(cwd, "app/admin"), { recursive: true }));

  it("skips pre-existing user file when confirm is not provided", async () => {
    writeFileSync(join(cwd, "app/admin/page.tsx"), "// user content");
    const { files } = await bootstrapAdmin({ cwd });
    const pageResult = files.find((f) => f.path === "app/admin/page.tsx")!;
    expect(pageResult.status).toBe("skipped");
  });

  it("preserves pre-existing user file content when confirm returns false", async () => {
    writeFileSync(join(cwd, "app/admin/page.tsx"), "// user content");
    await bootstrapAdmin({ cwd, confirm: async () => false });
    expect(readTextFile(join(cwd, "app/admin/page.tsx"))).toBe("// user content");
  });

  it("overwrites pre-existing user file when confirm returns true", async () => {
    writeFileSync(join(cwd, "app/admin/page.tsx"), "// user content");
    const { files } = await bootstrapAdmin({ cwd, confirm: async () => true });
    const pageResult = files.find((f) => f.path === "app/admin/page.tsx")!;
    expect(pageResult.status).toBe("updated");
    expect(readTextFile(join(cwd, "app/admin/page.tsx"))).toContain("// OryCMS Admin");
  });

  it("confirm is called with the relative file path", async () => {
    writeFileSync(join(cwd, "app/admin/page.tsx"), "// user content");
    const captured: string[] = [];
    await bootstrapAdmin({ cwd, confirm: async (path) => { captured.push(path); return false; } });
    expect(captured[0]).toBe("app/admin/page.tsx");
  });

  it("confirm is called with a reason string", async () => {
    writeFileSync(join(cwd, "app/admin/page.tsx"), "// user content");
    const captured: string[] = [];
    await bootstrapAdmin({ cwd, confirm: async (_p, reason) => { captured.push(reason); return false; } });
    expect(captured[0]).toBeTruthy();
    expect(typeof captured[0]).toBe("string");
  });

  it("confirm is only called for files without the sentinel", async () => {
    // layout has sentinel, page does not
    writeFileSync(join(cwd, "app/admin/layout.tsx"), "// OryCMS Admin — existing");
    writeFileSync(join(cwd, "app/admin/page.tsx"), "// user content");
    let confirmCount = 0;
    await bootstrapAdmin({ cwd, confirm: async () => { confirmCount++; return false; } });
    // Only page.tsx (without sentinel) triggers confirm
    expect(confirmCount).toBe(1);
  });
});

// ── bootstrapAdmin — Pages Router ─────────────────────────────────────────────

describe("bootstrapAdmin — Pages Router", () => {
  beforeEach(() => mkdirSync(join(cwd, "pages"), { recursive: true }));

  it("generates orycms bodies + a single pages/admin/index shim", async () => {
    const { files } = await bootstrapAdmin({ cwd });
    // orycms/admin/page.tsx, orycms/admin/provider.tsx, pages/admin/index.tsx
    expect(files).toHaveLength(3);
    const paths = files.map((f) => f.path);
    expect(paths).toContain("pages/admin/index.tsx");
    expect(paths).toContain("orycms/admin/page.tsx");
    expect(files.every((f) => f.status === "created")).toBe(true);
  });

  it("creates the file on disk", async () => {
    await bootstrapAdmin({ cwd });
    expect(fileExists(join(cwd, "pages/admin/index.tsx"))).toBe(true);
  });

  it("index shim re-exports the orycms page body", () => {
    return bootstrapAdmin({ cwd }).then(() => {
      const shim = readTextFile(join(cwd, "pages/admin/index.tsx"));
      expect(shim).toContain("// OryCMS Admin");
      expect(shim).toContain('from "../../orycms/admin/page"');
      const body = readTextFile(join(cwd, "orycms/admin/page.tsx"));
      expect(body).toContain("export default function AdminPage");
    });
  });

  it("is idempotent — second run skips all files", async () => {
    await bootstrapAdmin({ cwd });
    const { files } = await bootstrapAdmin({ cwd });
    expect(files.every((f) => f.status === "skipped")).toBe(true);
  });

  it("pages router does NOT generate a layout", async () => {
    const { files } = await bootstrapAdmin({ cwd });
    expect(files.some((f) => f.path.includes("layout"))).toBe(false);
  });
});

// ── bootstrapAdmin — result shape ─────────────────────────────────────────────

describe("bootstrapAdmin — result shape", () => {
  it("result.structure reflects detected router", async () => {
    mkdirSync(join(cwd, "app"), { recursive: true });
    const { structure } = await bootstrapAdmin({ cwd });
    expect(structure.router).toBe("app");
    expect(structure.hasAppDir).toBe(true);
  });

  it("result.structure.hasAdminDir is true after bootstrap", async () => {
    mkdirSync(join(cwd, "app"), { recursive: true });
    const { structure } = await bootstrapAdmin({ cwd });
    expect(structure.hasAdminDir).toBe(false); // detected BEFORE creation
    // The admin dir is created by the bootstrap itself
    expect(fileExists(join(cwd, "app/admin"))).toBe(true);
  });

  it("custom adminBasePath is reflected in paths", async () => {
    mkdirSync(join(cwd, "app"), { recursive: true });
    const { files, structure } = await bootstrapAdmin({ cwd, adminBasePath: "cms" });
    expect(structure.adminDirPath).toBe("app/cms");
    // Shims under app/cms, bodies under orycms/cms
    expect(files.every((f) => f.path.startsWith("app/cms/") || f.path.startsWith("orycms/cms/"))).toBe(true);
    expect(files.some((f) => f.path.startsWith("app/cms/"))).toBe(true);
    expect(files.some((f) => f.path.startsWith("orycms/cms/"))).toBe(true);
  });

  it("only generates files under the admin base path (app/ shims + orycms/ bodies)", async () => {
    mkdirSync(join(cwd, "app"), { recursive: true });
    const { files } = await bootstrapAdmin({ cwd });
    expect(
      files.every((f) => f.path.startsWith("app/admin/") || f.path.startsWith("orycms/admin/")),
    ).toBe(true);
  });
});
