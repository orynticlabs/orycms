import { generateAppRoutes } from "./generators/admin-route";
import { generateEnvExample } from "./generators/env-example";
import { generateNextConfig } from "./generators/next-config";
import { generateOryCMSConfig } from "./generators/orycms-config";
import { generatePackageJson } from "./generators/package-json-updater";
import { generateTsConfig } from "./generators/tsconfig-updater";
import type { GeneratorResult, InitAnswers, InitContext, PackageManager } from "./types";
import { installCommand } from "./detectors/package-manager";

type InitRunOptions = {
  cwd: string;
  packageManager: PackageManager;
  answers: InitAnswers;
};

export type InitSummary = {
  files: GeneratorResult[];
  installCmd: string | null;
};

/**
 * Run all generators for the given context.
 * Generators are pure-ish functions that write files and return a status.
 * This function collects all results for the caller to display.
 */
export function runInit(opts: InitRunOptions): InitSummary {
  const ctx: InitContext = {
    cwd: opts.cwd,
    packageManager: opts.packageManager,
    answers: opts.answers,
  };

  const files: GeneratorResult[] = [];

  // 1. orycms.config.ts
  files.push(generateOryCMSConfig(ctx));

  // 2. next.config.ts / next.config.js — update or create
  files.push(generateNextConfig(ctx));

  // 3. tsconfig.json — add @ory-cms/* paths
  files.push(generateTsConfig(ctx));

  // 4. .env.example — merge env vars
  files.push(generateEnvExample(ctx));

  // 5. App Router route stubs (/admin, /collections, /plugins)
  files.push(...generateAppRoutes(ctx));

  // 6. package.json — mark missing deps; capture what needs to be installed
  const pkgResult = generatePackageJson(ctx);
  files.push(pkgResult);

  const installCmd =
    pkgResult.toInstall.length > 0 ? installCommand(ctx.packageManager, pkgResult.toInstall) : null;

  return { files, installCmd };
}
