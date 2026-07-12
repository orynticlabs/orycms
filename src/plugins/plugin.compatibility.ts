import type { OryCMSPluginManifest } from "./plugin.manifest";

// ── Types ─────────────────────────────────────────────────────────────────────

export type OryCMSCompatibilityErrorCode =
  "VERSION_INCOMPATIBLE" | "VERSION_UNPARSEABLE" | "NO_COMPATIBILITY_DECLARED";

export type OryCMSCompatibilityError = {
  code: OryCMSCompatibilityErrorCode;
  plugin: string;
  engine: string;
  required?: string;
  found?: string;
  message: string;
};

export type OryCMSCompatibilityReport = {
  compatible: boolean;
  errors: OryCMSCompatibilityError[];
};

export type OryCMSCompatibilityOptions = {
  /** The running OryCMS version to check against. Defaults to ORYCMS_VERSION. */
  oryCMSVersion?: string;
  /**
   * When true, plugins without a `compatibility` entry for "orycms" are
   * treated as compatible. When false (default) they emit NO_COMPATIBILITY_DECLARED.
   */
  allowUndeclared?: boolean;
};

/** Canonical OryCMS version used when no override is supplied. */
export const ORYCMS_VERSION = "0.0.0";

// ── Semver subset (same logic as plugin.dependencies.ts, local copy) ──────────
// ponytail: covers ^, ~, >=, >, <=, <, exact, *, || and compound ranges.

type SemVer = [number, number, number];

function parseVer(s: string): SemVer | null {
  const m = /^[v=]?(\d+)\.(\d+)\.(\d+)/.exec(s.trim());
  return m ? [+m[1], +m[2], +m[3]] : null;
}

function cmpVer(a: SemVer, b: SemVer): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

function satisfies(version: string, range: string): boolean {
  range = range.trim();
  if (!range || range === "*") return true;
  if (range.includes("||")) return range.split("||").some((r) => satisfies(version, r.trim()));
  const parts = range.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return parts.every((r) => satisfies(version, r));
  const v = parseVer(version);
  if (!v) return false;
  if (range.startsWith("^")) {
    const r = parseVer(range.slice(1));
    if (!r) return false;
    return cmpVer(v, r) >= 0 && cmpVer(v, [r[0] + 1, 0, 0]) < 0;
  }
  if (range.startsWith("~")) {
    const r = parseVer(range.slice(1));
    if (!r) return false;
    return cmpVer(v, r) >= 0 && cmpVer(v, [r[0], r[1] + 1, 0]) < 0;
  }
  if (range.startsWith(">=")) {
    const r = parseVer(range.slice(2));
    return r !== null && cmpVer(v, r) >= 0;
  }
  if (range.startsWith("<=")) {
    const r = parseVer(range.slice(2));
    return r !== null && cmpVer(v, r) <= 0;
  }
  if (range.startsWith(">")) {
    const r = parseVer(range.slice(1));
    return r !== null && cmpVer(v, r) > 0;
  }
  if (range.startsWith("<")) {
    const r = parseVer(range.slice(1));
    return r !== null && cmpVer(v, r) < 0;
  }
  const r = parseVer(range);
  return r !== null && cmpVer(v, r) === 0;
}

// ── Core check ────────────────────────────────────────────────────────────────

function checkOne(
  pluginId: string,
  oryCMSVersion: string,
  required: string | undefined,
  allowUndeclared: boolean,
): OryCMSCompatibilityError | null {
  if (!required) {
    if (allowUndeclared) return null;
    return {
      code: "NO_COMPATIBILITY_DECLARED",
      plugin: pluginId,
      engine: "orycms",
      message: `Plugin "${pluginId}" does not declare an "orycms" compatibility range.`,
    };
  }

  if (!parseVer(oryCMSVersion)) {
    return {
      code: "VERSION_UNPARSEABLE",
      plugin: pluginId,
      engine: "orycms",
      required,
      found: oryCMSVersion,
      message: `OryCMS version "${oryCMSVersion}" could not be parsed as a semver string.`,
    };
  }

  if (!satisfies(oryCMSVersion, required)) {
    return {
      code: "VERSION_INCOMPATIBLE",
      plugin: pluginId,
      engine: "orycms",
      required,
      found: oryCMSVersion,
      message: `Plugin "${pluginId}" requires "orycms@${required}" but the running version is "${oryCMSVersion}".`,
    };
  }

  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Validate a single plugin manifest against the current OryCMS version.
 * Returns an array of typed compatibility errors (empty = compatible).
 * Never throws.
 */
export function validateOryCMSPluginCompatibility(
  manifest: OryCMSPluginManifest,
  options: OryCMSCompatibilityOptions = {},
): OryCMSCompatibilityError[] {
  const oryCMSVersion = options.oryCMSVersion ?? ORYCMS_VERSION;
  const allowUndeclared = options.allowUndeclared ?? false;
  const required = manifest.compatibility?.["orycms"];
  const err = checkOne(manifest.id, oryCMSVersion, required, allowUndeclared);
  return err ? [err] : [];
}

/**
 * Quick boolean compatibility check.
 * Returns true only when `validateOryCMSPluginCompatibility` produces no errors.
 */
export function isOryCMSPluginCompatible(
  manifest: OryCMSPluginManifest,
  options: OryCMSCompatibilityOptions = {},
): boolean {
  return validateOryCMSPluginCompatibility(manifest, options).length === 0;
}

/**
 * Produce a compatibility report for an array of plugin manifests.
 * `compatible` is true only when every plugin passes.
 */
export function getOryCMSPluginCompatibilityReport(
  manifests: OryCMSPluginManifest[],
  options: OryCMSCompatibilityOptions = {},
): OryCMSCompatibilityReport {
  const errors: OryCMSCompatibilityError[] = [];
  for (const m of manifests) {
    errors.push(...validateOryCMSPluginCompatibility(m, options));
  }
  return { compatible: errors.length === 0, errors };
}
