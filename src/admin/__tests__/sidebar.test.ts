import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearOryCMSSidebarRegistry,
  getOryCMSSidebarItems,
  registerOryCMSSidebarItems,
  unregisterOryCMSSidebarItems,
} from "../sidebar.registry";
import type { OryCMSSidebarItem } from "../sidebar.registry";

import { clearOryCMSPluginRegistry, registerOryCMSPlugin, unregisterOryCMSPlugin } from "@/plugins";
import type { OryCMSPlugin } from "@/plugins";

// ── Helpers ───────────────────────────────────────────────────────────────────

function item(
  overrides: Partial<OryCMSSidebarItem> & { id: string; label: string },
): OryCMSSidebarItem {
  return { ...overrides };
}

function plugin(
  id: string,
  sidebar: OryCMSSidebarItem[] = [],
  extra: Partial<OryCMSPlugin> = {},
): OryCMSPlugin {
  return { id, name: `Plugin ${id}`, version: "1.0.0", sidebar, ...extra };
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  clearOryCMSSidebarRegistry();
  clearOryCMSPluginRegistry();
});

afterEach(() => {
  clearOryCMSSidebarRegistry();
  clearOryCMSPluginRegistry();
});

// ── Registration ──────────────────────────────────────────────────────────────

describe("Registration", () => {
  it("registered items appear in getOryCMSSidebarItems()", () => {
    registerOryCMSSidebarItems("p", [item({ id: "nav-home", label: "Home" })]);
    const items = getOryCMSSidebarItems();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("nav-home");
  });

  it("multiple plugins can each register items", () => {
    registerOryCMSSidebarItems("a", [item({ id: "a-item", label: "A" })]);
    registerOryCMSSidebarItems("b", [item({ id: "b-item", label: "B" })]);
    expect(getOryCMSSidebarItems()).toHaveLength(2);
  });

  it("items are stored with all provided fields", () => {
    registerOryCMSSidebarItems("p", [
      item({
        id: "nav-seo",
        label: "SEO",
        href: "/seo",
        icon: "search",
        group: "Tools",
        order: 5,
        permission: "seo.view",
      }),
    ]);
    const [result] = getOryCMSSidebarItems();
    expect(result).toMatchObject({
      id: "nav-seo",
      label: "SEO",
      href: "/seo",
      icon: "search",
      group: "Tools",
      order: 5,
      permission: "seo.view",
    });
  });

  it("items without optional fields register without error", () => {
    expect(() =>
      registerOryCMSSidebarItems("p", [item({ id: "minimal", label: "Minimal" })]),
    ).not.toThrow();
    expect(getOryCMSSidebarItems()).toHaveLength(1);
  });

  it("empty items array is a no-op", () => {
    registerOryCMSSidebarItems("p", []);
    expect(getOryCMSSidebarItems()).toHaveLength(0);
  });

  it("registering zero items does not block later registration for same plugin", () => {
    registerOryCMSSidebarItems("p", []);
    registerOryCMSSidebarItems("p", [item({ id: "x", label: "X" })]);
    expect(getOryCMSSidebarItems()).toHaveLength(1);
  });
});

// ── Unregister ────────────────────────────────────────────────────────────────

describe("Unregister", () => {
  it("unregistering removes all of a plugin's items", () => {
    registerOryCMSSidebarItems("p", [item({ id: "a", label: "A" }), item({ id: "b", label: "B" })]);
    unregisterOryCMSSidebarItems("p");
    expect(getOryCMSSidebarItems()).toHaveLength(0);
  });

  it("unregistering one plugin leaves other plugins' items intact", () => {
    registerOryCMSSidebarItems("a", [item({ id: "a-item", label: "A" })]);
    registerOryCMSSidebarItems("b", [item({ id: "b-item", label: "B" })]);
    unregisterOryCMSSidebarItems("a");
    const items = getOryCMSSidebarItems();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("b-item");
  });

  it("unregistering a plugin that has no items is a no-op", () => {
    expect(() => unregisterOryCMSSidebarItems("ghost")).not.toThrow();
    expect(getOryCMSSidebarItems()).toHaveLength(0);
  });

  it("unregistered item ids can be re-used after unregister", () => {
    registerOryCMSSidebarItems("p", [item({ id: "nav-home", label: "Home" })]);
    unregisterOryCMSSidebarItems("p");
    expect(() =>
      registerOryCMSSidebarItems("p", [item({ id: "nav-home", label: "Home v2" })]),
    ).not.toThrow();
    expect(getOryCMSSidebarItems()[0].label).toBe("Home v2");
  });

  it("clearOryCMSSidebarRegistry removes all items", () => {
    registerOryCMSSidebarItems("a", [item({ id: "a-item", label: "A" })]);
    registerOryCMSSidebarItems("b", [item({ id: "b-item", label: "B" })]);
    clearOryCMSSidebarRegistry();
    expect(getOryCMSSidebarItems()).toHaveLength(0);
  });
});

