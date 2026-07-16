/**
 * Structural parity test: `orycms init` (runInit) and `create-ory-cms` (runCreate)
 * must scaffold the SAME on-disk layout — all CMS source under /orycms, with only
 * thin re-export shims placed under app/.
 *
 * Guards the refactor that consolidated scattered CMS files into /orycms.
 */
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runInit } from "../../../cli/src/commands/init/init";
import { bootstrapAdmin } from "../../../cli/src/commands/init/bootstrap";
import { runCreate } from "../runner";
import type { CreateAnswers } from "../runner";

// ── Fixtures ───────────────────────────────────────────────────────────────────

let cwdInit: string;
let cwdCreate: string;

function scaffoldNextProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "orycms-parity-"));
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ dependencies: { next: "^14.0.0", react: "^18.0.0" } }),
  );
  writeFileSync(
    join(dir, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } } }),
  );
  mkdirSync(join(dir, "app"), { recursive: true });
  return dir;
}

beforeEach(() => {
  cwdInit = scaffoldNextProject();
  cwdCreate = scaffoldNextProject();
});

afterEach(() => {
  rmSync(cwdInit, { recursive: true, force: true });
  rmSync(cwdCreate, { recursive: true, force: true });
});

/** Recursively list files relative to `root`, sorted. */
function listFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(relative(root, full));
    }
  };
  walk(root);
  return out.sort();
}

const CREATE_ANSWERS: CreateAnswers = {
  projectName: "parity-app",
  packageManager: "npm",
  router: "app",
  dbConfig: { provider: "sqlite", filePath: ":memory:" },
  storageProvider: "local",
  authProvider: "better-auth",
  installAdmin: true,
  seedDb: false,
  createOwner: false,
  ownerEmail: "admin@localhost",
  ownerPassword: "",
  plugins: [],
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("installer structural parity", () => {
  it("cli init + bootstrap and create-ory-cms produce the same file tree", async () => {
    // `orycms init` = runInit (routes/config) + bootstrapAdmin (admin scaffold),
    // which is exactly what runCreate composes internally.
    runInit({
      cwd: cwdInit,
      packageManager: "npm",
      answers: { database: "sqlite", auth: "better-auth", plugins: [] },
    });
    await bootstrapAdmin({ cwd: cwdInit, router: "app" });

    await runCreate({ cwd: cwdCreate, answers: CREATE_ANSWERS, skipDbOps: true });

    expect(listFiles(cwdInit)).toEqual(listFiles(cwdCreate));
  });

  it("all generated .tsx CMS source lives under orycms/ (app/ holds only shims)", async () => {
    await runCreate({ cwd: cwdCreate, answers: CREATE_ANSWERS, skipDbOps: true });

    const appTsx = listFiles(cwdCreate).filter(
      (f) => f.startsWith("app/") && f.endsWith(".tsx"),
    );
    // Every app/*.tsx must be a thin re-export shim into ../../orycms/*
    for (const rel of appTsx) {
      const content = require("node:fs").readFileSync(join(cwdCreate, rel), "utf8");
      expect(content).toContain("../../orycms/");
      expect(content).toMatch(/export \{ default[^}]*\} from/);
      expect(content).not.toContain("export default function");
    }
    expect(appTsx.length).toBeGreaterThan(0);
  });

  it("creates the dedicated orycms/ folder with admin bodies", async () => {
    await runCreate({ cwd: cwdCreate, answers: CREATE_ANSWERS, skipDbOps: true });
    const files = listFiles(cwdCreate);
    expect(files).toContain("orycms/admin/layout.tsx");
    expect(files).toContain("orycms/admin/page.tsx");
    expect(files).toContain("orycms/admin/provider.tsx");
  });
});
