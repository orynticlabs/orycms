import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearOryCMSPageRegistry,
  getOryCMSPages,
  registerOryCMSPages,
  unregisterOryCMSPages,
} from "../page.registry";
import type { OryCMSAdminPage } from "../page.registry";

import { clearOryCMSPluginRegistry, registerOryCMSPlugin, unregisterOryCMSPlugin } from "@/plugins";
import type { OryCMSPlugin } from "@/plugins";

// ── Helpers ───────────────────────────────────────────────────────────────────

function page(
  overrides: Partial<OryCMSAdminPage> & { id: string; title: string; path: string },
): OryCMSAdminPage {
  return { ...overrides };
}

function plugin(
  id: string,
  pages: OryCMSAdminPage[] = [],
  extra: Partial<OryCMSPlugin> = {},
): OryCMSPlugin {
  return { id, name: `Plugin ${id}`, version: "1.0.0", pages, ...extra };
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  clearOryCMSPageRegistry();
  clearOryCMSPluginRegistry();
});

afterEach(() => {
  clearOryCMSPageRegistry();
  clearOryCMSPluginRegistry();
});

// ── Registration ──────────────────────────────────────────────────────────────

describe("Registration", () => {
  it("registered pages appear in getOryCMSPages()", () => {
    registerOryCMSPages("p", [
      page({ id: "dashboard", title: "Dashboard", path: "/admin/dashboard" }),
    ]);
    const pages = getOryCMSPages();
    expect(pages).toHaveLength(1);
    expect(pages[0].id).toBe("dashboard");
  });

  it("multiple plugins can each register pages", () => {
    registerOryCMSPages("a", [page({ id: "a-page", title: "A", path: "/admin/a" })]);
    registerOryCMSPages("b", [page({ id: "b-page", title: "B", path: "/admin/b" })]);
    expect(getOryCMSPages()).toHaveLength(2);
  });

  it("stores all provided fields", () => {
    const component = () => null;
    registerOryCMSPages("p", [
      page({
        id: "full",
        title: "Full Page",
        path: "/admin/full",
        component,
        layout: "sidebar",
        order: 3,
        permission: "admin",
      }),
    ]);
    const [result] = getOryCMSPages();
    expect(result).toMatchObject({
      id: "full",
      title: "Full Page",
      path: "/admin/full",
      component,
      layout: "sidebar",
      order: 3,
      permission: "admin",
    });
  });

  it("pages without optional fields register without error", () => {
    expect(() =>
      registerOryCMSPages("p", [page({ id: "bare", title: "Bare", path: "/admin/bare" })]),
    ).not.toThrow();
    expect(getOryCMSPages()).toHaveLength(1);
  });

  it("empty pages array is a no-op", () => {
    registerOryCMSPages("p", []);
    expect(getOryCMSPages()).toHaveLength(0);
  });

  it("registering zero pages does not block later registration for same plugin", () => {
    registerOryCMSPages("p", []);
    registerOryCMSPages("p", [page({ id: "x", title: "X", path: "/admin/x" })]);
    expect(getOryCMSPages()).toHaveLength(1);
  });
});

// ── Unregister ────────────────────────────────────────────────────────────────

describe("Unregister", () => {
  it("unregistering removes all of a plugin's pages", () => {
    registerOryCMSPages("p", [
      page({ id: "a", title: "A", path: "/admin/a" }),
      page({ id: "b", title: "B", path: "/admin/b" }),
    ]);
    unregisterOryCMSPages("p");
    expect(getOryCMSPages()).toHaveLength(0);
  });

  it("unregistering one plugin leaves other plugins' pages intact", () => {
    registerOryCMSPages("a", [page({ id: "a-pg", title: "A", path: "/admin/a" })]);
    registerOryCMSPages("b", [page({ id: "b-pg", title: "B", path: "/admin/b" })]);
    unregisterOryCMSPages("a");
    const pages = getOryCMSPages();
    expect(pages).toHaveLength(1);
    expect(pages[0].id).toBe("b-pg");
  });

  it("unregistering a plugin that has no pages is a no-op", () => {
    expect(() => unregisterOryCMSPages("ghost")).not.toThrow();
    expect(getOryCMSPages()).toHaveLength(0);
  });

  it("unregistered ids and paths can be re-used after unregister", () => {
    registerOryCMSPages("p", [page({ id: "pg", title: "Page", path: "/admin/pg" })]);
    unregisterOryCMSPages("p");
    expect(() =>
      registerOryCMSPages("p", [page({ id: "pg", title: "Page v2", path: "/admin/pg" })]),
    ).not.toThrow();
    expect(getOryCMSPages()[0].title).toBe("Page v2");
  });

  it("clearOryCMSPageRegistry removes all pages", () => {
    registerOryCMSPages("a", [page({ id: "a-pg", title: "A", path: "/admin/a" })]);
    registerOryCMSPages("b", [page({ id: "b-pg", title: "B", path: "/admin/b" })]);
    clearOryCMSPageRegistry();
    expect(getOryCMSPages()).toHaveLength(0);
  });
});

