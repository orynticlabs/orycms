/**
 * Tests for the create-orycms runner and CLI registration.
 *
 * All tests use real temp directories (same pattern as packages/cli tests).
 * Database operations are skipped via skipDbOps:true so no DB drivers are needed.
 */
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

import { runCreate, createSummaryLines, defaultAnswers } from "../runner";
import { registerCreateCommand } from "../index";
import type { CreateAnswers } from "../runner";
import type { SqliteWizardResult } from "../../../cli/src/commands/init/database/wizard";
import { fileExists } from "../../../cli/src/shared/fs";

// ── Fixtures ───────────────────────────────────────────────────────────────────

let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "orycms-create-"));
  // Minimal Next.js scaffold so runInit doesn't fail on missing package.json
  writeFileSync(
    join(cwd, "package.json"),
    JSON.stringify({ dependencies: { next: "^14.0.0", react: "^18.0.0" } }),
  );
  mkdirSync(join(cwd, "app"), { recursive: true });
  writeFileSync(
    join(cwd, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } } }),
  );
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

const SQLITE_DB: SqliteWizardResult = { provider: "sqlite", filePath: ":memory:" };

function makeAnswers(overrides: Partial<CreateAnswers> = {}): CreateAnswers {
  return {
    projectName: "my-app",
    packageManager: "npm",
    router: "app",
    dbConfig: SQLITE_DB,
    storageProvider: "local",
    authProvider: "none",
    installAdmin: true,
    seedDb: false,
    createOwner: false,
    ownerEmail: "admin@localhost",
    ownerPassword: "",
    plugins: [],
    ...overrides,
  };
}

// ── runCreate — file generation ────────────────────────────────────────────────

describe("runCreate — core file generation", () => {
  it("creates orycms.config.ts", async () => {
    await runCreate({ cwd, answers: makeAnswers(), skipDbOps: true });
    expect(fileExists(join(cwd, "orycms.config.ts"))).toBe(true);
  });

  it("creates .env.example", async () => {
    await runCreate({ cwd, answers: makeAnswers(), skipDbOps: true });
    expect(fileExists(join(cwd, ".env.example"))).toBe(true);
  });

  it("returns file results with relative paths (no leading slash)", async () => {
    const result = await runCreate({ cwd, answers: makeAnswers(), skipDbOps: true });
    for (const f of result.files) {
      expect(f.path.startsWith("/")).toBe(false);
    }
  });

  it("includes an installCmd for missing dependencies", async () => {
    const result = await runCreate({ cwd, answers: makeAnswers(), skipDbOps: true });
    expect(result.installCmd).toContain("@orycms/core");
  });

  it("uses the selected package manager in the installCmd", async () => {
    const result = await runCreate({
      cwd,
      answers: makeAnswers({ packageManager: "pnpm" }),
      skipDbOps: true,
    });
    expect(result.installCmd).toMatch(/^pnpm add /);
  });

  it("returns null installCmd when all deps are already present", async () => {
    writeFileSync(
      join(cwd, "package.json"),
      JSON.stringify({
        dependencies: {
          next: "^14.0.0",
          react: "^18.0.0",
          "@orycms/core": "^1",
          "better-sqlite3": "^9",
          "@types/better-sqlite3": "^9",
        },
      }),
    );
    const result = await runCreate({
      cwd,
      answers: makeAnswers({ authProvider: "none", plugins: [] }),
      skipDbOps: true,
    });
    expect(result.installCmd).toBeNull();
  });
});

// ── runCreate — admin bootstrap ────────────────────────────────────────────────

describe("runCreate — admin bootstrap", () => {
  it("creates app/admin/layout.tsx when installAdmin:true", async () => {
    await runCreate({ cwd, answers: makeAnswers({ installAdmin: true }), skipDbOps: true });
    expect(fileExists(join(cwd, "app/admin/layout.tsx"))).toBe(true);
  });

  it("creates app/admin/provider.tsx when installAdmin:true", async () => {
    await runCreate({ cwd, answers: makeAnswers({ installAdmin: true }), skipDbOps: true });
    expect(fileExists(join(cwd, "app/admin/provider.tsx"))).toBe(true);
  });

  it("does NOT create admin files when installAdmin:false", async () => {
    await runCreate({ cwd, answers: makeAnswers({ installAdmin: false }), skipDbOps: true });
    expect(fileExists(join(cwd, "app/admin/layout.tsx"))).toBe(false);
    expect(fileExists(join(cwd, "app/admin/provider.tsx"))).toBe(false);
  });

  it("admin files appear in result.files when installAdmin:true", async () => {
    const result = await runCreate({
      cwd,
      answers: makeAnswers({ installAdmin: true }),
      skipDbOps: true,
    });
    const paths = result.files.map((f) => f.path);
    expect(paths.some((p) => p.includes("admin/layout.tsx"))).toBe(true);
  });
});

// ── runCreate — Pages Router ───────────────────────────────────────────────────

describe("runCreate — Pages Router", () => {
  beforeEach(() => {
    // Replace app/ with pages/
    rmSync(join(cwd, "app"), { recursive: true, force: true });
    mkdirSync(join(cwd, "pages"), { recursive: true });
  });

  it("creates pages/admin/index.tsx when installAdmin:true", async () => {
    await runCreate({
      cwd,
      answers: makeAnswers({ router: "pages", installAdmin: true }),
      skipDbOps: true,
    });
    expect(fileExists(join(cwd, "pages/admin/index.tsx"))).toBe(true);
  });

  it("returns router:'pages' in result", async () => {
    const result = await runCreate({
      cwd,
      answers: makeAnswers({ router: "pages" }),
      skipDbOps: true,
    });
    expect(result.router).toBe("pages");
  });
});

