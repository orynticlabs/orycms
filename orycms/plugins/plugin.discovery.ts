import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { validateOryCMSPlugin } from "./plugin.engine";
import { hasOryCMSPlugin, registerOryCMSPlugin, unregisterOryCMSPlugin } from "./plugin.registry";
import type { OryCMSPlugin } from "./plugin.types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type OryCMSPluginOrigin = "local" | "node_modules";

export type OryCMSDiscoveredPluginItem = {
  source: string;
  origin: OryCMSPluginOrigin;
  plugin?: OryCMSPlugin;
  status: "discovered" | "failed";
  reason?: string;
};

export type OryCMSDiscoveryResult = {
  discovered: OryCMSDiscoveredPluginItem[];
  failed: OryCMSDiscoveredPluginItem[];
};

export type OryCMSDiscoveryOptions = {
  cwd?: string;
  bypassCache?: boolean;
};

export type OryCMSDiscoveryLoadResult = {
  loaded: OryCMSDiscoveredPluginItem[];
  skipped: OryCMSDiscoveredPluginItem[];
  failed: OryCMSDiscoveredPluginItem[];
};

// ── Internal state ────────────────────────────────────────────────────────────

/** IDs registered through auto-discovery — lets reloadDiscoveredOryCMSPlugins know what to clean up. */
const _discoveredIds = new Set<string>();

/** Import cache-bust counter, same pattern as config.loader.ts. */
let _cacheBust = 0;

const ENTRY_FILES = ["index.ts", "index.js"] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

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

async function tryImportEntry(
  dir: string,
  bypassCache: boolean,
): Promise<{ mod?: unknown; entryFile?: string; error?: Error }> {
  let firstFound: string | undefined;
  for (const name of ENTRY_FILES) {
    const entryPath = join(dir, name);
    if (!existsSync(entryPath)) continue;
    if (!firstFound) firstFound = entryPath; // remember first found for error reporting
    try {
      const url = pathToFileURL(entryPath);
      if (bypassCache) {
        _cacheBust += 1;
        url.searchParams.set("t", String(_cacheBust));
      }
      const mod = await import(/* @vite-ignore */ url.href);
      return { mod, entryFile: entryPath };
    } catch {
      // try next entry file
    }
  }
  if (!firstFound) return {}; // no entry file — not a plugin dir, silently skip
  return {
    entryFile: firstFound,
    error: new Error(`Could not import any entry file in "${dir}".`),
  };
}

function extractPlugin(mod: unknown): OryCMSPlugin | undefined {
  if (!mod || typeof mod !== "object") return undefined;
  const m = mod as Record<string, unknown>;
  return (m["default"] ?? m["plugin"]) as OryCMSPlugin | undefined;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Scan the local `plugins/` directory and `node_modules/orycms-plugin-*` packages
 * for plugin manifests, validate them, and return a result without loading anything.
 * Directories without a recognised entry file are silently skipped.
 */
export async function discoverOryCMSPlugins(
  options: OryCMSDiscoveryOptions = {},
): Promise<OryCMSDiscoveryResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const bypassCache = options.bypassCache ?? false;
  const result: OryCMSDiscoveryResult = { discovered: [], failed: [] };
  const seenIds = new Set<string>();

  const localDirs = scanSubdirs(join(cwd, "plugins")).map((dir) => ({
    dir,
    origin: "local" as OryCMSPluginOrigin,
  }));

  const nodeModulesDirs = scanSubdirs(join(cwd, "node_modules"))
    .filter((dir) => {
      const name = dir.split(/[/\\]/).pop() ?? "";
      return name.startsWith("orycms-plugin-");
    })
    .map((dir) => ({ dir, origin: "node_modules" as OryCMSPluginOrigin }));

  for (const { dir, origin } of [...localDirs, ...nodeModulesDirs]) {
    const { mod, entryFile, error } = await tryImportEntry(dir, bypassCache);

    if (!entryFile) continue; // not a plugin dir

    if (error || !mod) {
      result.failed.push({
        source: entryFile,
        origin,
        status: "failed",
        reason: error?.message ?? "Entry file could not be imported.",
      });
      continue;
    }

    const plugin = extractPlugin(mod);
    if (!plugin || typeof plugin !== "object") {
      result.failed.push({
        source: entryFile,
        origin,
        status: "failed",
        reason: "Plugin entry does not export a default plugin definition.",
      });
      continue;
    }

    try {
      validateOryCMSPlugin(plugin);
    } catch (err) {
      result.failed.push({
        source: entryFile,
        origin,
        plugin,
        status: "failed",
        reason: err instanceof Error ? err.message : "Invalid plugin manifest.",
      });
      continue;
    }

    if (seenIds.has(plugin.id)) {
      result.failed.push({
        source: entryFile,
        origin,
        plugin,
        status: "failed",
        reason: `Duplicate plugin id "${plugin.id}" encountered during discovery.`,
      });
      continue;
    }

    seenIds.add(plugin.id);
    result.discovered.push({ source: entryFile, origin, plugin, status: "discovered" });
  }

  return result;
}

/**
 * Discover plugins and register valid ones via the existing plugin registry.
 * Plugins that are already registered are skipped without error.
 * Discovery failures are placed in `skipped`.
 */
export async function loadDiscoveredOryCMSPlugins(
  options: OryCMSDiscoveryOptions = {},
): Promise<OryCMSDiscoveryLoadResult> {
  const { discovered, failed } = await discoverOryCMSPlugins(options);
  const result: OryCMSDiscoveryLoadResult = {
    loaded: [],
    skipped: [...failed], // discovery failures propagate as skipped
    failed: [],
  };

  for (const item of discovered) {
    const plugin = item.plugin!;

    if (hasOryCMSPlugin(plugin.id)) {
      result.skipped.push({
        ...item,
        status: "failed",
        reason: `Plugin "${plugin.id}" is already registered.`,
      });
      continue;
    }

    try {
      registerOryCMSPlugin(plugin);
      _discoveredIds.add(plugin.id);
      result.loaded.push(item);
    } catch (err) {
      result.failed.push({
        ...item,
        status: "failed",
        reason: err instanceof Error ? err.message : "Failed to register plugin.",
      });
    }
  }

  return result;
}

/**
 * Unregister all plugins loaded by the previous auto-discovery run, then
 * re-discover and load fresh. Always bypasses the import cache.
 */
export async function reloadDiscoveredOryCMSPlugins(
  options: OryCMSDiscoveryOptions = {},
): Promise<OryCMSDiscoveryLoadResult> {
  for (const id of _discoveredIds) {
    if (hasOryCMSPlugin(id)) unregisterOryCMSPlugin(id);
  }
  _discoveredIds.clear();

  return loadDiscoveredOryCMSPlugins({ ...options, bypassCache: options.bypassCache ?? true });
}

/** Reset discovery state. Intended for use in tests. */
export function clearDiscoveredOryCMSPluginsForTests(): void {
  _discoveredIds.clear();
}
