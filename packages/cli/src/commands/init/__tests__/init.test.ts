/**
 * Integration tests for the init orchestrator and command registration.
 * Uses a real temp directory simulating a fresh Next.js project.
 */
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runInit } from "../init";
import { registerInitCommand } from "../index";
import type { InitAnswers, InitContext } from "../types";
import { fileExists, readTextFile, readJsonFile } from "../../../shared/fs";
import { Command } from "commander";

// ── Fixture helpers ───────────────────────────────────────────────────────────

let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "orycms-init-integration-"));
  // Scaffold a minimal Next.js project
  writeFileSync(
    join(cwd, "package.json"),
    JSON.stringify({ dependencies: { next: "^14.0.0", react: "^18.0.0" } }),
  );
  mkdirSync(join(cwd, "app"), { recursive: true });
  writeFileSync(
    join(cwd, "next.config.ts"),
    `import type { NextConfig } from "next";\nconst nextConfig: NextConfig = {};\nexport default nextConfig;\n`,
  );
  writeFileSync(
    join(cwd, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } } }),
  );
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

function makeAnswers(overrides: Partial<InitAnswers> = {}): InitAnswers {
  return {
    database: "postgresql",
    auth: "better-auth",
    plugins: [],
    ...overrides,
  };
}

// ── runInit ───────────────────────────────────────────────────────────────────

