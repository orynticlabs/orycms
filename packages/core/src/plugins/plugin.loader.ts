import { loadOryCMSConfig } from "@/config";
import type { OryCMSLoadConfigOptions, OryCMSPluginConfigEntry } from "@/config";

import { OryCMSPluginError, validateOryCMSPlugin } from "./plugin.engine";
import {
  getOryCMSPlugin,
  hasOryCMSPlugin,
  registerOryCMSPlugin,
  unregisterOryCMSPlugin,
} from "./plugin.registry";
import type { OryCMSPlugin } from "./plugin.types";

export type OryCMSPluginLoadStatus = "loaded" | "skipped" | "failed" | "unloaded";

export type OryCMSPluginLoadOptions = {
  config?: OryCMSLoadConfigOptions;
};

export type OryCMSPluginLoadResultItem = {
  id: string;
  plugin?: OryCMSPlugin;
  status: OryCMSPluginLoadStatus;
  reason?: string;
  error?: OryCMSPluginError;
};

export type OryCMSPluginLoadResult = {
  loaded: OryCMSPluginLoadResultItem[];
  skipped: OryCMSPluginLoadResultItem[];
  failed: OryCMSPluginLoadResultItem[];
};

type LoadedPluginState = {
  enabled: boolean;
  plugin: OryCMSPlugin;
};

const loadedPlugins = new Map<string, LoadedPluginState>();

export async function loadOryCMSPlugins(
  options: OryCMSPluginLoadOptions = {},
): Promise<OryCMSPluginLoadResult> {
  const config = await loadOryCMSConfig(options.config);
  const entries = config.plugins.entries ?? [];
  const result = createEmptyLoadResult();

  if (config.plugins.enabled === false) {
    for (const entry of entries) {
      result.skipped.push({
        id: getPluginEntryId(entry),
        status: "skipped",
        reason: "Plugin loading is disabled in OryCMS configuration.",
      });
    }

    return result;
  }

  for (const entry of entries) {
    const item = loadPluginEntry(entry);
    result[
      item.status === "loaded" ? "loaded" : item.status === "failed" ? "failed" : "skipped"
    ].push(item);
  }

  return result;
}

export async function loadOryCMSPlugin(
  id: string,
  options: OryCMSPluginLoadOptions = {},
): Promise<OryCMSPluginLoadResultItem> {
  assertPluginId(id);

  const config = await loadOryCMSConfig(options.config);
  const entry = (config.plugins.entries ?? []).find(
    (candidate) => getPluginEntryId(candidate) === id,
  );

  if (!entry) {
    return {
      id,
      status: "failed",
      error: new OryCMSPluginError(
        "PLUGIN_NOT_FOUND",
        `OryCMS plugin "${id}" was not found in configuration.`,
      ),
    };
  }

  if (config.plugins.enabled === false) {
    return {
      id,
      status: "skipped",
      reason: "Plugin loading is disabled in OryCMS configuration.",
    };
  }

  return loadPluginEntry(entry);
}

export async function reloadOryCMSPlugins(
  options: OryCMSPluginLoadOptions = {},
): Promise<OryCMSPluginLoadResult> {
  for (const id of Array.from(loadedPlugins.keys())) {
    unloadOryCMSPlugin(id);
  }

  return loadOryCMSPlugins({
    config: {
      ...options.config,
      bypassCache: options.config?.bypassCache ?? true,
    },
  });
}

export function unloadOryCMSPlugin(id: string): OryCMSPluginLoadResultItem {
  assertPluginId(id);

  const loaded = loadedPlugins.get(id);

  if (!loaded) {
    return {
      id,
      status: "skipped",
      reason: `OryCMS plugin "${id}" is not loaded.`,
    };
  }

  if (loaded.enabled && getOryCMSPlugin(id)) {
    unregisterOryCMSPlugin(id);
  }

  loadedPlugins.delete(id);

  return {
    id,
    plugin: loaded.plugin,
    status: "unloaded",
  };
}

export function listLoadedOryCMSPlugins(): OryCMSPlugin[] {
  return Array.from(loadedPlugins.values())
    .filter((entry) => entry.enabled)
    .map((entry) => entry.plugin);
}

export function clearLoadedOryCMSPluginsForTests(): void {
  loadedPlugins.clear();
}

function loadPluginEntry(entry: OryCMSPluginConfigEntry): OryCMSPluginLoadResultItem {
  const normalized = normalizePluginEntry(entry);
  const id = normalized.plugin?.id ?? "unknown";

  if (!normalized.plugin) {
    return {
      id,
      status: "failed",
      error: new OryCMSPluginError(
        "INVALID_PLUGIN",
        "Plugin config entry must include a plugin definition.",
      ),
    };
  }

  try {
    validateOryCMSPlugin(normalized.plugin);

    if (loadedPlugins.has(normalized.plugin.id)) {
      return {
        id: normalized.plugin.id,
        plugin: normalized.plugin,
        status: "skipped",
        reason: `OryCMS plugin "${normalized.plugin.id}" is already loaded.`,
      };
    }

    if (normalized.enabled === false) {
      loadedPlugins.set(normalized.plugin.id, {
        enabled: false,
        plugin: normalized.plugin,
      });

      return {
        id: normalized.plugin.id,
        plugin: normalized.plugin,
        status: "skipped",
        reason: `OryCMS plugin "${normalized.plugin.id}" is disabled in configuration.`,
      };
    }

    if (hasOryCMSPlugin(normalized.plugin.id)) {
      return {
        id: normalized.plugin.id,
        plugin: normalized.plugin,
        status: "skipped",
        reason: `OryCMS plugin "${normalized.plugin.id}" is already registered.`,
      };
    }

    registerOryCMSPlugin(normalized.plugin);
    loadedPlugins.set(normalized.plugin.id, {
      enabled: true,
      plugin: normalized.plugin,
    });

    return {
      id: normalized.plugin.id,
      plugin: normalized.plugin,
      status: "loaded",
    };
  } catch (error) {
    return {
      id,
      plugin: normalized.plugin,
      status: "failed",
      error: normalizePluginError(error),
    };
  }
}

function normalizePluginEntry(entry: OryCMSPluginConfigEntry): {
  enabled: boolean;
  plugin?: OryCMSPlugin;
} {
  if (isWrappedPluginEntry(entry)) {
    return {
      enabled: entry.enabled ?? true,
      plugin: entry.plugin,
    };
  }

  return {
    enabled: true,
    plugin: entry,
  };
}

function isWrappedPluginEntry(
  entry: OryCMSPluginConfigEntry,
): entry is Extract<OryCMSPluginConfigEntry, { plugin: OryCMSPlugin }> {
  return Boolean(entry && typeof entry === "object" && "plugin" in entry);
}

function getPluginEntryId(entry: OryCMSPluginConfigEntry): string {
  const normalized = normalizePluginEntry(entry);
  return normalized.plugin?.id ?? "unknown";
}

function createEmptyLoadResult(): OryCMSPluginLoadResult {
  return {
    loaded: [],
    skipped: [],
    failed: [],
  };
}

function normalizePluginError(error: unknown): OryCMSPluginError {
  if (error instanceof OryCMSPluginError) {
    return error;
  }

  return new OryCMSPluginError(
    "INVALID_PLUGIN",
    error instanceof Error ? error.message : "Invalid OryCMS plugin.",
  );
}

function assertPluginId(id: string): void {
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new OryCMSPluginError("INVALID_PLUGIN", "plugin id must be a non-empty string.");
  }
}
