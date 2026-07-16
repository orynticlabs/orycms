import { describe, expect, it } from "vitest";

import {
  getOryCMSPluginLoadOrder,
  resolveOryCMSPluginDependencies,
  validateOryCMSPluginDependencies,
} from "../plugin.dependencies";
import type { OryCMSPluginManifest } from "../plugin.manifest";

// ── Helpers ───────────────────────────────────────────────────────────────────

function m(
  id: string,
  version = "1.0.0",
  deps: Record<string, string> = {},
  peers: Record<string, string> = {},
): OryCMSPluginManifest {
  return { id, name: id, version, dependencies: deps, peerDependencies: peers };
}

// ── validateOryCMSPluginDependencies ──────────────────────────────────────────

describe("validateOryCMSPluginDependencies", () => {
  describe("Empty / no-dependency cases", () => {
    it("returns no errors for an empty manifest list", () => {
      expect(validateOryCMSPluginDependencies([])).toHaveLength(0);
    });

    it("returns no errors for a single plugin with no dependencies", () => {
      expect(validateOryCMSPluginDependencies([m("a")])).toHaveLength(0);
    });

    it("returns no errors for multiple plugins with no mutual deps", () => {
      expect(validateOryCMSPluginDependencies([m("a"), m("b"), m("c")])).toHaveLength(0);
    });
  });

  describe("Missing dependencies", () => {
    it("reports MISSING_DEPENDENCY when a required dep is absent", () => {
      const errs = validateOryCMSPluginDependencies([m("a", "1.0.0", { b: "^1.0.0" })]);
      expect(errs).toHaveLength(1);
      expect(errs[0]).toMatchObject({ code: "MISSING_DEPENDENCY", plugin: "a", dependency: "b" });
    });

    it("reports MISSING_DEPENDENCY for peer dependency that is absent", () => {
      const errs = validateOryCMSPluginDependencies([m("a", "1.0.0", {}, { b: "^1.0.0" })]);
      expect(errs).toHaveLength(1);
      expect(errs[0]).toMatchObject({ code: "MISSING_DEPENDENCY", plugin: "a", dependency: "b" });
    });

    it("reports all missing deps in one pass", () => {
      const errs = validateOryCMSPluginDependencies([m("a", "1.0.0", { b: "1.0.0", c: "1.0.0" })]);
      expect(errs).toHaveLength(2);
      expect(errs.map((e) => e.dependency).sort()).toEqual(["b", "c"]);
    });

    it("includes the required range in the error", () => {
      const errs = validateOryCMSPluginDependencies([m("a", "1.0.0", { b: "^2.0.0" })]);
      expect(errs[0].required).toBe("^2.0.0");
    });
  });

  describe("Version compatibility", () => {
    it("returns no errors when version satisfies ^-range", () => {
      expect(
        validateOryCMSPluginDependencies([m("a", "1.0.0", { b: "^1.0.0" }), m("b", "1.2.3")]),
      ).toHaveLength(0);
    });

    it("reports INCOMPATIBLE_VERSION for ^-range major mismatch", () => {
      const errs = validateOryCMSPluginDependencies([
        m("a", "1.0.0", { b: "^1.0.0" }),
        m("b", "2.0.0"),
      ]);
      expect(errs).toHaveLength(1);
      expect(errs[0]).toMatchObject({
        code: "INCOMPATIBLE_VERSION",
        required: "^1.0.0",
        found: "2.0.0",
      });
    });

    it("passes for ~-range patch", () => {
      expect(
        validateOryCMSPluginDependencies([m("a", "1.0.0", { b: "~1.2.0" }), m("b", "1.2.5")]),
      ).toHaveLength(0);
    });

    it("reports INCOMPATIBLE_VERSION for ~-range minor change", () => {
      const errs = validateOryCMSPluginDependencies([
        m("a", "1.0.0", { b: "~1.2.0" }),
        m("b", "1.3.0"),
      ]);
      expect(errs[0].code).toBe("INCOMPATIBLE_VERSION");
    });

    it("passes for >= range", () => {
      expect(
        validateOryCMSPluginDependencies([m("a", "1.0.0", { b: ">=2.0.0" }), m("b", "3.1.0")]),
      ).toHaveLength(0);
    });

    it("fails for >= range when version is lower", () => {
      const errs = validateOryCMSPluginDependencies([
        m("a", "1.0.0", { b: ">=3.0.0" }),
        m("b", "2.9.9"),
      ]);
      expect(errs[0].code).toBe("INCOMPATIBLE_VERSION");
    });

    it("passes for exact version match", () => {
      expect(
        validateOryCMSPluginDependencies([m("a", "1.0.0", { b: "1.2.3" }), m("b", "1.2.3")]),
      ).toHaveLength(0);
    });

    it("fails for exact version mismatch", () => {
      const errs = validateOryCMSPluginDependencies([
        m("a", "1.0.0", { b: "1.2.3" }),
        m("b", "1.2.4"),
      ]);
      expect(errs[0].code).toBe("INCOMPATIBLE_VERSION");
    });

    it("* range accepts any version", () => {
      expect(
        validateOryCMSPluginDependencies([m("a", "1.0.0", { b: "*" }), m("b", "9.9.9")]),
      ).toHaveLength(0);
    });

    it("passes for || (OR) range when first alternative matches", () => {
      expect(
        validateOryCMSPluginDependencies([
          m("a", "1.0.0", { b: "^1.0.0 || ^2.0.0" }),
          m("b", "1.5.0"),
        ]),
      ).toHaveLength(0);
    });

    it("passes for || range when second alternative matches", () => {
      expect(
        validateOryCMSPluginDependencies([
          m("a", "1.0.0", { b: "^1.0.0 || ^2.0.0" }),
          m("b", "2.3.0"),
        ]),
      ).toHaveLength(0);
    });

    it("fails for || range when neither alternative matches", () => {
      const errs = validateOryCMSPluginDependencies([
        m("a", "1.0.0", { b: "^1.0.0 || ^2.0.0" }),
        m("b", "3.0.0"),
      ]);
      expect(errs[0].code).toBe("INCOMPATIBLE_VERSION");
    });

    it("includes found version in the error", () => {
      const errs = validateOryCMSPluginDependencies([
        m("a", "1.0.0", { b: "^2.0.0" }),
        m("b", "1.0.0"),
      ]);
      expect(errs[0].found).toBe("1.0.0");
    });
  });

  describe("Circular dependencies", () => {
    it("reports CIRCULAR_DEPENDENCY for a direct A→B→A cycle", () => {
      const errs = validateOryCMSPluginDependencies([
        m("a", "1.0.0", { b: "^1.0.0" }),
        m("b", "1.0.0", { a: "^1.0.0" }),
      ]);
      expect(errs.some((e) => e.code === "CIRCULAR_DEPENDENCY")).toBe(true);
    });

    it("reports CIRCULAR_DEPENDENCY for a three-node cycle A→B→C→A", () => {
      const errs = validateOryCMSPluginDependencies([
        m("a", "1.0.0", { b: "1.0.0" }),
        m("b", "1.0.0", { c: "1.0.0" }),
        m("c", "1.0.0", { a: "1.0.0" }),
      ]);
      expect(errs.some((e) => e.code === "CIRCULAR_DEPENDENCY")).toBe(true);
    });

    it("cycle error message lists the cycle path", () => {
      const errs = validateOryCMSPluginDependencies([
        m("a", "1.0.0", { b: "1.0.0" }),
        m("b", "1.0.0", { a: "1.0.0" }),
      ]);
      const cyc = errs.find((e) => e.code === "CIRCULAR_DEPENDENCY")!;
      expect(cyc.message).toMatch(/Circular dependency/);
      expect(cyc.message).toMatch(/a/);
      expect(cyc.message).toMatch(/b/);
    });

    it("does not report circular for a valid chain A→B→C (no cycle)", () => {
      const errs = validateOryCMSPluginDependencies([
        m("a", "1.0.0", { b: "1.0.0" }),
        m("b", "1.0.0", { c: "1.0.0" }),
        m("c", "1.0.0"),
      ]);
      expect(errs.filter((e) => e.code === "CIRCULAR_DEPENDENCY")).toHaveLength(0);
    });
  });

  describe("Duplicate plugin IDs", () => {
    it("reports DUPLICATE_PLUGIN for two manifests with the same id", () => {
      const errs = validateOryCMSPluginDependencies([m("a"), m("a")]);
      expect(errs).toHaveLength(1);
      expect(errs[0]).toMatchObject({ code: "DUPLICATE_PLUGIN", plugin: "a" });
    });

    it("only validates one copy when duplicate present", () => {
      // second copy with a broken dep should not add additional errors
      // because only the first occurrence is used for validation
      const errs = validateOryCMSPluginDependencies([m("a"), m("a", "1.0.0", { z: "1.0.0" })]);
      const codes = errs.map((e) => e.code);
      expect(codes).toContain("DUPLICATE_PLUGIN");
      expect(codes).not.toContain("MISSING_DEPENDENCY");
    });
  });

  describe("Combined validation", () => {
    it("reports all error types in a single call", () => {
      const errs = validateOryCMSPluginDependencies([
        m("a", "1.0.0", { b: "^2.0.0", missing: "1.0.0" }), // incompatible + missing
        m("b", "1.0.0", { a: "^1.0.0" }), // circular
      ]);
      const codes = errs.map((e) => e.code);
      expect(codes).toContain("MISSING_DEPENDENCY");
      expect(codes).toContain("INCOMPATIBLE_VERSION");
      expect(codes).toContain("CIRCULAR_DEPENDENCY");
    });
  });
});

