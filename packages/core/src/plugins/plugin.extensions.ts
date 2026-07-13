// ── Extension item types ──────────────────────────────────────────────────────
//
// All extension items require a unique `id`. Extra fields are allowed via the
// index signature. No extension is ever executed by this registry.

export interface OryCMSCollectionExtension {
  id: string;
  [key: string]: unknown;
}
export interface OryCMSFieldTypeExtension {
  id: string;
  [key: string]: unknown;
}
export interface OryCMSDashboardWidgetExtension {
  id: string;
  [key: string]: unknown;
}
export interface OryCMSNavigationGroupExtension {
  id: string;
  [key: string]: unknown;
}
export interface OryCMSSettingsSectionExtension {
  id: string;
  [key: string]: unknown;
}
export interface OryCMSCommandExtension {
  id: string;
  [key: string]: unknown;
}
export interface OryCMSProviderExtension {
  id: string;
  [key: string]: unknown;
}
export interface OryCMSValidatorExtension {
  id: string;
  [key: string]: unknown;
}

// ── Convenience bundle type ───────────────────────────────────────────────────

export interface OryCMSPluginExtensions {
  collections?: OryCMSCollectionExtension[];
  fieldTypes?: OryCMSFieldTypeExtension[];
  dashboardWidgets?: OryCMSDashboardWidgetExtension[];
  navigationGroups?: OryCMSNavigationGroupExtension[];
  settingsSections?: OryCMSSettingsSectionExtension[];
  commands?: OryCMSCommandExtension[];
  providers?: OryCMSProviderExtension[];
  validators?: OryCMSValidatorExtension[];
}

// ── Registry factory ──────────────────────────────────────────────────────────
//
// Each call creates an independent in-memory registry with its own id-set and
// plugin→items map. Arrow functions capture state via closure; no `this` needed.

function makeExtensionRegistry<T extends { id: string; [key: string]: unknown }>(name: string) {
  const reg = new Map<string, T[]>();
  const ids = new Set<string>();

  const register = (pluginId: string, items: T[]): void => {
    const batch = new Set<string>();
    for (const item of items) {
      if (ids.has(item.id) || batch.has(item.id)) {
        throw new Error(`OryCMS ${name} "${item.id}" is already registered.`);
      }
      batch.add(item.id);
    }
    for (const item of items) ids.add(item.id);
    reg.set(pluginId, [...items]);
  };

  const unregister = (pluginId: string): void => {
    const items = reg.get(pluginId);
    if (!items) return;
    for (const item of items) ids.delete(item.id);
    reg.delete(pluginId);
  };

  const list = (): T[] => {
    const all: T[] = [];
    for (const items of reg.values()) for (const item of items) all.push(item);
    return all;
  };

  const clear = (): void => {
    reg.clear();
    ids.clear();
  };

  return { register, unregister, list, clear };
}

// ── Per-type registry instances ───────────────────────────────────────────────

const _collections = makeExtensionRegistry<OryCMSCollectionExtension>("collection");
const _fieldTypes = makeExtensionRegistry<OryCMSFieldTypeExtension>("field type");
const _dashboardWidgets = makeExtensionRegistry<OryCMSDashboardWidgetExtension>("dashboard widget");
const _navigationGroups = makeExtensionRegistry<OryCMSNavigationGroupExtension>("navigation group");
const _settingsSections = makeExtensionRegistry<OryCMSSettingsSectionExtension>("settings section");
const _commands = makeExtensionRegistry<OryCMSCommandExtension>("command");
const _providers = makeExtensionRegistry<OryCMSProviderExtension>("provider");
const _validators = makeExtensionRegistry<OryCMSValidatorExtension>("validator");

// ── Public per-type API ───────────────────────────────────────────────────────

export const registerOryCMSCollectionExtensions = _collections.register;
export const unregisterOryCMSCollectionExtensions = _collections.unregister;
export const listOryCMSCollectionExtensions = _collections.list;
export const clearOryCMSCollectionExtensions = _collections.clear;

