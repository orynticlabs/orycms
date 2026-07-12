import { join } from "node:path";

import { fileExists, readJsonFile, writeJsonFile } from "../../../shared/fs";
import type {
  AuthProvider,
  DatabaseProvider,
  GeneratorResult,
  InitContext,
  OfficialPlugin,
} from "../types";

// ── Dependency lookup tables ──────────────────────────────────────────────────

const ORYCMS_CORE = "@ory-cms/core";

const DB_PACKAGES: Record<DatabaseProvider, string[]> = {
  postgresql: ["pg", "@types/pg"],
  mysql: ["mysql2"],
  mariadb: ["mysql2"],
  sqlite: ["better-sqlite3", "@types/better-sqlite3"],
  mongodb: ["mongoose"],
  supabase: ["@supabase/supabase-js"],
  neon: ["@neondatabase/serverless"],
  firebase: ["firebase-admin"],
};

const AUTH_PACKAGES: Record<AuthProvider, string[]> = {
  "better-auth": ["better-auth"],
  "auth-js": ["next-auth"],
  clerk: ["@clerk/nextjs"],
  none: [],
};

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
};

// ── Pure helper ───────────────────────────────────────────────────────────────

/** Return the full list of production packages needed for the given answers. */
export function resolveDependencies(
  db: DatabaseProvider,
  auth: AuthProvider,
  plugins: OfficialPlugin[],
): string[] {
  return [ORYCMS_CORE, ...(DB_PACKAGES[db] ?? []), ...(AUTH_PACKAGES[auth] ?? []), ...plugins];
}

// ── Idempotent runner ─────────────────────────────────────────────────────────

/**
 * Add missing OryCMS dependencies to package.json.
 * Existing entries are never overwritten. Returns the list of packages that
 * were actually added (empty when everything was already present).
 */
export function generatePackageJson(ctx: InitContext): GeneratorResult & { toInstall: string[] } {
  const path = "package.json";
  const full = join(ctx.cwd, path);

  if (!fileExists(full)) {
    return { path, status: "skipped", description: "package.json not found", toInstall: [] };
  }

  let pkg: PackageJson;
  try {
    pkg = readJsonFile<PackageJson>(full);
  } catch {
    return {
      path,
      status: "skipped",
      description: "package.json could not be parsed",
      toInstall: [],
    };
  }

  const existing = new Set<string>([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ]);

  const wanted = resolveDependencies(ctx.answers.database, ctx.answers.auth, ctx.answers.plugins);

  const toInstall = wanted.filter((p) => !existing.has(p));

  if (toInstall.length === 0) {
    return {
      path,
      status: "skipped",
      description: "all dependencies already present",
      toInstall: [],
    };
  }

  // Mark them as pending — the orchestrator will run the install command
  pkg.dependencies ??= {};
  for (const dep of toInstall) {
    pkg.dependencies[dep] = "*"; // placeholder; real version set by install command
  }

  writeJsonFile(full, pkg);
  return { path, status: "updated", toInstall };
}
