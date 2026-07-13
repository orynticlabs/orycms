import { join } from "node:path";

import { fileExists, readTextFile, writeTextFile } from "../../../shared/fs";
import type { GeneratorResult, InitContext, OfficialPlugin } from "../types";

const ORYCMS_SENTINEL = "defineOryCMSConfig";

// ── Lookup tables ─────────────────────────────────────────────────────────────

const DB_PROVIDER_MAP: Record<string, string> = {
  postgresql: "postgresql",
  mysql: "mysql",
  mongodb: "mongodb",
  supabase: "supabase",
  neon: "neon",
  firebase: "firebase",
};

const AUTH_PROVIDER_MAP: Record<string, string> = {
  "better-auth": "better-auth",
  "auth-js": "next-auth",
  clerk: "clerk",
  none: "none",
};

// ── Content builder ───────────────────────────────────────────────────────────

function pluginEntry(id: OfficialPlugin): string {
  return `    { plugin: require("${id}").default }`;
}

export function buildOryCMSConfig(ctx: InitContext): string {
  const { answers } = ctx;
  const pluginsBlock =
    answers.plugins.length > 0 ? `[\n${answers.plugins.map(pluginEntry).join(",\n")},\n  ]` : "[]";

  return `import { defineOryCMSConfig } from "@ory-cms/core";

export default defineOryCMSConfig({
  database: {
    provider: "${DB_PROVIDER_MAP[answers.database] ?? answers.database}",
  },
  auth: {
    provider: "${AUTH_PROVIDER_MAP[answers.auth] ?? answers.auth}",
  },
  plugins: {
    enabled: true,
    entries: ${pluginsBlock},
  },
  hooks: {
    enabled: true,
  },
  admin: {
    enabled: true,
    basePath: "/admin",
  },
  storage: {
    provider: "local",
  },
});
`;
}

// ── Idempotent runner ─────────────────────────────────────────────────────────

export function generateOryCMSConfig(ctx: InitContext): GeneratorResult {
  const path = "orycms.config.ts";
  const full = join(ctx.cwd, path);

  if (fileExists(full)) {
    const existing = readTextFile(full);
    if (existing.includes(ORYCMS_SENTINEL)) {
      return { path, status: "skipped", description: "orycms.config.ts already initialised" };
    }
    // File exists but is a plain config — overwrite is safe
  }

  const wasPresent = fileExists(full);
  writeTextFile(full, buildOryCMSConfig(ctx));
  return { path, status: wasPresent ? "updated" : "created", description: "orycms.config.ts" };
}