export const registerOryCMSFieldTypes = _fieldTypes.register;
export const unregisterOryCMSFieldTypes = _fieldTypes.unregister;
export const listOryCMSFieldTypes = _fieldTypes.list;
export const clearOryCMSFieldTypes = _fieldTypes.clear;

export const registerOryCMSDashboardWidgets = _dashboardWidgets.register;
export const unregisterOryCMSDashboardWidgets = _dashboardWidgets.unregister;
export const listOryCMSDashboardWidgets = _dashboardWidgets.list;
export const clearOryCMSDashboardWidgets = _dashboardWidgets.clear;

export const registerOryCMSNavigationGroups = _navigationGroups.register;
export const unregisterOryCMSNavigationGroups = _navigationGroups.unregister;
export const listOryCMSNavigationGroups = _navigationGroups.list;
export const clearOryCMSNavigationGroups = _navigationGroups.clear;

export const registerOryCMSSettingsSections = _settingsSections.register;
export const unregisterOryCMSSettingsSections = _settingsSections.unregister;
export const listOryCMSSettingsSections = _settingsSections.list;
export const clearOryCMSSettingsSections = _settingsSections.clear;

export const registerOryCMSCommands = _commands.register;
export const unregisterOryCMSCommands = _commands.unregister;
export const listOryCMSCommands = _commands.list;
export const clearOryCMSCommands = _commands.clear;

export const registerOryCMSProviders = _providers.register;
export const unregisterOryCMSProviders = _providers.unregister;
export const listOryCMSProviders = _providers.list;
export const clearOryCMSProviders = _providers.clear;

export const registerOryCMSValidators = _validators.register;
export const unregisterOryCMSValidators = _validators.unregister;
export const listOryCMSValidators = _validators.list;
export const clearOryCMSValidators = _validators.clear;

// ── Lifecycle helpers (used by plugin.registry) ───────────────────────────────

/**
 * Register all extensions declared in a plugin's `extensions` block.
 * Skips any extension type that has no entries.
 */
export function registerOryCMSPluginExtensions(
  pluginId: string,
  extensions: OryCMSPluginExtensions,
): void {
  if (extensions.collections?.length) _collections.register(pluginId, extensions.collections);
  if (extensions.fieldTypes?.length) _fieldTypes.register(pluginId, extensions.fieldTypes);
  if (extensions.dashboardWidgets?.length)
    _dashboardWidgets.register(pluginId, extensions.dashboardWidgets);
  if (extensions.navigationGroups?.length)
    _navigationGroups.register(pluginId, extensions.navigationGroups);
  if (extensions.settingsSections?.length)
    _settingsSections.register(pluginId, extensions.settingsSections);
  if (extensions.commands?.length) _commands.register(pluginId, extensions.commands);
  if (extensions.providers?.length) _providers.register(pluginId, extensions.providers);
  if (extensions.validators?.length) _validators.register(pluginId, extensions.validators);
}

/**
 * Remove all extensions contributed by a plugin across every extension type.
 * No-op for types the plugin never registered.
 */
export function unregisterOryCMSPluginExtensions(pluginId: string): void {
  _collections.unregister(pluginId);
  _fieldTypes.unregister(pluginId);
  _dashboardWidgets.unregister(pluginId);
  _navigationGroups.unregister(pluginId);
  _settingsSections.unregister(pluginId);
  _commands.unregister(pluginId);
  _providers.unregister(pluginId);
  _validators.unregister(pluginId);
}

/** Clear all extension registries. Intended for use in tests. */
export function clearAllOryCMSExtensions(): void {
  _collections.clear();
  _fieldTypes.clear();
  _dashboardWidgets.clear();
  _navigationGroups.clear();
  _settingsSections.clear();
  _commands.clear();
  _providers.clear();
  _validators.clear();
}
