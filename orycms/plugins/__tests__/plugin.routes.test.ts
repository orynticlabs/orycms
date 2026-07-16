import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearOryCMSPluginRoutes,
  getOryCMSPluginRoutes,
  registerOryCMSPluginRoutes,
  unregisterOryCMSPluginRoutes,
} from "../plugin.routes";
import { clearOryCMSPluginRegistry, registerOryCMSPlugin, unregisterOryCMSPlugin } from "@/plugins";
import type { OryCMSPlugin } from "@/plugins";
import type { OryCMSPluginRoute } from "../plugin.types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function route(overrides: Partial<OryCMSPluginRoute> & { path: string }): OryCMSPluginRoute {
  return { ...overrides };
}

function plugin(
  id: string,
  routes: OryCMSPluginRoute[] = [],
  extra: Partial<OryCMSPlugin> = {},
): OryCMSPlugin {
  return { id, name: `Plugin ${id}`, version: "1.0.0", routes, ...extra };
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  clearOryCMSPluginRoutes();
  clearOryCMSPluginRegistry();
});

afterEach(() => {
  clearOryCMSPluginRoutes();
  clearOryCMSPluginRegistry();
});

// ── Registration ──────────────────────────────────────────────────────────────

describe("Registration", () => {
  it("registered routes appear in getOryCMSPluginRoutes()", () => {
    registerOryCMSPluginRoutes("p", [route({ method: "GET", path: "/api/orycms/test" })]);
    expect(getOryCMSPluginRoutes()).toHaveLength(1);
  });

  it("stores all provided fields including handler", () => {
    const handler = vi.fn();
    registerOryCMSPluginRoutes("p", [
      route({ method: "POST", path: "/api/orycms/seo/analyze", handler }),
    ]);
    const [r] = getOryCMSPluginRoutes();
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/api/orycms/seo/analyze");
    expect(r.handler).toBe(handler);
  });

  it("routes without method default to GET for dedup; original method stays undefined", () => {
    registerOryCMSPluginRoutes("p", [route({ path: "/api/orycms/default" })]);
    const [r] = getOryCMSPluginRoutes();
    expect(r.method).toBeUndefined();
  });

  it("multiple plugins can register routes on different paths", () => {
    registerOryCMSPluginRoutes("a", [route({ method: "GET", path: "/api/orycms/a" })]);
    registerOryCMSPluginRoutes("b", [route({ method: "GET", path: "/api/orycms/b" })]);
    expect(getOryCMSPluginRoutes()).toHaveLength(2);
  });

  it("a plugin can register routes for multiple methods on the same path", () => {
    registerOryCMSPluginRoutes("p", [
      route({ method: "GET", path: "/api/orycms/data" }),
      route({ method: "POST", path: "/api/orycms/data" }),
    ]);
    expect(getOryCMSPluginRoutes()).toHaveLength(2);
  });

  it("a single route entry with method array registers as one object", () => {
    registerOryCMSPluginRoutes("p", [
      route({ method: ["GET", "POST"], path: "/api/orycms/multi" }),
    ]);
    expect(getOryCMSPluginRoutes()).toHaveLength(1);
  });

  it("empty routes array is a no-op", () => {
    registerOryCMSPluginRoutes("p", []);
    expect(getOryCMSPluginRoutes()).toHaveLength(0);
  });

  it("registering zero routes does not block later registration for same plugin", () => {
    registerOryCMSPluginRoutes("p", []);
    registerOryCMSPluginRoutes("p", [route({ method: "GET", path: "/api/orycms/x" })]);
    expect(getOryCMSPluginRoutes()).toHaveLength(1);
  });

  it("handler is stored but never called during registration", () => {
    const handler = vi.fn();
    registerOryCMSPluginRoutes("p", [route({ method: "GET", path: "/api/orycms/seo", handler })]);
    expect(handler).not.toHaveBeenCalled();
  });

  it("preserves extra fields via index signature", () => {
    registerOryCMSPluginRoutes("p", [
      route({ method: "GET", path: "/api/orycms/custom", middleware: ["auth"] }),
    ]);
    expect((getOryCMSPluginRoutes()[0] as unknown as { middleware: string[] }).middleware).toEqual([
      "auth",
    ]);
  });
});

// ── Unregister ────────────────────────────────────────────────────────────────

