import { registerOryCMSPluginHook, unregisterOryCMSHookById } from "@/hooks";
import type { OryCMSHookEventName, OryCMSHookFn } from "@/hooks";

import { registerOryCMSPages, unregisterOryCMSPages } from "@/admin/page.registry";
import { registerOryCMSSidebarItems, unregisterOryCMSSidebarItems } from "@/admin/sidebar.registry";

import {
  registerOryCMSPluginExtensions,
  unregisterOryCMSPluginExtensions,
} from "./plugin.extensions";
import { registerOryCMSPluginRoutes, unregisterOryCMSPluginRoutes } from "./plugin.routes";

import { OryCMSPluginError, validateOryCMSPlugin } from "./plugin.engine";
import type { OryCMSPlugin } from "./plugin.types";

const pluginRegistry = new Map<string, OryCMSPlugin>();

// Tracks hook IDs registered per plugin so they can be removed on unload.
const _pluginHookIds = new Map<string, string[]>();

export function registerOryCMSPlugin(plugin: OryCMSPlugin): OryCMSPlugin {
  validateOryCMSPlugin(plugin);

  if (pluginRegistry.has(plugin.id)) {
    throw new OryCMSPluginError(
      "DUPLICATE_PLUGIN",
      `OryCMS plugin "${plugin.id}" is already registered.`,
    );
  }

  pluginRegistry.set(plugin.id, plugin);

  if (plugin.hooks) {
    const ids: string[] = [];
    for (const event of Object.keys(plugin.hooks) as OryCMSHookEventName[]) {
      const fnOrFns = plugin.hooks[event] as OryCMSHookFn | OryCMSHookFn[] | undefined;
      if (!fnOrFns) continue;
      const fns = Array.isArray(fnOrFns) ? fnOrFns : [fnOrFns];
      for (const fn of fns) {
        ids.push(registerOryCMSPluginHook(plugin.id, event, fn));
      }
    }
    if (ids.length) _pluginHookIds.set(plugin.id, ids);
  }

  if (plugin.sidebar?.length) {
    registerOryCMSSidebarItems(plugin.id, plugin.sidebar);
  }

  if (plugin.pages?.length) {
    registerOryCMSPages(plugin.id, plugin.pages);
  }

  if (plugin.routes?.length) {
    registerOryCMSPluginRoutes(plugin.id, plugin.routes);
  }

  if (plugin.extensions) {
    registerOryCMSPluginExtensions(plugin.id, plugin.extensions);
  }

  return plugin;
}

export function unregisterOryCMSPlugin(id: string): boolean {
  assertPluginId(id);
  _removePluginHooks(id);
  unregisterOryCMSSidebarItems(id);
  unregisterOryCMSPages(id);
  unregisterOryCMSPluginRoutes(id);
  unregisterOryCMSPluginExtensions(id);
  return pluginRegistry.delete(id);
}

export function getOryCMSPlugin(id: string): OryCMSPlugin | undefined {
  assertPluginId(id);
  return pluginRegistry.get(id);
}

export function listOryCMSPlugins(): OryCMSPlugin[] {
  return Array.from(pluginRegistry.values());
}

export function hasOryCMSPlugin(id: string): boolean {
  assertPluginId(id);
  return pluginRegistry.has(id);
}

export function clearOryCMSPluginRegistry(): void {
  for (const ids of _pluginHookIds.values()) {
    for (const id of ids) unregisterOryCMSHookById(id);
  }
  _pluginHookIds.clear();
  for (const id of pluginRegistry.keys()) {
    unregisterOryCMSSidebarItems(id);
    unregisterOryCMSPages(id);
    unregisterOryCMSPluginRoutes(id);
    unregisterOryCMSPluginExtensions(id);
  }
  pluginRegistry.clear();
}

function _removePluginHooks(pluginId: string): void {
  const ids = _pluginHookIds.get(pluginId);
  if (!ids) return;
  for (const id of ids) unregisterOryCMSHookById(id);
  _pluginHookIds.delete(pluginId);
}

function assertPluginId(id: string): void {
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new OryCMSPluginError("INVALID_PLUGIN", "plugin id must be a non-empty string.");
  }
}