// ── getOryCMSPluginLoadOrder ──────────────────────────────────────────────────

describe("getOryCMSPluginLoadOrder", () => {
  it("returns a single plugin with no deps", () => {
    expect(getOryCMSPluginLoadOrder([m("a")])).toEqual(["a"]);
  });

  it("returns dependency before dependent", () => {
    const order = getOryCMSPluginLoadOrder([m("app", "1.0.0", { core: "1.0.0" }), m("core")]);
    expect(order.indexOf("core")).toBeLessThan(order.indexOf("app"));
  });

  it("returns leaf nodes before plugins that depend on them", () => {
    const order = getOryCMSPluginLoadOrder([
      m("a", "1.0.0", { b: "1.0.0", c: "1.0.0" }),
      m("b", "1.0.0", { c: "1.0.0" }),
      m("c"),
    ]);
    expect(order.indexOf("c")).toBeLessThan(order.indexOf("b"));
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("a"));
  });

  it("order is deterministic across multiple calls", () => {
    const manifests = [m("x"), m("y"), m("z", "1.0.0", { x: "1.0.0", y: "1.0.0" })];
    expect(getOryCMSPluginLoadOrder(manifests)).toEqual(getOryCMSPluginLoadOrder(manifests));
  });

  it("independent plugins appear in alphabetical order for stability", () => {
    const order = getOryCMSPluginLoadOrder([m("c"), m("a"), m("b")]);
    expect(order).toEqual(["a", "b", "c"]);
  });

  it("includes all plugins in the result", () => {
    const manifests = [m("a"), m("b"), m("c")];
    const order = getOryCMSPluginLoadOrder(manifests);
    expect(order.sort()).toEqual(["a", "b", "c"]);
  });

  it("throws when a circular dependency makes ordering impossible", () => {
    expect(() =>
      getOryCMSPluginLoadOrder([m("a", "1.0.0", { b: "1.0.0" }), m("b", "1.0.0", { a: "1.0.0" })]),
    ).toThrow(/circular/i);
  });

  it("deep chain: e depends on d depends on c depends on b depends on a", () => {
    const order = getOryCMSPluginLoadOrder([
      m("e", "1.0.0", { d: "1.0.0" }),
      m("d", "1.0.0", { c: "1.0.0" }),
      m("c", "1.0.0", { b: "1.0.0" }),
      m("b", "1.0.0", { a: "1.0.0" }),
      m("a"),
    ]);
    ["a", "b", "c", "d", "e"].forEach((id, i) => {
      expect(order.indexOf(id)).toBe(i);
    });
  });
});