describe("Unregister", () => {
  it("unregistering removes all of a plugin's routes", () => {
    registerOryCMSPluginRoutes("p", [
      route({ method: "GET", path: "/api/orycms/a" }),
      route({ method: "POST", path: "/api/orycms/b" }),
    ]);
    unregisterOryCMSPluginRoutes("p");
    expect(getOryCMSPluginRoutes()).toHaveLength(0);
  });

  it("unregistering one plugin leaves other plugins' routes intact", () => {
    registerOryCMSPluginRoutes("a", [route({ method: "GET", path: "/api/orycms/a" })]);
    registerOryCMSPluginRoutes("b", [route({ method: "GET", path: "/api/orycms/b" })]);
    unregisterOryCMSPluginRoutes("a");
    const routes = getOryCMSPluginRoutes();
    expect(routes).toHaveLength(1);
    expect(routes[0].path).toBe("/api/orycms/b");
  });

  it("unregistering a plugin that has no routes is a no-op", () => {
    expect(() => unregisterOryCMSPluginRoutes("ghost")).not.toThrow();
  });

  it("unregistered method+path keys can be re-used", () => {
    registerOryCMSPluginRoutes("p", [route({ method: "GET", path: "/api/orycms/x" })]);
    unregisterOryCMSPluginRoutes("p");
    expect(() =>
      registerOryCMSPluginRoutes("p", [route({ method: "GET", path: "/api/orycms/x" })]),
    ).not.toThrow();
  });

  it("clearOryCMSPluginRoutes removes all routes", () => {
    registerOryCMSPluginRoutes("a", [route({ method: "GET", path: "/api/orycms/a" })]);
    registerOryCMSPluginRoutes("b", [route({ method: "GET", path: "/api/orycms/b" })]);
    clearOryCMSPluginRoutes();
    expect(getOryCMSPluginRoutes()).toHaveLength(0);
  });
});

// ── Duplicate protection ──────────────────────────────────────────────────────

describe("Duplicate protection", () => {
  it("throws when the same GET path is registered by two plugins", () => {
    registerOryCMSPluginRoutes("a", [route({ method: "GET", path: "/api/orycms/dup" })]);
    expect(() =>
      registerOryCMSPluginRoutes("b", [route({ method: "GET", path: "/api/orycms/dup" })]),
    ).toThrow('OryCMS plugin route "GET:/api/orycms/dup" is already registered.');
  });

  it("method comparison is case-insensitive", () => {
    registerOryCMSPluginRoutes("a", [route({ method: "get", path: "/api/orycms/case" })]);
    expect(() =>
      registerOryCMSPluginRoutes("b", [route({ method: "GET", path: "/api/orycms/case" })]),
    ).toThrow('"GET:/api/orycms/case"');
  });

  it("no method defaults to GET for duplicate detection", () => {
    registerOryCMSPluginRoutes("a", [route({ path: "/api/orycms/implicit" })]);
    expect(() =>
      registerOryCMSPluginRoutes("b", [route({ method: "GET", path: "/api/orycms/implicit" })]),
    ).toThrow('"GET:/api/orycms/implicit"');
  });

  it("different methods on the same path do not conflict", () => {
    registerOryCMSPluginRoutes("a", [route({ method: "GET", path: "/api/orycms/shared" })]);
    expect(() =>
      registerOryCMSPluginRoutes("b", [route({ method: "POST", path: "/api/orycms/shared" })]),
    ).not.toThrow();
  });

  it("method array expansion detects duplicate against existing key", () => {
    registerOryCMSPluginRoutes("a", [route({ method: "POST", path: "/api/orycms/arr" })]);
    expect(() =>
      registerOryCMSPluginRoutes("b", [
        route({ method: ["GET", "POST"], path: "/api/orycms/arr" }),
      ]),
    ).toThrow('"POST:/api/orycms/arr"');
  });

  it("method array expansion detects intra-batch duplicate", () => {
    expect(() =>
      registerOryCMSPluginRoutes("p", [
        route({ method: ["GET", "GET"], path: "/api/orycms/intra" }),
      ]),
    ).toThrow('"GET:/api/orycms/intra"');
  });

  it("throws on duplicate within the same batch and registers nothing", () => {
    expect(() =>
      registerOryCMSPluginRoutes("p", [
        route({ method: "GET", path: "/api/orycms/dup" }),
        route({ method: "GET", path: "/api/orycms/dup" }),
      ]),
    ).toThrow();
    expect(getOryCMSPluginRoutes()).toHaveLength(0);
  });

  it("unregistering frees the method+path key for re-use", () => {
    registerOryCMSPluginRoutes("a", [route({ method: "DELETE", path: "/api/orycms/r" })]);
    unregisterOryCMSPluginRoutes("a");
    expect(() =>
      registerOryCMSPluginRoutes("b", [route({ method: "DELETE", path: "/api/orycms/r" })]),
    ).not.toThrow();
  });
});

