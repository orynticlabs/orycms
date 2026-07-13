import { describe, expect, it } from "vitest";

import {
  getOryCMSPluginCompatibilityReport,
  isOryCMSPluginCompatible,
  ORYCMS_VERSION,
  validateOryCMSPluginCompatibility,
} from "../plugin.compatibility";
import type {
  OryCMSCompatibilityOptions,
  OryCMSCompatibilityReport,
} from "../plugin.compatibility";
import type { OryCMSPluginManifest } from "../plugin.manifest";

// ── Helpers ───────────────────────────────────────────────────────────────────

function m(
  id: string,
  oryCMSRange?: string,
  extra?: Partial<OryCMSPluginManifest>,
): OryCMSPluginManifest {
  return {
    id,
    name: id,
    version: "1.0.0",
    ...(oryCMSRange !== undefined ? { compatibility: { orycms: oryCMSRange } } : {}),
    ...extra,
  };
}

const AT = (v: string): OryCMSCompatibilityOptions => ({ oryCMSVersion: v });

// ── ORYCMS_VERSION constant ───────────────────────────────────────────────────

describe("ORYCMS_VERSION", () => {
  it("is a non-empty string", () => {
    expect(typeof ORYCMS_VERSION).toBe("string");
    expect(ORYCMS_VERSION.length).toBeGreaterThan(0);
  });

  it("is used as the default when no oryCMSVersion option is supplied", () => {
    // If ORYCMS_VERSION satisfies *, the result should be empty errors when allowUndeclared=true
    const errors = validateOryCMSPluginCompatibility(m("p", "*"), { allowUndeclared: true });
    expect(errors).toHaveLength(0);
  });
});

// ── validateOryCMSPluginCompatibility ────────────────────────────────────────

