import { join } from "node:path";

import { fileExists, readTextFile, writeTextFile } from "../../../shared/fs";
import { findNextConfigPath } from "../detectors/nextjs";
import type { GeneratorResult, InitContext } from "../types";

const ORYCMS_SENTINEL = "// orycms";

// ── Content builders ──────────────────────────────────────────────────────────

/** Create a fresh next.config.ts with OryCMS stubs when none exists. */
export function buildNextConfig(): string {
  return `import type { NextConfig } from "next";

// orycms — managed by \`orycms init\`
const nextConfig: NextConfig = {
  // OryCMS uses server actions and API routes.
  experimental: {},
};

export default nextConfig;
`;
}

/**
 * Inject an OryCMS comment block into an existing next.config file.
 * The injection is idempotent: returns the original string unchanged when the
 * sentinel is already present.
 */
export function injectOryCMSComment(source: string): string {
  if (source.includes(ORYCMS_SENTINEL)) return source;
  // Prepend a comment just after any leading comments/imports
  const commentBlock = `// orycms — managed by \`orycms init\`\n`;
  // Insert before the first `const`/`export` that isn't an import
  const insertBefore = /^(export\s+default|const\s+nextConfig)/m;
  const match = insertBefore.exec(source);
  if (!match || match.index == null) {
    return commentBlock + source;
  }
  return source.slice(0, match.index) + commentBlock + source.slice(match.index);
}

// ── Idempotent runner ─────────────────────────────────────────────────────────

export function generateNextConfig(ctx: InitContext): GeneratorResult {
  const existing = findNextConfigPath(ctx.cwd);

  if (!existing) {
    const path = "next.config.ts";
    writeTextFile(join(ctx.cwd, path), buildNextConfig());
    return { path, status: "created" };
  }

  const relPath = existing.replace(ctx.cwd + "/", "");
  const source = readTextFile(existing);

  if (source.includes(ORYCMS_SENTINEL)) {
    return {
      path: relPath,
      status: "skipped",
      description: "next.config already contains OryCMS marker",
    };
  }

  writeTextFile(existing, injectOryCMSComment(source));
  return { path: relPath, status: "updated" };
}