// ── Plugin registry integration ───────────────────────────────────────────────

describe("Plugin registry integration", () => {
  it("registerOryCMSPlugin automatically registers its routes", () => {
    registerOryCMSPlugin(
      plugin("seo", [route({ method: "GET", path: "/api/orycms/seo/analyze" })]),
    );
    expect(getOryCMSPluginRoutes()).toHaveLength(1);
  });

  it("unregisterOryCMSPlugin removes its routes", () => {
    registerOryCMSPlugin(
      plugin("seo", [route({ method: "GET", path: "/api/orycms/seo/analyze" })]),
    );
    unregisterOryCMSPlugin("seo");
    expect(getOryCMSPluginRoutes()).toHaveLength(0);
  });

  it("unregistering one plugin leaves other plugins' routes", () => {
    registerOryCMSPlugin(plugin("a", [route({ method: "GET", path: "/api/orycms/a" })]));
    registerOryCMSPlugin(plugin("b", [route({ method: "GET", path: "/api/orycms/b" })]));
    unregisterOryCMSPlugin("a");
    const routes = getOryCMSPluginRoutes();
    expect(routes).toHaveLength(1);
    expect(routes[0].path).toBe("/api/orycms/b");
  });

  it("clearOryCMSPluginRegistry removes all plugin routes", () => {
    registerOryCMSPlugin(plugin("a", [route({ method: "GET", path: "/api/orycms/a" })]));
    registerOryCMSPlugin(plugin("b", [route({ method: "POST", path: "/api/orycms/b" })]));
    clearOryCMSPluginRegistry();
    expect(getOryCMSPluginRoutes()).toHaveLength(0);
  });

  it("reload: unregister then re-register produces exactly one set of routes", () => {
    registerOryCMSPlugin(plugin("seo", [route({ method: "GET", path: "/api/orycms/seo" })]));
    unregisterOryCMSPlugin("seo");
    registerOryCMSPlugin(plugin("seo", [route({ method: "GET", path: "/api/orycms/seo" })]));
    expect(getOryCMSPluginRoutes()).toHaveLength(1);
  });

  it("plugin without routes registers without touching route registry", () => {
    registerOryCMSPlugin(plugin("no-routes"));
    expect(getOryCMSPluginRoutes()).toHaveLength(0);
  });

  it("handler stored through plugin registration is never called", () => {
    const handler = vi.fn();
    registerOryCMSPlugin(
      plugin("seo", [route({ method: "GET", path: "/api/orycms/seo", handler })]),
    );
    expect(handler).not.toHaveBeenCalled();
  });
});

// ── Ordering ──────────────────────────────────────────────────────────────────

describe("Ordering", () => {
  it("routes are returned in plugin-registration order", () => {
    registerOryCMSPluginRoutes("a", [route({ method: "GET", path: "/api/orycms/a" })]);
    registerOryCMSPluginRoutes("b", [route({ method: "GET", path: "/api/orycms/b" })]);
    const paths = getOryCMSPluginRoutes().map((r) => r.path);
    expect(paths).toEqual(["/api/orycms/a", "/api/orycms/b"]);
  });

  it("routes within a plugin preserve their array order", () => {
    registerOryCMSPluginRoutes("p", [
      route({ method: "GET", path: "/api/orycms/first" }),
      route({ method: "POST", path: "/api/orycms/second" }),
      route({ method: "DELETE", path: "/api/orycms/third" }),
    ]);
    const paths = getOryCMSPluginRoutes().map((r) => r.path);
    expect(paths).toEqual(["/api/orycms/first", "/api/orycms/second", "/api/orycms/third"]);
  });
});