describe("validateOryCMSPluginCompatibility", () => {
  describe("Compatible cases", () => {
    it("returns [] when orycms range is satisfied", () => {
      expect(validateOryCMSPluginCompatibility(m("p", "^1.0.0"), AT("1.2.3"))).toHaveLength(0);
    });

    it("returns [] for * wildcard", () => {
      expect(validateOryCMSPluginCompatibility(m("p", "*"), AT("99.0.0"))).toHaveLength(0);
    });

    it("returns [] for exact version match", () => {
      expect(validateOryCMSPluginCompatibility(m("p", "2.3.4"), AT("2.3.4"))).toHaveLength(0);
    });

    it("returns [] for >= range when version qualifies", () => {
      expect(validateOryCMSPluginCompatibility(m("p", ">=1.0.0"), AT("5.0.0"))).toHaveLength(0);
    });

    it("returns [] for <= range when version qualifies", () => {
      expect(validateOryCMSPluginCompatibility(m("p", "<=2.0.0"), AT("1.9.9"))).toHaveLength(0);
    });

    it("returns [] for > range when version qualifies", () => {
      expect(validateOryCMSPluginCompatibility(m("p", ">1.0.0"), AT("1.0.1"))).toHaveLength(0);
    });

    it("returns [] for < range when version qualifies", () => {
      expect(validateOryCMSPluginCompatibility(m("p", "<2.0.0"), AT("1.9.9"))).toHaveLength(0);
    });

    it("returns [] for ~ range within patch band", () => {
      expect(validateOryCMSPluginCompatibility(m("p", "~1.2.0"), AT("1.2.9"))).toHaveLength(0);
    });

    it("returns [] for || OR range when first alternative matches", () => {
      expect(
        validateOryCMSPluginCompatibility(m("p", "^1.0.0 || ^2.0.0"), AT("1.5.0")),
      ).toHaveLength(0);
    });

    it("returns [] for || OR range when second alternative matches", () => {
      expect(
        validateOryCMSPluginCompatibility(m("p", "^1.0.0 || ^2.0.0"), AT("2.3.0")),
      ).toHaveLength(0);
    });

    it("returns [] for compound AND range when both constraints pass", () => {
      expect(validateOryCMSPluginCompatibility(m("p", ">=1.0.0 <2.0.0"), AT("1.5.0"))).toHaveLength(
        0,
      );
    });

    it("returns [] when allowUndeclared=true and no compatibility declared", () => {
      expect(
        validateOryCMSPluginCompatibility(m("p"), {
          oryCMSVersion: "1.0.0",
          allowUndeclared: true,
        }),
      ).toHaveLength(0);
    });
  });

  describe("Incompatible cases", () => {
    it("returns VERSION_INCOMPATIBLE when ^ major mismatch", () => {
      const [err] = validateOryCMSPluginCompatibility(m("p", "^1.0.0"), AT("2.0.0"));
      expect(err.code).toBe("VERSION_INCOMPATIBLE");
      expect(err.required).toBe("^1.0.0");
      expect(err.found).toBe("2.0.0");
    });

    it("returns VERSION_INCOMPATIBLE when ~ minor mismatch", () => {
      const [err] = validateOryCMSPluginCompatibility(m("p", "~1.2.0"), AT("1.3.0"));
      expect(err.code).toBe("VERSION_INCOMPATIBLE");
    });

    it("returns VERSION_INCOMPATIBLE when >= not satisfied", () => {
      const [err] = validateOryCMSPluginCompatibility(m("p", ">=3.0.0"), AT("2.9.9"));
      expect(err.code).toBe("VERSION_INCOMPATIBLE");
    });

    it("returns VERSION_INCOMPATIBLE when <= not satisfied", () => {
      const [err] = validateOryCMSPluginCompatibility(m("p", "<=1.0.0"), AT("1.0.1"));
      expect(err.code).toBe("VERSION_INCOMPATIBLE");
    });

    it("returns VERSION_INCOMPATIBLE when > not satisfied (equal)", () => {
      const [err] = validateOryCMSPluginCompatibility(m("p", ">2.0.0"), AT("2.0.0"));
      expect(err.code).toBe("VERSION_INCOMPATIBLE");
    });

    it("returns VERSION_INCOMPATIBLE when < not satisfied (equal)", () => {
      const [err] = validateOryCMSPluginCompatibility(m("p", "<2.0.0"), AT("2.0.0"));
      expect(err.code).toBe("VERSION_INCOMPATIBLE");
    });

    it("returns VERSION_INCOMPATIBLE when exact version mismatches", () => {
      const [err] = validateOryCMSPluginCompatibility(m("p", "1.2.3"), AT("1.2.4"));
      expect(err.code).toBe("VERSION_INCOMPATIBLE");
    });

    it("returns VERSION_INCOMPATIBLE when || neither branch matches", () => {
      const [err] = validateOryCMSPluginCompatibility(m("p", "^1.0.0 || ^2.0.0"), AT("3.0.0"));
      expect(err.code).toBe("VERSION_INCOMPATIBLE");
    });

    it("error message names the plugin, required range, and running version", () => {
      const [err] = validateOryCMSPluginCompatibility(m("my-plugin", "^2.0.0"), AT("1.0.0"));
      expect(err.message).toMatch(/my-plugin/);
      expect(err.message).toMatch(/\^2\.0\.0/);
      expect(err.message).toMatch(/1\.0\.0/);
    });

    it("sets engine to 'orycms'", () => {
      const [err] = validateOryCMSPluginCompatibility(m("p", "^2.0.0"), AT("1.0.0"));
      expect(err.engine).toBe("orycms");
    });
  });

  describe("No compatibility declared", () => {
    it("returns NO_COMPATIBILITY_DECLARED by default (allowUndeclared=false)", () => {
      const [err] = validateOryCMSPluginCompatibility(m("p"), AT("1.0.0"));
      expect(err.code).toBe("NO_COMPATIBILITY_DECLARED");
      expect(err.plugin).toBe("p");
    });

    it("returns [] when allowUndeclared=true", () => {
      expect(
        validateOryCMSPluginCompatibility(m("p"), {
          oryCMSVersion: "1.0.0",
          allowUndeclared: true,
        }),
      ).toHaveLength(0);
    });

    it("treats empty compatibility object same as no declaration", () => {
      const manifest: OryCMSPluginManifest = { ...m("p"), compatibility: {} };
      const [err] = validateOryCMSPluginCompatibility(manifest, AT("1.0.0"));
      expect(err.code).toBe("NO_COMPATIBILITY_DECLARED");
    });

    it("still validates other keys in compatibility but only checks 'orycms'", () => {
      // Other keys in compatibility are stored but not checked by this engine
      const manifest: OryCMSPluginManifest = {
        ...m("p"),
        compatibility: { node: ">=18", orycms: "^1.0.0" },
      };
      expect(validateOryCMSPluginCompatibility(manifest, AT("1.5.0"))).toHaveLength(0);
    });
  });

  describe("Unparseable version", () => {
    it("returns VERSION_UNPARSEABLE when oryCMSVersion is not valid semver", () => {
      const [err] = validateOryCMSPluginCompatibility(m("p", "^1.0.0"), {
        oryCMSVersion: "not-a-version",
      });
      expect(err.code).toBe("VERSION_UNPARSEABLE");
      expect(err.found).toBe("not-a-version");
    });

    it("returns VERSION_UNPARSEABLE for 'latest' string", () => {
      const [err] = validateOryCMSPluginCompatibility(m("p", "^1.0.0"), {
        oryCMSVersion: "latest",
      });
      expect(err.code).toBe("VERSION_UNPARSEABLE");
    });
  });
});

