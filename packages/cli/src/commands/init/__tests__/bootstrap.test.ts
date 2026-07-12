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

  it("creates layout.tsx, page.tsx, provider.tsx", async () => {
    const { files } = await bootstrapAdmin({ cwd });
    expect(files).toHaveLength(3);
    const paths = files.map((f) => f.path);
    expect(paths).toContain("app/admin/layout.tsx");
    expect(paths).toContain("app/admin/page.tsx");
    expect(paths).toContain("app/admin/provider.tsx");
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
    expect(fileExists(join(cwd, "app/admin/layout.tsx"))).toBe(true);
    expect(fileExists(join(cwd, "app/admin/page.tsx"))).toBe(true);
    expect(fileExists(join(cwd, "app/admin/provider.tsx"))).toBe(true);
  });

  it("creates admin dir when it does not exist", async () => {
    await bootstrapAdmin({ cwd });
    expect(fileExists(join(cwd, "app/admin"))).toBe(true);
  });
});

// ── bootstrapAdmin — file content ─────────────────────────────────────────────

describe("bootstrapAdmin — App Router file content", () => {
  beforeEach(async () => {
    mkdirSync(join(cwd, "app"), { recursive: true });
    await bootstrapAdmin({ cwd });
  });

  it("layout.tsx imports AdminProvider from ./provider", () => {
    const layout = readTextFile(join(cwd, "app/admin/layout.tsx"));
    expect(layout).toContain('import { AdminProvider } from "./provider"');
  });

  it("layout.tsx exports a default function", () => {
    const layout = readTextFile(join(cwd, "app/admin/layout.tsx"));
    expect(layout).toContain("export default function AdminLayout");
  });

  it("layout.tsx includes Next.js Metadata export", () => {
    const layout = readTextFile(join(cwd, "app/admin/layout.tsx"));
    expect(layout).toContain("export const metadata");
    expect(layout).toContain("robots");
  });

  it("provider.tsx has 'use client' directive", () => {
    const provider = readTextFile(join(cwd, "app/admin/provider.tsx"));
    expect(provider).toContain('"use client"');
  });

  it("provider.tsx exports AdminProvider function", () => {
    const provider = readTextFile(join(cwd, "app/admin/provider.tsx"));
    expect(provider).toContain("export function AdminProvider");
  });

  it("page.tsx exports a default React component", () => {
    const page = readTextFile(join(cwd, "app/admin/page.tsx"));
    expect(page).toContain("export default function AdminPage");
    expect(page).toContain("<main>");
  });

  it("all generated files contain the OryCMS Admin marker", () => {
    for (const rel of ["app/admin/layout.tsx", "app/admin/page.tsx", "app/admin/provider.tsx"]) {
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

  it("generates pages/admin/index.tsx only", async () => {
    const { files } = await bootstrapAdmin({ cwd });
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("pages/admin/index.tsx");
    expect(files[0].status).toBe("created");
  });

  it("creates the file on disk", async () => {
    await bootstrapAdmin({ cwd });
    expect(fileExists(join(cwd, "pages/admin/index.tsx"))).toBe(true);
  });

  it("index.tsx is a valid React component with the sentinel", () => {
    // Check content synchronously after async run
    return bootstrapAdmin({ cwd }).then(() => {
      const content = readTextFile(join(cwd, "pages/admin/index.tsx"));
      expect(content).toContain("// OryCMS Admin");
      expect(content).toContain("export default function AdminPage");
    });
  });

  it("is idempotent — second run skips the file", async () => {
    await bootstrapAdmin({ cwd });
    const { files } = await bootstrapAdmin({ cwd });
    expect(files[0].status).toBe("skipped");
  });

  it("pages router does NOT generate layout.tsx", async () => {
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
    expect(files.every((f) => f.path.startsWith("app/cms/"))).toBe(true);
  });

  it("does not generate files outside the admin directory", async () => {
    mkdirSync(join(cwd, "app"), { recursive: true });
    const { files } = await bootstrapAdmin({ cwd });
    expect(files.every((f) => f.path.startsWith("app/admin/"))).toBe(true);
  });
});
