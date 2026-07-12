import { join } from "node:path";

import { fileExists, readJsonFile, writeJsonFile } from "../../../shared/fs";
import type { GeneratorResult, InitContext } from "../types";

type TsConfig = {
  compilerOptions?: {
    paths?: Record<string, string[]>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

/** OryCMS path aliases added to tsconfig.json. */
const ORYCMS_PATHS: Record<string, string[]> = {
  "@orycms/*": ["./src/*"],
};

const ORYCMS_SENTINEL_KEY = "@orycms/*";

// ── Idempotent runner ─────────────────────────────────────────────────────────

export function generateTsConfig(ctx: InitContext): GeneratorResult {
  const path = "tsconfig.json";
  const full = join(ctx.cwd, path);

  if (!fileExists(full)) {
    // Nothing to patch — not an error, just note it
    return { path, status: "skipped", description: "tsconfig.json not found, skipped" };
  }

  let tsconfig: TsConfig;
  try {
    tsconfig = readJsonFile<TsConfig>(full);
  } catch {
    return { path, status: "skipped", description: "tsconfig.json could not be parsed" };
  }

  const paths = tsconfig.compilerOptions?.paths ?? {};

  if (paths[ORYCMS_SENTINEL_KEY]) {
    return { path, status: "skipped", description: "tsconfig.json already has OryCMS paths" };
  }

  tsconfig.compilerOptions ??= {};
  tsconfig.compilerOptions.paths = { ...paths, ...ORYCMS_PATHS };

  writeJsonFile(full, tsconfig);
  return { path, status: "updated" };
}