// ── isOryCMSPluginCompatible ──────────────────────────────────────────────────

describe("isOryCMSPluginCompatible", () => {
  it("returns true when compatible", () => {
    expect(isOryCMSPluginCompatible(m("p", "^1.0.0"), AT("1.5.0"))).toBe(true);
  });

  it("returns false when incompatible", () => {
    expect(isOryCMSPluginCompatible(m("p", "^2.0.0"), AT("1.0.0"))).toBe(false);
  });

  it("returns false when no compatibility declared (default)", () => {
    expect(isOryCMSPluginCompatible(m("p"), AT("1.0.0"))).toBe(false);
  });

  it("returns true when no compatibility declared and allowUndeclared=true", () => {
    expect(
      isOryCMSPluginCompatible(m("p"), { oryCMSVersion: "1.0.0", allowUndeclared: true }),
    ).toBe(true);
  });

  it("returns true for wildcard range", () => {
    expect(isOryCMSPluginCompatible(m("p", "*"), AT("0.0.1"))).toBe(true);
  });
});

// ── getOryCMSPluginCompatibilityReport ───────────────────────────────────────

describe("getOryCMSPluginCompatibilityReport", () => {
  it("returns compatible=true and no errors for all-compatible set", () => {
    const report = getOryCMSPluginCompatibilityReport(
      [m("a", "^1.0.0"), m("b", ">=1.0.0")],
      AT("1.5.0"),
    );
    expect(report.compatible).toBe(true);
    expect(report.errors).toHaveLength(0);
  });

  it("returns compatible=false when any plugin fails", () => {
    const report = getOryCMSPluginCompatibilityReport(
      [m("a", "^1.0.0"), m("b", "^2.0.0")],
      AT("1.5.0"),
    );
    expect(report.compatible).toBe(false);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].plugin).toBe("b");
  });

  it("collects errors from all failing plugins", () => {
    const report = getOryCMSPluginCompatibilityReport(
      [m("a", "^3.0.0"), m("b", "^3.0.0"), m("c", "^1.0.0")],
      AT("1.5.0"),
    );
    expect(report.compatible).toBe(false);
    expect(report.errors).toHaveLength(2);
    expect(report.errors.map((e) => e.plugin).sort()).toEqual(["a", "b"]);
  });

  it("returns compatible=true for empty array", () => {
    const report = getOryCMSPluginCompatibilityReport([], AT("1.0.0"));
    expect(report.compatible).toBe(true);
    expect(report.errors).toHaveLength(0);
  });

  it("returns correct shape: { compatible, errors }", () => {
    const report: OryCMSCompatibilityReport = getOryCMSPluginCompatibilityReport(
      [m("p", "^1.0.0")],
      AT("1.0.0"),
    );
    expect(report).toHaveProperty("compatible");
    expect(report).toHaveProperty("errors");
    expect(Array.isArray(report.errors)).toBe(true);
  });

  it("applies allowUndeclared to all plugins in the batch", () => {
    const report = getOryCMSPluginCompatibilityReport([m("a"), m("b")], {
      oryCMSVersion: "1.0.0",
      allowUndeclared: true,
    });
    expect(report.compatible).toBe(true);
  });

  it("reports NO_COMPATIBILITY_DECLARED for undeclared plugins by default", () => {
    const report = getOryCMSPluginCompatibilityReport([m("no-compat")], AT("1.0.0"));
    expect(report.compatible).toBe(false);
    expect(report.errors[0].code).toBe("NO_COMPATIBILITY_DECLARED");
  });

  it("mixed: one compatible, one undeclared, one incompatible", () => {
    const report = getOryCMSPluginCompatibilityReport(
      [m("ok", "^1.0.0"), m("missing"), m("bad", "^2.0.0")],
      AT("1.0.0"),
    );
    expect(report.compatible).toBe(false);
    const codes = report.errors.map((e) => e.code).sort();
    expect(codes).toContain("NO_COMPATIBILITY_DECLARED");
    expect(codes).toContain("VERSION_INCOMPATIBLE");
  });
});
