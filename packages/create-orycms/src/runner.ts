import { basename } from "node:path";

import { detectAppStructure, bootstrapAdmin } from "../../cli/src/commands/init/bootstrap";
import { testDatabaseConnection } from "../../cli/src/commands/init/database/connection";
import { migrateDatabase } from "../../cli/src/commands/init/database/migrations";
import { seedDatabase } from "../../cli/src/commands/init/database/seeder";
import { detectPackageManager } from "../../cli/src/commands/init/detectors/package-manager";
import { runInit } from "../../cli/src/commands/init/init";
import type {
  AuthProvider,
  GeneratorResult,
  OfficialPlugin,
  PackageManager,
} from "../../cli/src/commands/init/types";
import type { DatabaseWizardResult } from "../../cli/src/commands/init/database/wizard";
import type { ConfirmFn, RouterType } from "../../cli/src/commands/init/bootstrap";

// ── Public types ───────────────────────────────────────────────────────────────

export type StorageProvider = "local" | "s3" | "cloudinary" | "none";

export interface CreateAnswers {
  /** Display name for the project (informational only). */
  projectName: string;
  packageManager: PackageManager;
  /** Resolved router type — "auto" is not allowed here; prompts must resolve it. */
  router: RouterType;
  dbConfig: DatabaseWizardResult;
  storageProvider: StorageProvider;
  authProvider: AuthProvider;
  /** Whether to scaffold admin layout/page/provider files. */
  installAdmin: boolean;
  /** Whether to seed the database with default system data. */
  seedDb: boolean;
  /** Whether to create the initial Owner user account during seeding. */
  createOwner: boolean;
  ownerEmail: string;
  ownerPassword: string;
  plugins: OfficialPlugin[];
}

export interface CreateOptions {
  cwd: string;
  answers: CreateAnswers;
  confirm?: ConfirmFn;
  /**
   * Skip live database operations (connection test, migrations, seeding).
   * Used in tests to avoid needing real DB drivers.
   */
  skipDbOps?: boolean;
}

export interface CreateResult {
  projectName: string;
  cwd: string;
  router: RouterType;
  files: GeneratorResult[];
  dbConnected: boolean;
  installCmd: string | null;
}

// ── Type for injectable ask function ──────────────────────────────────────────

export type CreateAskFn = (cwd: string) => Promise<CreateAnswers>;

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Default answers for the prompts — used in tests and as safe fallback. */
export function defaultAnswers(cwd: string): CreateAnswers {
  return {
    projectName: basename(cwd),
    packageManager: detectPackageManager(cwd),
    router: detectAppStructure(cwd).router,
    dbConfig: { provider: "sqlite", filePath: "./orycms.db" },
    storageProvider: "local",
    authProvider: "none",
    installAdmin: true,
    seedDb: false,
    createOwner: false,
    ownerEmail: "admin@localhost",
    ownerPassword: "",
    plugins: [],
  };
}

// ── Runner ─────────────────────────────────────────────────────────────────────

/**
 * Orchestrate the full OryCMS installation into an existing Next.js project.
 *
 * 1. Generates config, env, tsconfig, next-config via runInit.
 * 2. Bootstraps the admin scaffold when requested.
 * 3. Tests the database connection (unless skipDbOps is set).
 * 4. Runs migrations + seeder when the DB is reachable and seeding is enabled.
 *
 * All file operations are idempotent — safe to call multiple times.
 */
export async function runCreate(opts: CreateOptions): Promise<CreateResult> {
  const { cwd, answers, confirm, skipDbOps = false } = opts;

  // ── 1. Core file generation (config, env, tsconfig, next-config, deps) ──────
  const { files: initFiles, installCmd } = runInit({
    cwd,
    packageManager: answers.packageManager,
    answers: {
      database: answers.dbConfig.provider,
      auth: answers.authProvider,
      plugins: answers.plugins,
    },
  });

  const files: GeneratorResult[] = [...initFiles];

  // ── 2. Admin scaffold (layout, page, provider) ────────────────────────────
  if (answers.installAdmin) {
    // Pass answers.router so bootstrapAdmin doesn't auto-detect from filesystem
    // state that may have been changed by runInit (which always creates app/ stubs).
    const { files: adminFiles } = await bootstrapAdmin({ cwd, confirm, router: answers.router });
    files.push(...adminFiles);
  }

  // ── 3. Database operations ────────────────────────────────────────────────
  let dbConnected = false;

  if (!skipDbOps) {
    const connResult = await testDatabaseConnection(answers.dbConfig);
    dbConnected = connResult.ok;

    if (dbConnected && answers.seedDb) {
      try {
        // Ensure the migration-tracking table exists (passes empty migration list).
        await migrateDatabase([], answers.dbConfig);

        await seedDatabase(answers.dbConfig, {
          admin:
            answers.createOwner && answers.ownerEmail
              ? { email: answers.ownerEmail, password: answers.ownerPassword || undefined }
              : undefined,
        });
      } catch {
        // Seeding failures are non-fatal; the user can re-run manually.
      }
    }
  }

  return {
    projectName: answers.projectName,
    cwd,
    router: answers.router,
    files,
    dbConnected,
    installCmd,
  };
}

// ── Success message ────────────────────────────────────────────────────────────

/**
 * Build the lines shown in the success banner.
 * Pure function — no I/O.
 */
export function createSummaryLines(result: CreateResult, port = 3000): string[] {
  const base = `http://localhost:${port}`;
  const lines: string[] = [
    `Project: ${result.projectName}`,
    `Local:   ${base}`,
    `Admin:   ${base}/admin`,
    "",
    "Next steps:",
  ];

  if (result.installCmd) {
    lines.push(`  1. ${result.installCmd}`);
    lines.push(`  2. Configure your .env file`);
    lines.push(`  3. next dev`);
    lines.push(`  4. Open ${base}/admin`);
  } else {
    lines.push(`  1. Configure your .env file`);
    lines.push(`  2. next dev`);
    lines.push(`  3. Open ${base}/admin`);
  }

  return lines;
}