// ── Ordering ──────────────────────────────────────────────────────────────────

describe("Ordering", () => {
  it("items are returned sorted by order ascending", () => {
    registerOryCMSSidebarItems("p", [
      item({ id: "c", label: "C", order: 30 }),
      item({ id: "a", label: "A", order: 10 }),
      item({ id: "b", label: "B", order: 20 }),
    ]);
    const ids = getOryCMSSidebarItems().map((i) => i.id);
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("items without order come after items with order", () => {
    registerOryCMSSidebarItems("p", [
      item({ id: "no-order", label: "No Order" }),
      item({ id: "ordered", label: "Ordered", order: 1 }),
    ]);
    const ids = getOryCMSSidebarItems().map((i) => i.id);
    expect(ids[0]).toBe("ordered");
    expect(ids[1]).toBe("no-order");
  });

  it("items from different plugins are merged and sorted by order", () => {
    registerOryCMSSidebarItems("b", [item({ id: "b-item", label: "B", order: 20 })]);
    registerOryCMSSidebarItems("a", [item({ id: "a-item", label: "A", order: 10 })]);
    const ids = getOryCMSSidebarItems().map((i) => i.id);
    expect(ids).toEqual(["a-item", "b-item"]);
  });

  it("items without order maintain stable insertion order relative to each other", () => {
    registerOryCMSSidebarItems("a", [item({ id: "first", label: "First" })]);
    registerOryCMSSidebarItems("b", [item({ id: "second", label: "Second" })]);
    const ids = getOryCMSSidebarItems().map((i) => i.id);
    expect(ids).toEqual(["first", "second"]);
  });
});

// ── Duplicate protection ──────────────────────────────────────────────────────

describe("Duplicate protection", () => {
  it("throws when the same item id is registered twice by the same plugin", () => {
    registerOryCMSSidebarItems("p", [item({ id: "dup", label: "First" })]);
    expect(() => registerOryCMSSidebarItems("p", [item({ id: "dup", label: "Second" })])).toThrow(
      'OryCMS sidebar item "dup" is already registered.',
    );
  });

  it("throws when the same item id is registered by two different plugins", () => {
    registerOryCMSSidebarItems("a", [item({ id: "shared-id", label: "A" })]);
    expect(() => registerOryCMSSidebarItems("b", [item({ id: "shared-id", label: "B" })])).toThrow(
      '"shared-id"',
    );
  });

  it("a single registration with duplicate ids within the same batch throws atomically", () => {
    expect(() =>
      registerOryCMSSidebarItems("p", [
        item({ id: "x", label: "X1" }),
        item({ id: "x", label: "X2" }),
      ]),
    ).toThrow('"x"');
    // Nothing should be registered since the batch failed
    expect(getOryCMSSidebarItems()).toHaveLength(0);
  });

  it("after a failed registration attempt the item id is still free", () => {
    // prime _ids with "x"
    registerOryCMSSidebarItems("p", [item({ id: "x", label: "X" })]);
    // try again → throws
    expect(() => registerOryCMSSidebarItems("q", [item({ id: "x", label: "X again" })])).toThrow();
    // unregister the original and verify the slot is free
    unregisterOryCMSSidebarItems("p");
    expect(() =>
      registerOryCMSSidebarItems("q", [item({ id: "x", label: "X reclaimed" })]),
    ).not.toThrow();
  });
});

// ── Permission filtering ──────────────────────────────────────────────────────

describe("Permission filtering", () => {
  beforeEach(() => {
    registerOryCMSSidebarItems("p", [
      item({ id: "public", label: "Public" }),
      item({ id: "admin-only", label: "Admin Only", permission: "admin" }),
      item({ id: "editor-only", label: "Editor Only", permission: "editor" }),
    ]);
  });

  it("returns all items when userPermissions is undefined", () => {
    expect(getOryCMSSidebarItems(undefined)).toHaveLength(3);
  });

  it("includes items whose permission the user holds", () => {
    const items = getOryCMSSidebarItems(["admin"]);
    const ids = items.map((i) => i.id);
    expect(ids).toContain("public");
    expect(ids).toContain("admin-only");
  });

  it("excludes items whose permission the user does not hold", () => {
    const items = getOryCMSSidebarItems(["editor"]);
    const ids = items.map((i) => i.id);
    expect(ids).not.toContain("admin-only");
    expect(ids).toContain("editor-only");
    expect(ids).toContain("public");
  });

  it("returns only items with no permission requirement when user has empty permissions", () => {
    const items = getOryCMSSidebarItems([]);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("public");
  });

  it("returns items matching any held permission", () => {
    const items = getOryCMSSidebarItems(["admin", "editor"]);
    expect(items).toHaveLength(3);
  });
});

// ── Plugin registry integration ───────────────────────────────────────────────

describe("Plugin registry integration", () => {
  it("registerOryCMSPlugin automatically registers its sidebar items", () => {
    registerOryCMSPlugin(plugin("seo", [item({ id: "nav-seo", label: "SEO", href: "/seo" })]));
    const items = getOryCMSSidebarItems();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("nav-seo");
  });

  it("unregisterOryCMSPlugin removes its sidebar items", () => {
    registerOryCMSPlugin(plugin("seo", [item({ id: "nav-seo", label: "SEO" })]));
    unregisterOryCMSPlugin("seo");
    expect(getOryCMSSidebarItems()).toHaveLength(0);
  });

  it("unregistering one plugin leaves other plugins' sidebar items", () => {
    registerOryCMSPlugin(plugin("a", [item({ id: "a-nav", label: "A" })]));
    registerOryCMSPlugin(plugin("b", [item({ id: "b-nav", label: "B" })]));
    unregisterOryCMSPlugin("a");
    const items = getOryCMSSidebarItems();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("b-nav");
  });

  it("clearOryCMSPluginRegistry removes sidebar items for all plugins", () => {
    registerOryCMSPlugin(plugin("a", [item({ id: "a-nav", label: "A" })]));
    registerOryCMSPlugin(plugin("b", [item({ id: "b-nav", label: "B" })]));
    clearOryCMSPluginRegistry();
    expect(getOryCMSSidebarItems()).toHaveLength(0);
  });

  it("reload: unregister then re-register produces exactly one copy of items", () => {
    registerOryCMSPlugin(plugin("seo", [item({ id: "nav-seo", label: "SEO" })]));
    unregisterOryCMSPlugin("seo");
    registerOryCMSPlugin(plugin("seo", [item({ id: "nav-seo", label: "SEO" })]));
    expect(getOryCMSSidebarItems()).toHaveLength(1);
  });

  it("plugin without sidebar items registers without touching sidebar registry", () => {
    registerOryCMSPlugin(plugin("no-sidebar"));
    expect(getOryCMSSidebarItems()).toHaveLength(0);
  });

  it("plugin sidebar items preserve group and order fields", () => {
    registerOryCMSPlugin(
      plugin("tools", [
        item({ id: "t1", label: "Tool 1", group: "Utilities", order: 2 }),
        item({ id: "t2", label: "Tool 2", group: "Utilities", order: 1 }),
      ]),
    );
    const items = getOryCMSSidebarItems();
    expect(items[0]).toMatchObject({ id: "t2", group: "Utilities", order: 1 });
    expect(items[1]).toMatchObject({ id: "t1", group: "Utilities", order: 2 });
  });
});
