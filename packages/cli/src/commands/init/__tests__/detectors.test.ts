import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { detectNextJs, findNextConfigPath } from "../detectors/nextjs";
import { detectPackageManager, installCommand } from "../detectors/package-manager";

// ── Fixture helpers ───────────────────────────────────────────────────────────

let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "orycms-init-detect-"));
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

function writePackageJson(deps: Record<string, string>, dev = false): void {
  const key = dev ? "devDependencies" : "dependencies";
  writeFileSync(join(cwd, "package.json"), JSON.stringify({ [key]: deps }));
}

// ── detectNextJs ──────────────────────────────────────────────────────────────

describe("detectNextJs", () => {
  it("returns detected=false when no package.json", () => {
    expect(detectNextJs(cwd)).toMatchObject({ detected: false });
  });

  it("returns detected=false when next is not in deps", () => {
    writePackageJson({ react: "^18" });
    expect(detectNextJs(cwd)).toMatchObject({ detected: false });
  });

  it("detects next in dependencies", () => {
    writePackageJson({ next: "^14.0.0" });
    const info = detectNextJs(cwd);
    expect(info.detected).toBe(true);
    expect(info.nextVersion).toBe("^14.0.0");
  });

  it("detects next in devDependencies", () => {
    writePackageJson({ next: "15.0.0" }, true);
    expect(detectNextJs(cwd).detected).toBe(true);
  });

  it("hasAppRouter=false when app/ dir is absent", () => {
    writePackageJson({ next: "14.0.0" });
    expect(detectNextJs(cwd).hasAppRouter).toBe(false);
  });

  it("hasAppRouter=true when app/ dir exists", () => {
    writePackageJson({ next: "14.0.0" });
    mkdirSync(join(cwd, "app"));
    expect(detectNextJs(cwd).hasAppRouter).toBe(true);
  });

  it("returns detected=false when package.json is malformed", () => {
    writeFileSync(join(cwd, "package.json"), "{ bad json }");
    expect(detectNextJs(cwd).detected).toBe(false);
  });
});

// ── findNextConfigPath ────────────────────────────────────────────────────────

describe("findNextConfigPath", () => {
  it("returns undefined when no config file exists", () => {
    expect(findNextConfigPath(cwd)).toBeUndefined();
  });

  it("finds next.config.ts", () => {
    writeFileSync(join(cwd, "next.config.ts"), "");
    expect(findNextConfigPath(cwd)).toContain("next.config.ts");
  });

  it("finds next.config.js when .ts is absent", () => {
    writeFileSync(join(cwd, "next.config.js"), "");
    expect(findNextConfigPath(cwd)).toContain("next.config.js");
  });

  it("prefers next.config.ts over next.config.js", () => {
    writeFileSync(join(cwd, "next.config.ts"), "");
    writeFileSync(join(cwd, "next.config.js"), "");
    expect(findNextConfigPath(cwd)).toContain("next.config.ts");
  });
});

// ── detectPackageManager ──────────────────────────────────────────────────────

describe("detectPackageManager", () => {
  it("defaults to npm when no lock file exists", () => {
    expect(detectPackageManager(cwd)).toBe("npm");
  });

  it("detects pnpm via pnpm-lock.yaml", () => {
    writeFileSync(join(cwd, "pnpm-lock.yaml"), "");
    expect(detectPackageManager(cwd)).toBe("pnpm");
  });

  it("detects yarn via yarn.lock", () => {
    writeFileSync(join(cwd, "yarn.lock"), "");
    expect(detectPackageManager(cwd)).toBe("yarn");
  });

  it("detects bun via bun.lockb", () => {
    writeFileSync(join(cwd, "bun.lockb"), "");
    expect(detectPackageManager(cwd)).toBe("bun");
  });

  it("bun takes priority over pnpm", () => {
    writeFileSync(join(cwd, "bun.lockb"), "");
    writeFileSync(join(cwd, "pnpm-lock.yaml"), "");
    expect(detectPackageManager(cwd)).toBe("bun");
  });
});

// ── installCommand ────────────────────────────────────────────────────────────

describe("installCommand", () => {
  it("returns empty string for empty package list", () => {
    expect(installCommand("npm", [])).toBe("");
  });

  it("npm install command", () => {
    expect(installCommand("npm", ["a", "b"])).toBe("npm install a b");
  });

  it("pnpm add command", () => {
    expect(installCommand("pnpm", ["a"])).toBe("pnpm add a");
  });

  it("yarn add command", () => {
    expect(installCommand("yarn", ["a"])).toBe("yarn add a");
  });

  it("bun add command", () => {
    expect(installCommand("bun", ["a"])).toBe("bun add a");
  });
});