// ── runCreate — result shape ───────────────────────────────────────────────────

describe("runCreate — result shape", () => {
  it("returns projectName from answers", async () => {
    const result = await runCreate({
      cwd,
      answers: makeAnswers({ projectName: "acme-cms" }),
      skipDbOps: true,
    });
    expect(result.projectName).toBe("acme-cms");
  });

  it("returns the cwd", async () => {
    const result = await runCreate({ cwd, answers: makeAnswers(), skipDbOps: true });
    expect(result.cwd).toBe(cwd);
  });

  it("dbConnected is false when skipDbOps:true", async () => {
    const result = await runCreate({ cwd, answers: makeAnswers(), skipDbOps: true });
    expect(result.dbConnected).toBe(false);
  });

  it("router matches answers.router", async () => {
    const result = await runCreate({
      cwd,
      answers: makeAnswers({ router: "app" }),
      skipDbOps: true,
    });
    expect(result.router).toBe("app");
  });
});

// ── runCreate — idempotency ────────────────────────────────────────────────────

describe("runCreate — idempotency", () => {
  it("second run produces no new files (all skipped)", async () => {
    const opts = { cwd, answers: makeAnswers(), skipDbOps: true };
    await runCreate(opts);

    // Ensure package.json reflects installed deps so second run skips them
    const firstResult = await runCreate(opts);
    const nonSkipped = firstResult.files.filter((f) => f.status !== "skipped");
    // Allow "updated" for package.json if deps were added; main non-package files should be skipped
    const generatedFiles = nonSkipped.filter((f) => f.path !== "package.json");
    expect(generatedFiles).toHaveLength(0);
  });
});

// ── createSummaryLines ─────────────────────────────────────────────────────────

describe("createSummaryLines", () => {
  function makeResult(overrides: Partial<Parameters<typeof createSummaryLines>[0]> = {}) {
    return {
      projectName: "test-app",
      cwd,
      router: "app" as const,
      files: [],
      dbConnected: false,
      installCmd: "npm install @orycms/core",
      ...overrides,
    };
  }

  it("contains the project name", () => {
    const lines = createSummaryLines(makeResult({ projectName: "my-project" }));
    expect(lines.join("\n")).toContain("my-project");
  });

  it("contains localhost URL", () => {
    const lines = createSummaryLines(makeResult());
    expect(lines.join("\n")).toContain("http://localhost:3000");
  });

  it("contains /admin URL", () => {
    const lines = createSummaryLines(makeResult());
    expect(lines.join("\n")).toContain("/admin");
  });

  it("includes the installCmd in next steps", () => {
    const lines = createSummaryLines(makeResult({ installCmd: "npm install @orycms/core" }));
    expect(lines.join("\n")).toContain("npm install @orycms/core");
  });

  it("uses custom port", () => {
    const lines = createSummaryLines(makeResult(), 4000);
    expect(lines.join("\n")).toContain("http://localhost:4000");
  });

  it("skips install step when installCmd is null", () => {
    const lines = createSummaryLines(makeResult({ installCmd: null }));
    // No install command mentioned
    expect(lines.join("\n")).not.toContain("install @orycms");
    // But next steps are still present
    expect(lines.join("\n")).toContain("next dev");
  });
});

// ── defaultAnswers ─────────────────────────────────────────────────────────────

describe("defaultAnswers", () => {
  it("returns a valid CreateAnswers object", () => {
    const answers = defaultAnswers(cwd);
    expect(answers.projectName).toBeTruthy();
    expect(["npm", "pnpm", "yarn", "bun"]).toContain(answers.packageManager);
    expect(["app", "pages"]).toContain(answers.router);
  });

  it("detects the correct router from cwd", () => {
    const answers = defaultAnswers(cwd); // cwd has app/ from beforeEach
    expect(answers.router).toBe("app");
  });

  it("defaults installAdmin to true", () => {
    expect(defaultAnswers(cwd).installAdmin).toBe(true);
  });

  it("defaults seedDb to false", () => {
    expect(defaultAnswers(cwd).seedDb).toBe(false);
  });
});

// ── registerCreateCommand ──────────────────────────────────────────────────────

describe("registerCreateCommand", () => {
  it("registers the command on the program", () => {
    const program = new Command();
    registerCreateCommand(program);
    // The program itself IS the command when using .name() and .action()
    expect(program.name()).toBe("create-orycms");
  });

  it("accepts a custom askFn and runs without TTY", async () => {
    const askFn = vi.fn().mockResolvedValue(makeAnswers());
    const program = new Command();
    program.exitOverride();

    registerCreateCommand(program, askFn);
    await program.parseAsync(["node", "create-orycms", "--cwd", cwd, "--skip-db"]);

    expect(askFn).toHaveBeenCalledOnce();
    expect(askFn).toHaveBeenCalledWith(cwd);
  });

  it("prints a success message to stdout", async () => {
    const lines: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });

    const askFn = vi.fn().mockResolvedValue(makeAnswers());
    const program = new Command();
    program.exitOverride();
    registerCreateCommand(program, askFn);
    await program.parseAsync(["node", "create-orycms", "--cwd", cwd, "--skip-db"]);

    vi.restoreAllMocks();

    const output = lines.join("");
    expect(output).toContain("OryCMS is ready");
  });

  it("prints the admin URL in the success output", async () => {
    const lines: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });

    const askFn = vi.fn().mockResolvedValue(makeAnswers());
    const program = new Command();
    program.exitOverride();
    registerCreateCommand(program, askFn);
    await program.parseAsync(["node", "create-orycms", "--cwd", cwd, "--skip-db"]);

    vi.restoreAllMocks();

    expect(lines.join("")).toContain("/admin");
  });
});
