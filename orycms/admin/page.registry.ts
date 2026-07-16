// ── Page type ─────────────────────────────────────────────────────────────────
//
// Defined here (not imported from @/plugins) to keep admin ↔ plugins decoupled.
// Structurally compatible with OryCMSPluginPage.

export interface OryCMSAdminPage {
  id: string;
  title: string;
  path: string;
  component?: unknown;
  layout?: string;
  order?: number;
  permission?: string;
  [key: string]: unknown;
}

// ── Internal state ────────────────────────────────────────────────────────────

/** pluginId → pages registered by that plugin */
const _registry = new Map<string, OryCMSAdminPage[]>();
/** All registered page IDs — for id-duplicate detection */
const _ids = new Set<string>();
/** All registered paths — for path-duplicate detection */
const _paths = new Set<string>();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Register admin pages for a plugin.
 * Throws if any page id or path is already registered.
 * All pages are validated atomically before any are committed.
 */
export function registerOryCMSPages(pluginId: string, pages: OryCMSAdminPage[]): void {
  const batchIds = new Set<string>();
  const batchPaths = new Set<string>();
  for (const page of pages) {
    if (_ids.has(page.id) || batchIds.has(page.id)) {
      throw new Error(`OryCMS admin page id "${page.id}" is already registered.`);
    }
    if (_paths.has(page.path) || batchPaths.has(page.path)) {
      throw new Error(`OryCMS admin page path "${page.path}" is already registered.`);
    }
    batchIds.add(page.id);
    batchPaths.add(page.path);
  }
  for (const page of pages) {
    _ids.add(page.id);
    _paths.add(page.path);
  }
  _registry.set(pluginId, [...pages]);
}

/**
 * Remove all pages contributed by a plugin.
 * No-op if the plugin has no registered pages.
 */
export function unregisterOryCMSPages(pluginId: string): void {
  const pages = _registry.get(pluginId);
  if (!pages) return;
  for (const page of pages) {
    _ids.delete(page.id);
    _paths.delete(page.path);
  }
  _registry.delete(pluginId);
}

/**
 * Return all registered admin pages, sorted by `order` ascending
 * (pages without `order` come last).
 *
 * @param userPermissions  When provided, pages whose `permission` field is not
 *   included in this list are excluded. When omitted, no permission filtering
 *   is applied.
 */
export function getOryCMSPages(userPermissions?: string[]): OryCMSAdminPage[] {
  const all: OryCMSAdminPage[] = [];
  for (const pages of _registry.values()) {
    for (const page of pages) {
      if (
        page.permission &&
        userPermissions !== undefined &&
        !userPermissions.includes(page.permission)
      ) {
        continue;
      }
      all.push(page);
    }
  }
  return all.sort((a, b) => {
    if (a.order === undefined && b.order === undefined) return 0;
    if (a.order === undefined) return 1;
    if (b.order === undefined) return -1;
    return a.order - b.order;
  });
}

/** Remove all registered pages. Intended for use in tests. */
export function clearOryCMSPageRegistry(): void {
  _registry.clear();
  _ids.clear();
  _paths.clear();
}