describe("runInit", () => {
  it("creates orycms.config.ts", () => {
    runInit({ cwd, packageManager: "npm", answers: makeAnswers() });
    expect(fileExists(join(cwd, "orycms.config.ts"))).toBe(true);
  });

  it("creates .env.example", () => {
    runInit({ cwd, packageManager: "npm", answers: makeAnswers() });
    expect(fileExists(join(cwd, ".env.example"))).toBe(true);
  });

  it("creates app/admin/page.tsx as a shim into orycms/", () => {
    runInit({ cwd, packageManager: "npm", answers: makeAnswers() });
    expect(fileExists(join(cwd, "app/admin/page.tsx"))).toBe(true);
    // CMS body lives under orycms/, app file is a thin re-export
    expect(fileExists(join(cwd, "orycms/admin/admin-page.tsx"))).toBe(true);
    expect(readTextFile(join(cwd, "app/admin/page.tsx"))).toContain(
      'from "../../orycms/admin/admin-page"',
    );
  });

  it("keeps CMS route bodies inside orycms/ for all generated routes", () => {
    runInit({ cwd, packageManager: "npm", answers: makeAnswers() });
    expect(fileExists(join(cwd, "orycms/admin/collections-page.tsx"))).toBe(true);
    expect(fileExists(join(cwd, "orycms/admin/plugins-page.tsx"))).toBe(true);
  });

  it("creates app/collections/page.tsx and app/plugins/page.tsx shims", () => {
    runInit({ cwd, packageManager: "npm", answers: makeAnswers() });
    expect(fileExists(join(cwd, "app/collections/page.tsx"))).toBe(true);
    expect(fileExists(join(cwd, "app/plugins/page.tsx"))).toBe(true);
  });

  it("updates next.config.ts with OryCMS marker", () => {
    runInit({ cwd, packageManager: "npm", answers: makeAnswers() });
    expect(readTextFile(join(cwd, "next.config.ts"))).toContain("// orycms");
  });

  it("skips tsconfig — no path aliases needed when packages install from npm", () => {
    const { files } = runInit({ cwd, packageManager: "npm", answers: makeAnswers() });
    const tsResult = files.find((f) => f.path === "tsconfig.json");
    expect(tsResult?.status).toBe("skipped");
  });

  it("returns an installCmd containing both core and next", () => {
    const { installCmd } = runInit({ cwd, packageManager: "npm", answers: makeAnswers() });
    expect(installCmd).toContain("npm install");
    expect(installCmd).toContain("@ory-cms/core");
    expect(installCmd).toContain("@ory-cms/next");
  });

  it("uses the detected package manager in installCmd", () => {
    const { installCmd } = runInit({ cwd, packageManager: "pnpm", answers: makeAnswers() });
    expect(installCmd).toMatch(/^pnpm add /);
  });

  it("returns null installCmd when all deps already present", () => {
    // Pre-populate all deps
    const deps: Record<string, string> = {
      "@ory-cms/core": "^1",
      "@ory-cms/next": "^1",
      pg: "^8",
      "@types/pg": "^8",
      "better-auth": "^1",
    };
    writeFileSync(join(cwd, "package.json"), JSON.stringify({ dependencies: deps }));
    const { installCmd } = runInit({ cwd, packageManager: "npm", answers: makeAnswers() });
    expect(installCmd).toBeNull();
  });

  it("is fully idempotent — second run returns all-skipped results", () => {
    runInit({ cwd, packageManager: "npm", answers: makeAnswers() });
    // For idempotency the package.json needs the deps to be present
    const pkg = readJsonFile<{ dependencies: Record<string, string> }>(join(cwd, "package.json"));
    writeFileSync(join(cwd, "package.json"), JSON.stringify({ dependencies: pkg.dependencies }));

    const { files } = runInit({ cwd, packageManager: "npm", answers: makeAnswers() });
    const nonSkipped = files.filter((f) => f.status !== "skipped");
    expect(nonSkipped).toHaveLength(0);
  });

  it("orycms.config.ts includes selected database", () => {
    runInit({ cwd, packageManager: "npm", answers: makeAnswers({ database: "neon" }) });
    expect(readTextFile(join(cwd, "orycms.config.ts"))).toContain("neon");
  });

  it("orycms.config.ts includes selected auth provider", () => {
    runInit({ cwd, packageManager: "npm", answers: makeAnswers({ auth: "clerk" }) });
    expect(readTextFile(join(cwd, "orycms.config.ts"))).toContain("clerk");
  });

  it("orycms.config.ts includes selected plugins", () => {
    runInit({
      cwd,
      packageManager: "npm",
      answers: makeAnswers({ plugins: ["@ory-cms/plugin-seo", "@ory-cms/plugin-media"] }),
    });
    const cfg = readTextFile(join(cwd, "orycms.config.ts"));
    expect(cfg).toContain("@ory-cms/plugin-seo");
    expect(cfg).toContain("@ory-cms/plugin-media");
  });

  it("all files generated have valid relative paths (no absolute)", () => {
    const { files } = runInit({ cwd, packageManager: "npm", answers: makeAnswers() });
    for (const f of files) {
      expect(f.path.startsWith("/")).toBe(false);
    }
  });
});

// ── registerInitCommand ───────────────────────────────────────────────────────

describe("registerInitCommand", () => {
  it("registers 'init' as a command on the program", () => {
    const program = new Command();
    registerInitCommand(program);
    const names = program.commands.map((c) => c.name());
    expect(names).toContain("init");
  });

  it("accepts a custom askFn and runs without TTY", async () => {
    const askFn = vi.fn().mockResolvedValue(makeAnswers());

    const program = new Command();
    program.exitOverride(); // prevent process.exit during test
    registerInitCommand(program, askFn);

    await program.parseAsync(["node", "orycms", "init", "--cwd", cwd]);

    expect(askFn).toHaveBeenCalledOnce();
  });

  it("outputs success message after init", async () => {
    const stdoutLines: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdoutLines.push(String(chunk));
      return true;
    });

    const askFn = vi.fn().mockResolvedValue(makeAnswers());
    const program = new Command();
    program.exitOverride();
    registerInitCommand(program, askFn);

    await program.parseAsync(["node", "orycms", "init", "--cwd", cwd]);

    vi.restoreAllMocks();

    const output = stdoutLines.join("");
    expect(output).toContain("OryCMS initialised");
  });
});
