import { validateOryCMSPluginCompatibility } from "./plugin.compatibility";
import type { OryCMSCompatibilityOptions } from "./plugin.compatibility";
import { validateOryCMSPluginDependencies } from "./plugin.dependencies";
import { OryCMSPluginError, validateOryCMSPlugin } from "./plugin.engine";
import { readOryCMSPluginManifest } from "./plugin.manifest";
import type { OryCMSPluginManifest } from "./plugin.manifest";
import { hasOryCMSPlugin, listOryCMSPlugins } from "./plugin.registry";
import { registerOryCMSPlugin, unregisterOryCMSPlugin } from "./plugin.registry";
import type { OryCMSPlugin } from "./plugin.types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type OryCMSInstallStatus =
  "installed" | "uninstalled" | "updated" | "enabled" | "disabled" | "failed";

export type OryCMSInstalledPluginEntry = {
  plugin: OryCMSPlugin;
  enabled: boolean;
  installedAt: string;
};

export type OryCMSInstallResult = {
  status: OryCMSInstallStatus;
  plugin?: OryCMSPlugin;
  reason?: string;
  validationErrors?: string[];
};

export type OryCMSInstallOptions = {
  /** When true, skip OryCMS version compatibility check. */
  skipCompatibilityCheck?: boolean;
  /** When true, skip dependency validation against other installed plugins. */
  skipDependencyCheck?: boolean;
  /** OryCMS version override for compatibility check. */
  oryCMSVersion?: string;
  /**
   * Optional manifest providing compatibility ranges and dependency constraints.
   * Compatibility and dependency fields live on OryCMSPluginManifest, not on
   * OryCMSPlugin, so pass a manifest here to enable those checks.
   */
  manifest?: OryCMSPluginManifest;
  /**
   * Directory containing an orycms-plugin.json manifest file.
   * When provided (and no `manifest` is explicitly set), the manifest is read
   * from this directory and used for compatibility/dependency validation.
   */
  dir?: string;
};

// ── Internal registry ─────────────────────────────────────────────────────────

const _installed = new Map<string, OryCMSInstalledPluginEntry>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function isoNow(): string {
  return new Date().toISOString();
}

function resolveManifest(options: OryCMSInstallOptions): OryCMSPluginManifest | undefined {
  if (options.manifest) return options.manifest;
  if (options.dir) {
    try {
      return readOryCMSPluginManifest(options.dir);
    } catch {
      return undefined; // manifest read failure is surfaced as a validation error below
    }
  }
  return undefined;
}