// ── resolveOryCMSPluginDependencies ──────────────────────────────────────────

describe("resolveOryCMSPluginDependencies", () => {
  it("returns valid=true and a load order for a healthy set", () => {
    const result = resolveOryCMSPluginDependencies([
      m("app", "1.0.0", { core: "^1.0.0" }),
      m("core"),
    ]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.loadOrder.indexOf("core")).toBeLessThan(result.loadOrder.indexOf("app"));
  });

  it("returns valid=false with errors for missing dependency", () => {
    const result = resolveOryCMSPluginDependencies([m("a", "1.0.0", { missing: "1.0.0" })]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "MISSING_DEPENDENCY")).toBe(true);
  });

  it("returns valid=false with errors for incompatible version", () => {
    const result = resolveOryCMSPluginDependencies([
      m("a", "1.0.0", { b: "^2.0.0" }),
      m("b", "1.0.0"),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "INCOMPATIBLE_VERSION")).toBe(true);
  });

  it("returns valid=false with CIRCULAR_DEPENDENCY and empty loadOrder", () => {
    const result = resolveOryCMSPluginDependencies([
      m("a", "1.0.0", { b: "1.0.0" }),
      m("b", "1.0.0", { a: "1.0.0" }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "CIRCULAR_DEPENDENCY")).toBe(true);
    expect(result.loadOrder).toHaveLength(0);
  });

  it("returns valid=false for duplicate plugin", () => {
    const result = resolveOryCMSPluginDependencies([m("a"), m("a")]);
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe("DUPLICATE_PLUGIN");
  });

  it("includes a load order even when only non-circular errors exist", () => {
    // missing dep doesn't block ordering — only circular does
    const result = resolveOryCMSPluginDependencies([m("a", "1.0.0", { ghost: "1.0.0" })]);
    expect(result.valid).toBe(false);
    expect(result.loadOrder).toContain("a");
  });

  it("valid=true and correct order for a diamond dependency graph", () => {
    //      top
    //     /   \
    //   left  right
    //     \   /
    //      base
    const result = resolveOryCMSPluginDependencies([
      m("top", "1.0.0", { left: "1.0.0", right: "1.0.0" }),
      m("left", "1.0.0", { base: "1.0.0" }),
      m("right", "1.0.0", { base: "1.0.0" }),
      m("base"),
    ]);
    expect(result.valid).toBe(true);
    const o = result.loadOrder;
    expect(o.indexOf("base")).toBeLessThan(o.indexOf("left"));
    expect(o.indexOf("base")).toBeLessThan(o.indexOf("right"));
    expect(o.indexOf("left")).toBeLessThan(o.indexOf("top"));
    expect(o.indexOf("right")).toBeLessThan(o.indexOf("top"));
  });

  it("error objects have descriptive messages", () => {
    const result = resolveOryCMSPluginDependencies([
      m("a", "1.0.0", { b: "^3.0.0" }),
      m("b", "1.0.0"),
    ]);
    expect(result.errors[0].message).toMatch(/incompatible|requires/i);
  });
});
