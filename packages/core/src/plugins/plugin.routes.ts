import type { OryCMSPluginRoute } from "./plugin.types";

// ── Internal state ────────────────────────────────────────────────────────────

/** pluginId → routes registered by that plugin */
const _registry = new Map<string, OryCMSPluginRoute[]>();
/**
 * Registered route keys in "METHOD:path" form (one entry per method×path pair).
 * Used for duplicate detection; undefined method defaults to "GET".
 */
const _keys = new Set<string>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function routeKeys(route: OryCMSPluginRoute): string[] {
  const raw = route.method;
  const methods: string[] = raw
    ? (Array.isArray(raw) ? raw : [raw]).map((m) => m.toUpperCase())
    : ["GET"];
  return methods.map((m) => `${m}:${route.path}`);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Register plugin routes.
 * Throws if any method+path combination is already registered.
 * All routes are validated atomically before any are committed.
 */
export function registerOryCMSPluginRoutes(pluginId: string, routes: OryCMSPluginRoute[]): void {
  const batch = new Set<string>();
  for (const route of routes) {
    for (const key of routeKeys(route)) {
      if (_keys.has(key) || batch.has(key)) {
        throw new Error(`OryCMS plugin route "${key}" is already registered.`);
      }
      batch.add(key);
    }
  }
  for (const route of routes) {
    for (const key of routeKeys(route)) _keys.add(key);
  }
  _registry.set(pluginId, [...routes]);
}

/**
 * Remove all routes contributed by a plugin.
 * No-op if the plugin has no registered routes.
 */
export function unregisterOryCMSPluginRoutes(pluginId: string): void {
  const routes = _registry.get(pluginId);
  if (!routes) return;
  for (const route of routes) {
    for (const key of routeKeys(route)) _keys.delete(key);
  }
  _registry.delete(pluginId);
}

/**
 * Return all registered plugin routes in plugin-registration order.
 * Handlers are stored but never executed by this registry.
 */
export function getOryCMSPluginRoutes(): OryCMSPluginRoute[] {
  const all: OryCMSPluginRoute[] = [];
  for (const routes of _registry.values()) {
    for (const route of routes) all.push(route);
  }
  return all;
}

/** Remove all registered routes. Intended for use in tests. */
export function clearOryCMSPluginRoutes(): void {
  _registry.clear();
  _keys.clear();
}