function collectValidationErrors(plugin: OryCMSPlugin, options: OryCMSInstallOptions): string[] {
  const errors: string[] = [];

  // 0. Read manifest from dir if not explicitly provided
  if (options.dir && !options.manifest) {
    try {
      readOryCMSPluginManifest(options.dir); // validates JSON + schema; throws on failure
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Invalid orycms-plugin.json.");
      return errors;
    }
  }

  // 1. Plugin manifest shape
  try {
    validateOryCMSPlugin(plugin);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Invalid plugin manifest.");
    // Can't continue without a valid manifest
    return errors;
  }

  const manifest = resolveManifest(options);

  // 2. Compatibility — requires a manifest (which carries the orycms range)
  if (manifest && !options.skipCompatibilityCheck) {
    const compatOpts: OryCMSCompatibilityOptions = {
      allowUndeclared: true, // installer does not force a declaration
      ...(options.oryCMSVersion ? { oryCMSVersion: options.oryCMSVersion } : {}),
    };
    for (const e of validateOryCMSPluginCompatibility(manifest, compatOpts)) {
      errors.push(e.message);
    }
  }

  // 3. Dependencies — build minimal manifests from installed plugins (they have `version`)
  if (manifest && !options.skipDependencyCheck) {
    const installedManifests: OryCMSPluginManifest[] = listOryCMSPlugins().map((p) => ({
      id: p.id,
      name: p.name,
      version: p.version,
    }));
    const all = [...installedManifests, manifest];
    for (const e of validateOryCMSPluginDependencies(all)) {
      if (e.plugin === plugin.id || e.dependency === plugin.id) {
        errors.push(e.message);
      }
    }
  }

  return errors;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Install a plugin: validate manifest, compatibility, and dependencies; register
 * it via the existing plugin registry; and record it as installed + enabled.
 * Hooks, routes, pages, and other surfaces are registered by the registry but
 * never executed by the installer.
 */
export function installOryCMSPlugin(
  plugin: OryCMSPlugin,
  options: OryCMSInstallOptions = {},
): OryCMSInstallResult {
  if (_installed.has(plugin.id)) {
    return {
      status: "failed",
      plugin,
      reason: `Plugin "${plugin.id}" is already installed.`,
    };
  }

  const errors = collectValidationErrors(plugin, options);
  if (errors.length > 0) {
    return {
      status: "failed",
      plugin,
      reason: errors[0],
      validationErrors: errors,
    };
  }

  if (hasOryCMSPlugin(plugin.id)) {
    // Already in registry (e.g. loaded by the loader) — track without re-registering
    _installed.set(plugin.id, { plugin, enabled: true, installedAt: isoNow() });
    return { status: "installed", plugin };
  }

  try {
    registerOryCMSPlugin(plugin);
  } catch (err) {
    return {
      status: "failed",
      plugin,
      reason: err instanceof Error ? err.message : "Registration failed.",
    };
  }

  _installed.set(plugin.id, { plugin, enabled: true, installedAt: isoNow() });
  return { status: "installed", plugin };
}

/**
 * Uninstall a plugin: unregister it from the plugin registry and remove it from
 * the installer's tracking map.
 */
export function uninstallOryCMSPlugin(id: string): OryCMSInstallResult {
  const entry = _installed.get(id);
  if (!entry) {
    return {
      status: "failed",
      reason: `Plugin "${id}" is not installed.`,
    };
  }

  if (hasOryCMSPlugin(id)) {
    try {
      unregisterOryCMSPlugin(id);
    } catch (err) {
      return {
        status: "failed",
        plugin: entry.plugin,
        reason: err instanceof Error ? err.message : "Unregistration failed.",
      };
    }
  }

  _installed.delete(id);
  return { status: "uninstalled", plugin: entry.plugin };
}

/**
 * Enable an installed plugin: re-register it in the plugin registry if it was
 * previously disabled (and therefore unregistered).
 */
export function enableOryCMSPlugin(id: string): OryCMSInstallResult {
  const entry = _installed.get(id);
  if (!entry) {
    return { status: "failed", reason: `Plugin "${id}" is not installed.` };
  }

  if (entry.enabled) {
    return { status: "failed", plugin: entry.plugin, reason: `Plugin "${id}" is already enabled.` };
  }

  if (!hasOryCMSPlugin(id)) {
    try {
      registerOryCMSPlugin(entry.plugin);
    } catch (err) {
      return {
        status: "failed",
        plugin: entry.plugin,
        reason: err instanceof Error ? err.message : "Re-registration failed.",
      };
    }
  }

  _installed.set(id, { ...entry, enabled: true });
  return { status: "enabled", plugin: entry.plugin };
}

/**
 * Disable an installed plugin: unregister it from the plugin registry so its
 * hooks, routes, and other surfaces are no longer active, but keep its record
 * in the installer so it can be re-enabled later.
 */
export function disableOryCMSPlugin(id: string): OryCMSInstallResult {
  const entry = _installed.get(id);
  if (!entry) {
    return { status: "failed", reason: `Plugin "${id}" is not installed.` };
  }

  if (!entry.enabled) {
    return {
      status: "failed",
      plugin: entry.plugin,
      reason: `Plugin "${id}" is already disabled.`,
    };
  }

  if (hasOryCMSPlugin(id)) {
    try {
      unregisterOryCMSPlugin(id);
    } catch (err) {
      return {
        status: "failed",
        plugin: entry.plugin,
        reason: err instanceof Error ? err.message : "Unregistration failed.",
      };
    }
  }

  _installed.set(id, { ...entry, enabled: false });
  return { status: "disabled", plugin: entry.plugin };
}

/**
 * List all installed plugins with their current enabled/disabled state.
 */
export function listInstalledOryCMSPlugins(): OryCMSInstalledPluginEntry[] {
  return Array.from(_installed.values());
}

/**
 * Atomically update an installed plugin: unregister and remove the old version,
 * then validate and register the new version. If installation of the new version
 * fails the old version is NOT restored (caller is responsible for rollback if
 * needed). No plugin code is executed during this operation.
 */
export function updateOryCMSPlugin(
  id: string,
  newPlugin: OryCMSPlugin,
  options: OryCMSInstallOptions = {},
): OryCMSInstallResult {
  const existing = _installed.get(id);
  if (!existing) {
    return { status: "failed", reason: `Plugin "${id}" is not installed.` };
  }

  // Unregister the old version from all subsystems
  if (hasOryCMSPlugin(id)) {
    try {
      unregisterOryCMSPlugin(id);
    } catch (err) {
      return {
        status: "failed",
        plugin: existing.plugin,
        reason: err instanceof Error ? err.message : "Unregistration of old version failed.",
      };
    }
  }
  _installed.delete(id);

  // Validate and register the new version
  const errors = collectValidationErrors(newPlugin, options);
  if (errors.length > 0) {
    return {
      status: "failed",
      plugin: newPlugin,
      reason: errors[0],
      validationErrors: errors,
    };
  }

  try {
    registerOryCMSPlugin(newPlugin);
  } catch (err) {
    return {
      status: "failed",
      plugin: newPlugin,
      reason: err instanceof Error ? err.message : "Registration of new version failed.",
    };
  }

  _installed.set(newPlugin.id, { plugin: newPlugin, enabled: true, installedAt: isoNow() });
  return { status: "updated", plugin: newPlugin };
}

/**
 * Reset all installer state. Intended for use in tests only.
 * Does NOT touch the plugin registry — call clearOryCMSPluginRegistry() separately.
 */
export function clearOryCMSInstallerForTests(): void {
  _installed.clear();
}

// Re-export error class so callers need one import for error handling.
export { OryCMSPluginError };
