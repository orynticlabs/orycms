import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// ── Error class ───────────────────────────────────────────────────────────────

export type OryCMSManifestErrorCode =
  "MANIFEST_NOT_FOUND" | "MANIFEST_INVALID_JSON" | "MANIFEST_INVALID";

export class OryCMSManifestError extends Error {
  readonly code: OryCMSManifestErrorCode;
  constructor(code: OryCMSManifestErrorCode, message: string) {
    super(message);
    this.name = "OryCMSManifestError";
    this.code = code;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type OryCMSPluginCategory =
  "analytics" | "auth" | "commerce" | "content" | "email" | "media" | "other" | "seo" | "storage";

export type OryCMSManifestAuthor = string | { name: string; email?: string; url?: string };

export type OryCMSPluginManifest = {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: OryCMSManifestAuthor;
  license?: string;
  homepage?: string;
  repository?: string | { type: string; url: string };
  keywords?: string[];
  icon?: string;
  category?: OryCMSPluginCategory;
  compatibility?: Record<string, string>;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  permissions?: string[];
};

export type OryCMSManifestReadItem = {
  dir: string;
  origin: "local" | "node_modules";
  manifest?: OryCMSPluginManifest;
  status: "found" | "missing" | "failed";
  reason?: string;
};

export type OryCMSManifestResult = {
  found: OryCMSManifestReadItem[];
  missing: OryCMSManifestReadItem[];
  failed: OryCMSManifestReadItem[];
};

export type OryCMSManifestOptions = {
  cwd?: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const MANIFEST_FILE = "orycms-plugin.json";

const VALID_CATEGORIES = new Set<string>([
  "analytics",
  "auth",
  "commerce",
  "content",
  "email",
  "media",
  "other",
  "seo",
  "storage",
]);

// ── Validation ────────────────────────────────────────────────────────────────

function assertNonEmptyString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new OryCMSManifestError("MANIFEST_INVALID", `${path} must be a non-empty string.`);
  }
}

function assertOptionalString(value: unknown, path: string): void {
  if (value !== undefined && typeof value !== "string") {
    throw new OryCMSManifestError("MANIFEST_INVALID", `${path} must be a string.`);
  }
}

function assertOptionalStringRecord(value: unknown, path: string): void {
  if (value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OryCMSManifestError("MANIFEST_INVALID", `${path} must be an object.`);
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v !== "string") {
      throw new OryCMSManifestError("MANIFEST_INVALID", `${path}["${k}"] must be a string.`);
    }
  }
}

function assertOptionalStringArray(value: unknown, path: string): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    throw new OryCMSManifestError("MANIFEST_INVALID", `${path} must be an array.`);
  }
  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] !== "string") {
      throw new OryCMSManifestError("MANIFEST_INVALID", `${path}[${i}] must be a string.`);
    }
  }
}

/**
 * Validate a parsed manifest object. Throws OryCMSManifestError on any violation.
 */
