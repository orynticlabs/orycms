import { existsSync } from "node:fs";
import { join } from "node:path";

import type { PackageManager } from "../types";

/**
 * Detect the package manager in use by checking for lock files, in priority order:
 * bun → pnpm → yarn → npm (default).
 *
 * This is a filesystem-only check; no process spawning is required.
 */
export function detectPackageManager(cwd: string): PackageManager {
  const checks: Array<[string, PackageManager]> = [
    ["bun.lockb", "bun"],
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
  ];

  for (const [file, pm] of checks) {
    if (existsSync(join(cwd, file))) return pm;
  }

  return "npm";
}

/** Return the install command for the detected package manager. */
export function installCommand(pm: PackageManager, packages: string[]): string {
  if (packages.length === 0) return "";
  const pkgs = packages.join(" ");
  switch (pm) {
    case "bun":
      return `bun add ${pkgs}`;
    case "pnpm":
      return `pnpm add ${pkgs}`;
    case "yarn":
      return `yarn add ${pkgs}`;
    default:
      return `npm install ${pkgs}`;
  }
}
