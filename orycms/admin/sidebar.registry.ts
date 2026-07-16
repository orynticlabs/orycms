// ── Sidebar item type ─────────────────────────────────────────────────────────
//
// Defined here (not imported from @/plugins) to keep admin ↔ plugins decoupled.
// Structurally compatible with OryCMSPluginSidebarItem.

export interface OryCMSSidebarItem {
  id: string;
  label: string;
  href?: string;
  icon?: string;
  group?: string;
  order?: number;
  permission?: string;
  [key: string]: unknown;
}

// ── Internal state ────────────────────────────────────────────────────────────

/** pluginId → items registered by that plugin */
const _registry = new Map<string, OryCMSSidebarItem[]>();
/** All registered item IDs — used for duplicate detection */
const _ids = new Set<string>();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Register sidebar items for a plugin.
 * Throws if any item id is already registered by another plugin.
 * All items are validated atomically before any are committed.
 */
export function registerOryCMSSidebarItems(pluginId: string, items: OryCMSSidebarItem[]): void {
  const batch = new Set<string>();
  for (const item of items) {
    if (_ids.has(item.id) || batch.has(item.id)) {
      throw new Error(`OryCMS sidebar item "${item.id}" is already registered.`);
    }
    batch.add(item.id);
  }
  for (const item of items) _ids.add(item.id);
  _registry.set(pluginId, [...items]);
}

/**
 * Remove all sidebar items contributed by a plugin.
 * No-op if the plugin has no registered items.
 */
export function unregisterOryCMSSidebarItems(pluginId: string): void {
  const items = _registry.get(pluginId);
  if (!items) return;
  for (const item of items) _ids.delete(item.id);
  _registry.delete(pluginId);
}

/**
 * Return all registered sidebar items, sorted by `order` ascending
 * (items without `order` come last).
 *
 * @param userPermissions  When provided, items whose `permission` field is not
 *   included in this list are excluded. When omitted, no permission filtering
 *   is applied.
 */
export function getOryCMSSidebarItems(userPermissions?: string[]): OryCMSSidebarItem[] {
  const all: OryCMSSidebarItem[] = [];
  for (const items of _registry.values()) {
    for (const item of items) {
      if (
        item.permission &&
        userPermissions !== undefined &&
        !userPermissions.includes(item.permission)
      ) {
        continue;
      }
      all.push(item);
    }
  }
  return all.sort((a, b) => {
    if (a.order === undefined && b.order === undefined) return 0;
    if (a.order === undefined) return 1;
    if (b.order === undefined) return -1;
    return a.order - b.order;
  });
}

/** Remove all registered sidebar items. Intended for use in tests. */
export function clearOryCMSSidebarRegistry(): void {
  _registry.clear();
  _ids.clear();
}