// ── Ordering ──────────────────────────────────────────────────────────────────

describe("Ordering", () => {
  it("pages are returned sorted by order ascending", () => {
    registerOryCMSPages("p", [
      page({ id: "c", title: "C", path: "/admin/c", order: 30 }),
      page({ id: "a", title: "A", path: "/admin/a", order: 10 }),
      page({ id: "b", title: "B", path: "/admin/b", order: 20 }),
    ]);
    expect(getOryCMSPages().map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("pages without order come after pages with order", () => {
    registerOryCMSPages("p", [
      page({ id: "no-order", title: "No Order", path: "/admin/no" }),
      page({ id: "ordered", title: "Ordered", path: "/admin/ordered", order: 1 }),
    ]);
    const ids = getOryCMSPages().map((p) => p.id);
    expect(ids[0]).toBe("ordered");
    expect(ids[1]).toBe("no-order");
  });

  it("pages from different plugins are merged and sorted", () => {
    registerOryCMSPages("b", [page({ id: "b-pg", title: "B", path: "/admin/b", order: 20 })]);
    registerOryCMSPages("a", [page({ id: "a-pg", title: "A", path: "/admin/a", order: 10 })]);
    expect(getOryCMSPages().map((p) => p.id)).toEqual(["a-pg", "b-pg"]);
  });

  it("pages without order maintain stable insertion order relative to each other", () => {
    registerOryCMSPages("a", [page({ id: "first", title: "First", path: "/admin/first" })]);
    registerOryCMSPages("b", [page({ id: "second", title: "Second", path: "/admin/second" })]);
    expect(getOryCMSPages().map((p) => p.id)).toEqual(["first", "second"]);
  });
});

// ── Duplicate protection ──────────────────────────────────────────────────────

describe("Duplicate protection", () => {
  it("throws on duplicate page id across plugins", () => {
    registerOryCMSPages("a", [page({ id: "pg", title: "A", path: "/admin/a" })]);
    expect(() =>
      registerOryCMSPages("b", [page({ id: "pg", title: "B", path: "/admin/b" })]),
    ).toThrow('OryCMS admin page id "pg" is already registered.');
  });

  it("throws on duplicate page id within the same plugin", () => {
    registerOryCMSPages("p", [page({ id: "pg", title: "First", path: "/admin/first" })]);
    expect(() =>
      registerOryCMSPages("p", [page({ id: "pg", title: "Second", path: "/admin/second" })]),
    ).toThrow('"pg"');
  });

  it("throws on duplicate path across plugins", () => {
    registerOryCMSPages("a", [page({ id: "pg-a", title: "A", path: "/admin/shared" })]);
    expect(() =>
      registerOryCMSPages("b", [page({ id: "pg-b", title: "B", path: "/admin/shared" })]),
    ).toThrow('OryCMS admin page path "/admin/shared" is already registered.');
  });

  it("throws on duplicate path within a batch", () => {
    expect(() =>
      registerOryCMSPages("p", [
        page({ id: "x1", title: "X1", path: "/admin/dup" }),
        page({ id: "x2", title: "X2", path: "/admin/dup" }),
      ]),
    ).toThrow('"/admin/dup"');
  });

  it("throws on duplicate id within a batch and registers nothing", () => {
    expect(() =>
      registerOryCMSPages("p", [
        page({ id: "dup", title: "First", path: "/admin/first" }),
        page({ id: "dup", title: "Second", path: "/admin/second" }),
      ]),
    ).toThrow('"dup"');
    expect(getOryCMSPages()).toHaveLength(0);
  });

  it("unregistering frees both id and path for re-use", () => {
    registerOryCMSPages("a", [page({ id: "pg", title: "A", path: "/admin/pg" })]);
    unregisterOryCMSPages("a");
    expect(() =>
      registerOryCMSPages("b", [page({ id: "pg", title: "B", path: "/admin/pg" })]),
    ).not.toThrow();
  });
});

// ── Permission filtering ──────────────────────────────────────────────────────

describe("Permission filtering", () => {
  beforeEach(() => {
    registerOryCMSPages("p", [
      page({ id: "public", title: "Public", path: "/admin/public" }),
      page({ id: "admin-only", title: "Admin", path: "/admin/admin", permission: "admin" }),
      page({ id: "editor-only", title: "Editor", path: "/admin/editor", permission: "editor" }),
    ]);
  });

  it("returns all pages when userPermissions is undefined", () => {
    expect(getOryCMSPages(undefined)).toHaveLength(3);
  });

  it("includes pages whose permission the user holds", () => {
    const ids = getOryCMSPages(["admin"]).map((p) => p.id);
    expect(ids).toContain("public");
    expect(ids).toContain("admin-only");
    expect(ids).not.toContain("editor-only");
  });

  it("excludes pages whose permission the user does not hold", () => {
    const ids = getOryCMSPages(["editor"]).map((p) => p.id);
    expect(ids).toContain("public");
    expect(ids).toContain("editor-only");
    expect(ids).not.toContain("admin-only");
  });

  it("returns only pages with no permission when user has empty permissions", () => {
    const pages = getOryCMSPages([]);
    expect(pages).toHaveLength(1);
    expect(pages[0].id).toBe("public");
  });

  it("returns all matching pages when user holds multiple permissions", () => {
    expect(getOryCMSPages(["admin", "editor"])).toHaveLength(3);
  });
});

// ── Plugin registry integration ───────────────────────────────────────────────

describe("Plugin registry integration", () => {
  it("registerOryCMSPlugin automatically registers its pages", () => {
    registerOryCMSPlugin(
      plugin("seo", [page({ id: "seo-page", title: "SEO", path: "/admin/seo" })]),
    );
    expect(getOryCMSPages()).toHaveLength(1);
    expect(getOryCMSPages()[0].id).toBe("seo-page");
  });

  it("unregisterOryCMSPlugin removes its pages", () => {
    registerOryCMSPlugin(
      plugin("seo", [page({ id: "seo-page", title: "SEO", path: "/admin/seo" })]),
    );
    unregisterOryCMSPlugin("seo");
    expect(getOryCMSPages()).toHaveLength(0);
  });

  it("unregistering one plugin leaves other plugins' pages", () => {
    registerOryCMSPlugin(plugin("a", [page({ id: "a-pg", title: "A", path: "/admin/a" })]));
    registerOryCMSPlugin(plugin("b", [page({ id: "b-pg", title: "B", path: "/admin/b" })]));
    unregisterOryCMSPlugin("a");
    const pages = getOryCMSPages();
    expect(pages).toHaveLength(1);
    expect(pages[0].id).toBe("b-pg");
  });

  it("clearOryCMSPluginRegistry removes all plugin pages", () => {
    registerOryCMSPlugin(plugin("a", [page({ id: "a-pg", title: "A", path: "/admin/a" })]));
    registerOryCMSPlugin(plugin("b", [page({ id: "b-pg", title: "B", path: "/admin/b" })]));
    clearOryCMSPluginRegistry();
    expect(getOryCMSPages()).toHaveLength(0);
  });

  it("reload: unregister then re-register produces exactly one copy of pages", () => {
    registerOryCMSPlugin(plugin("seo", [page({ id: "seo-pg", title: "SEO", path: "/admin/seo" })]));
    unregisterOryCMSPlugin("seo");
    registerOryCMSPlugin(plugin("seo", [page({ id: "seo-pg", title: "SEO", path: "/admin/seo" })]));
    expect(getOryCMSPages()).toHaveLength(1);
  });

  it("plugin without pages registers without touching page registry", () => {
    registerOryCMSPlugin(plugin("no-pages"));
    expect(getOryCMSPages()).toHaveLength(0);
  });

  it("pages preserve layout, order, and permission fields through plugin registration", () => {
    registerOryCMSPlugin(
      plugin("tools", [
        page({ id: "t2", title: "Tool 2", path: "/admin/t2", layout: "full", order: 2 }),
        page({
          id: "t1",
          title: "Tool 1",
          path: "/admin/t1",
          layout: "full",
          order: 1,
          permission: "tools.view",
        }),
      ]),
    );
    const pages = getOryCMSPages();
    expect(pages[0]).toMatchObject({
      id: "t1",
      layout: "full",
      order: 1,
      permission: "tools.view",
    });
    expect(pages[1]).toMatchObject({ id: "t2", layout: "full", order: 2 });
  });
});