export function validateOryCMSPluginManifest(data: unknown): asserts data is OryCMSPluginManifest {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new OryCMSManifestError("MANIFEST_INVALID", "Manifest must be a plain object.");
  }

  const m = data as Record<string, unknown>;

  assertNonEmptyString(m["id"], "manifest.id");
  assertNonEmptyString(m["name"], "manifest.name");
  assertNonEmptyString(m["version"], "manifest.version");

  assertOptionalString(m["description"], "manifest.description");
  assertOptionalString(m["license"], "manifest.license");
  assertOptionalString(m["homepage"], "manifest.homepage");
  assertOptionalString(m["icon"], "manifest.icon");
  assertOptionalStringArray(m["keywords"], "manifest.keywords");
  assertOptionalStringArray(m["permissions"], "manifest.permissions");
  assertOptionalStringRecord(m["compatibility"], "manifest.compatibility");
  assertOptionalStringRecord(m["dependencies"], "manifest.dependencies");
  assertOptionalStringRecord(m["peerDependencies"], "manifest.peerDependencies");

  if (m["category"] !== undefined) {
    if (!VALID_CATEGORIES.has(m["category"] as string)) {
      throw new OryCMSManifestError(
        "MANIFEST_INVALID",
        `manifest.category must be one of: ${[...VALID_CATEGORIES].sort().join(", ")}.`,
      );
    }
  }

  if (m["author"] !== undefined) {
    const a = m["author"];
    if (typeof a !== "string") {
      if (!a || typeof a !== "object" || Array.isArray(a)) {
        throw new OryCMSManifestError(
          "MANIFEST_INVALID",
          "manifest.author must be a string or an object.",
        );
      }
      const ao = a as Record<string, unknown>;
      assertNonEmptyString(ao["name"], "manifest.author.name");
      assertOptionalString(ao["email"], "manifest.author.email");
      assertOptionalString(ao["url"], "manifest.author.url");
    }
  }

  if (m["repository"] !== undefined) {
    const r = m["repository"];
    if (typeof r !== "string") {
      if (!r || typeof r !== "object" || Array.isArray(r)) {
        throw new OryCMSManifestError(
          "MANIFEST_INVALID",
          "manifest.repository must be a string or an object.",
        );
      }
      const ro = r as Record<string, unknown>;
      assertNonEmptyString(ro["url"], "manifest.repository.url");
      assertNonEmptyString(ro["type"], "manifest.repository.type");
    }
  }
}

// ── File reading ──────────────────────────────────────────────────────────────

/**
 * Read and validate the manifest from a plugin directory.
 * Throws OryCMSManifestError if the file is missing, has invalid JSON, or fails validation.
 * Does NOT import or execute any plugin code.
 */
export function readOryCMSPluginManifest(dir: string): OryCMSPluginManifest {
  const manifestPath = join(dir, MANIFEST_FILE);

  if (!existsSync(manifestPath)) {
    throw new OryCMSManifestError("MANIFEST_NOT_FOUND", `Manifest file not found: ${manifestPath}`);
  }

  let raw: string;
  try {
    raw = readFileSync(manifestPath, "utf-8");
  } catch (err) {
    throw new OryCMSManifestError(
      "MANIFEST_NOT_FOUND",
      `Could not read manifest file: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new OryCMSManifestError(
      "MANIFEST_INVALID_JSON",
      `Manifest file contains invalid JSON: ${manifestPath}`,
    );
  }

  validateOryCMSPluginManifest(parsed);
  return parsed;
}

// ── Directory scanning (duplicated from discovery intentionally — no coupling) ─

function scanSubdirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => join(dir, e.name));
  } catch {
    return [];
  }
}

/**
 * Read manifests from all plugin directories under `plugins/` and
 * `node_modules/orycms-plugin-*`. No plugin code is imported or executed.
 */
export function readOryCMSPluginManifests(
  options: OryCMSManifestOptions = {},
): OryCMSManifestResult {
  const cwd = resolve(options.cwd ?? process.cwd());
  const result: OryCMSManifestResult = { found: [], missing: [], failed: [] };

  const localDirs = scanSubdirs(join(cwd, "plugins")).map((dir) => ({
    dir,
    origin: "local" as const,
  }));

  const nodeModulesDirs = scanSubdirs(join(cwd, "node_modules"))
    .filter((dir) => {
      const name = dir.split(/[/\\]/).pop() ?? "";
      return name.startsWith("orycms-plugin-");
    })
    .map((dir) => ({ dir, origin: "node_modules" as const }));

  for (const { dir, origin } of [...localDirs, ...nodeModulesDirs]) {
    const manifestPath = join(dir, MANIFEST_FILE);

    if (!existsSync(manifestPath)) {
      result.missing.push({ dir, origin, status: "missing" });
      continue;
    }

    try {
      const manifest = readOryCMSPluginManifest(dir);
      result.found.push({ dir, origin, manifest, status: "found" });
    } catch (err) {
      result.failed.push({
        dir,
        origin,
        status: "failed",
        reason: err instanceof Error ? err.message : "Unknown error reading manifest.",
      });
    }
  }

  return result;
}
