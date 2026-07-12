import { existsSync } from "node:fs";
import { join } from "node:path";

import { fileExists, readJsonFile } from "../../../shared/fs";
import type { NextJsInfo } from "../types";

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

/**
 * Detect whether `cwd` is a Next.js App Router project.
 *
 * Detection criteria:
 *  1. `package.json` exists and has `next` in dependencies or devDependencies.
 *  2. An `app/` directory exists (App Router convention).
 *
 * Configuration files (`next.config.ts`, `next.config.js`, `next.config.mjs`)
 * are checked as supporting evidence but are not required.
 */
export function detectNextJs(cwd: string): NextJsInfo {
  const pkgPath = join(cwd, "package.json");
  if (!fileExists(pkgPath)) {
    return { detected: false, hasAppRouter: false };
  }

  let pkg: PackageJson;
  try {
    pkg = readJsonFile<PackageJson>(pkgPath);
  } catch {
    return { detected: false, hasAppRouter: false };
  }

  const nextVersion = pkg.dependencies?.["next"] ?? pkg.devDependencies?.["next"] ?? null;

  if (!nextVersion) {
    return { detected: false, hasAppRouter: false };
  }

  const hasAppRouter = existsSync(join(cwd, "app"));

  return {
    detected: true,
    hasAppRouter,
    nextVersion,
  };
}

/**
 * Return the path to the Next.js config file present in `cwd`, or undefined
 * when none is found. Checked in priority order.
 */
export function findNextConfigPath(cwd: string): string | undefined {
  const candidates = [
    "next.config.ts",
    "next.config.mts",
    "next.config.js",
    "next.config.mjs",
    "next.config.cjs",
  ];
  for (const name of candidates) {
    const full = join(cwd, name);
    if (existsSync(full)) return full;
  }
  return undefined;
}
