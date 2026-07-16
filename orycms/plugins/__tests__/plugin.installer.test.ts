import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearOryCMSInstallerForTests,
  disableOryCMSPlugin,
  enableOryCMSPlugin,
  installOryCMSPlugin,
  listInstalledOryCMSPlugins,
  uninstallOryCMSPlugin,
} from "../plugin.installer";
import type { OryCMSPluginManifest } from "../plugin.manifest";
import { clearOryCMSPluginRegistry, hasOryCMSPlugin } from "@/plugins";
import type { OryCMSPlugin } from "@/plugins";

// ── Helpers ───────────────────────────────────────────────────────────────────

function p(id: string, extra: Partial<OryCMSPlugin> = {}): OryCMSPlugin {
  return { id, name: id, version: "1.0.0", ...extra };
}

function mf(id: string, extra: Partial<OryCMSPluginManifest> = {}): OryCMSPluginManifest {
  return { id, name: id, version: "1.0.0", ...extra };
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  clearOryCMSInstallerForTests();
  clearOryCMSPluginRegistry();
});

afterEach(() => {
  clearOryCMSInstallerForTests();
  clearOryCMSPluginRegistry();
});

// ── installOryCMSPlugin ───────────────────────────────────────────────────────

describe("installOryCMSPlugin", () => {
  describe("Success cases", () => {
    it("returns status=installed for a valid plugin", () => {
      const result = installOryCMSPlugin(p("seo"));
      expect(result.status).toBe("installed");
      expect(result.plugin?.id).toBe("seo");
    });

    it("registers the plugin in the plugin registry", () => {
      installOryCMSPlugin(p("seo"));
      expect(hasOryCMSPlugin("seo")).toBe(true);
    });

    it("adds the plugin to the installed list", () => {
      installOryCMSPlugin(p("seo"));
      const list = listInstalledOryCMSPlugins();
      expect(list).toHaveLength(1);
      expect(list[0].plugin.id).toBe("seo");
    });

    it("marks a freshly installed plugin as enabled", () => {
      installOryCMSPlugin(p("seo"));
      expect(listInstalledOryCMSPlugins()[0].enabled).toBe(true);
    });

    it("records an installedAt ISO timestamp", () => {
      installOryCMSPlugin(p("seo"));
      const { installedAt } = listInstalledOryCMSPlugins()[0];
      expect(new Date(installedAt).toString()).not.toBe("Invalid Date");
    });

    it("does not execute hooks during installation", () => {
      let hookRan = false;
      installOryCMSPlugin(
        p("seo", {
          hooks: {
            beforeCreate: () => {
              hookRan = true;
            },
          },
        }),
      );
      expect(hookRan).toBe(false);
    });

    it("allows installing multiple distinct plugins", () => {
      installOryCMSPlugin(p("a"));
      installOryCMSPlugin(p("b"));
      expect(listInstalledOryCMSPlugins()).toHaveLength(2);
    });

    it("accepts optional description and author fields", () => {
      const result = installOryCMSPlugin(
        p("rich", { description: "A rich plugin", author: { name: "Alice" } }),
      );
      expect(result.status).toBe("installed");
    });
  });

  describe("Validation failures", () => {
    it("returns status=failed for a plugin with empty id", () => {
      const result = installOryCMSPlugin({ id: "", name: "Bad", version: "1.0.0" });
      expect(result.status).toBe("failed");
      expect(result.validationErrors?.length).toBeGreaterThan(0);
    });

    it("returns status=failed for a plugin with missing name", () => {
      const result = installOryCMSPlugin({ id: "p", name: "", version: "1.0.0" });
      expect(result.status).toBe("failed");
    });

    it("does NOT register an invalid plugin", () => {
      installOryCMSPlugin({ id: "", name: "Bad", version: "1.0.0" });
      // empty-string id can't be looked up; just verify installer list is empty
      expect(listInstalledOryCMSPlugins()).toHaveLength(0);
    });

    it("populates validationErrors with descriptive messages", () => {
      const result = installOryCMSPlugin({ id: "", name: "Bad", version: "1.0.0" });
      expect(result.validationErrors).toBeDefined();
      expect(result.validationErrors![0]).toMatch(/id/i);
    });

    it("returns status=failed when plugin is already installed", () => {
      installOryCMSPlugin(p("seo"));
      const second = installOryCMSPlugin(p("seo"));
      expect(second.status).toBe("failed");
      expect(second.reason).toMatch(/already installed/i);
    });

    it("does not duplicate registry entry on second install", () => {
      installOryCMSPlugin(p("seo"));
      installOryCMSPlugin(p("seo"));
      expect(listInstalledOryCMSPlugins()).toHaveLength(1);
    });
  });

  describe("Compatibility check", () => {
    it("passes when no manifest is supplied (no compatibility check)", () => {
      const result = installOryCMSPlugin(p("no-compat"));
      expect(result.status).toBe("installed");
    });

    it("passes when compatibility range is satisfied", () => {
      const result = installOryCMSPlugin(p("ok-compat"), {
        oryCMSVersion: "1.0.0",
        manifest: mf("ok-compat", { compatibility: { orycms: "*" } }),
      });
      expect(result.status).toBe("installed");
    });

    it("fails when compatibility range is not satisfied", () => {
      const result = installOryCMSPlugin(p("bad-compat"), {
        oryCMSVersion: "1.0.0",
        manifest: mf("bad-compat", { compatibility: { orycms: "^99.0.0" } }),
      });
      expect(result.status).toBe("failed");
      expect(result.validationErrors?.some((e) => /99\.0\.0/.test(e))).toBe(true);
    });

    it("skips compatibility check when skipCompatibilityCheck=true", () => {
      const result = installOryCMSPlugin(p("no-check"), {
        skipCompatibilityCheck: true,
        oryCMSVersion: "1.0.0",
        manifest: mf("no-check", { compatibility: { orycms: "^99.0.0" } }),
      });
      expect(result.status).toBe("installed");
    });
  });

  describe("Dependency check", () => {
    it("passes when dependencies are already installed", () => {
      installOryCMSPlugin(p("core"));
      const result = installOryCMSPlugin(p("app"), {
        manifest: mf("app", { dependencies: { core: "^1.0.0" } }),
      });
      expect(result.status).toBe("installed");
    });

    it("fails when a required dependency is missing", () => {
      const result = installOryCMSPlugin(p("app"), {
        manifest: mf("app", { dependencies: { "missing-core": "^1.0.0" } }),
      });
      expect(result.status).toBe("failed");
      expect(result.validationErrors?.some((e) => /missing-core/.test(e))).toBe(true);
    });

    it("skips dependency check when skipDependencyCheck=true", () => {
      const result = installOryCMSPlugin(p("app"), {
        skipDependencyCheck: true,
        manifest: mf("app", { dependencies: { "missing-core": "^1.0.0" } }),
      });
      expect(result.status).toBe("installed");
    });

    it("reports INCOMPATIBLE_VERSION when installed dep has wrong version", () => {
      installOryCMSPlugin(p("lib")); // lib version 1.0.0
      const result = installOryCMSPlugin(p("app"), {
        manifest: mf("app", { dependencies: { lib: "^2.0.0" } }),
      });
      expect(result.status).toBe("failed");
      expect(result.validationErrors?.some((e) => /lib/.test(e))).toBe(true);
    });
  });
});

// ── uninstallOryCMSPlugin ─────────────────────────────────────────────────────

describe("uninstallOryCMSPlugin", () => {
  it("returns status=uninstalled for an installed plugin", () => {
    installOryCMSPlugin(p("seo"));
    const result = uninstallOryCMSPlugin("seo");
    expect(result.status).toBe("uninstalled");
    expect(result.plugin?.id).toBe("seo");
  });

  it("removes the plugin from the registry", () => {
    installOryCMSPlugin(p("seo"));
    uninstallOryCMSPlugin("seo");
    expect(hasOryCMSPlugin("seo")).toBe(false);
  });

  it("removes the plugin from the installed list", () => {
    installOryCMSPlugin(p("seo"));
    uninstallOryCMSPlugin("seo");
    expect(listInstalledOryCMSPlugins()).toHaveLength(0);
  });

  it("returns status=failed for a plugin that is not installed", () => {
    const result = uninstallOryCMSPlugin("ghost");
    expect(result.status).toBe("failed");
    expect(result.reason).toMatch(/not installed/i);
  });

  it("allows reinstallation after uninstall", () => {
    installOryCMSPlugin(p("seo"));
    uninstallOryCMSPlugin("seo");
    const result = installOryCMSPlugin(p("seo"));
    expect(result.status).toBe("installed");
  });

  it("does not affect other installed plugins", () => {
    installOryCMSPlugin(p("a"));
    installOryCMSPlugin(p("b"));
    uninstallOryCMSPlugin("a");
    expect(listInstalledOryCMSPlugins()).toHaveLength(1);
    expect(listInstalledOryCMSPlugins()[0].plugin.id).toBe("b");
    expect(hasOryCMSPlugin("b")).toBe(true);
  });
});

// ── disableOryCMSPlugin ───────────────────────────────────────────────────────

describe("disableOryCMSPlugin", () => {
  it("returns status=disabled for an enabled plugin", () => {
    installOryCMSPlugin(p("seo"));
    const result = disableOryCMSPlugin("seo");
    expect(result.status).toBe("disabled");
    expect(result.plugin?.id).toBe("seo");
  });

  it("removes the plugin from the registry when disabled", () => {
    installOryCMSPlugin(p("seo"));
    disableOryCMSPlugin("seo");
    expect(hasOryCMSPlugin("seo")).toBe(false);
  });

  it("marks the plugin as disabled in the installed list", () => {
    installOryCMSPlugin(p("seo"));
    disableOryCMSPlugin("seo");
    expect(listInstalledOryCMSPlugins()[0].enabled).toBe(false);
  });

  it("keeps the plugin in the installed list after disabling", () => {
    installOryCMSPlugin(p("seo"));
    disableOryCMSPlugin("seo");
    expect(listInstalledOryCMSPlugins()).toHaveLength(1);
  });

  it("returns status=failed for an already disabled plugin", () => {
    installOryCMSPlugin(p("seo"));
    disableOryCMSPlugin("seo");
    const result = disableOryCMSPlugin("seo");
    expect(result.status).toBe("failed");
    expect(result.reason).toMatch(/already disabled/i);
  });

  it("returns status=failed for a plugin that is not installed", () => {
    const result = disableOryCMSPlugin("ghost");
    expect(result.status).toBe("failed");
    expect(result.reason).toMatch(/not installed/i);
  });

  it("does not affect other plugins when one is disabled", () => {
    installOryCMSPlugin(p("a"));
    installOryCMSPlugin(p("b"));
    disableOryCMSPlugin("a");
    expect(hasOryCMSPlugin("b")).toBe(true);
    expect(listInstalledOryCMSPlugins().find((e) => e.plugin.id === "b")?.enabled).toBe(true);
  });
});

// ── enableOryCMSPlugin ────────────────────────────────────────────────────────

describe("enableOryCMSPlugin", () => {
  it("returns status=enabled for a disabled plugin", () => {
    installOryCMSPlugin(p("seo"));
    disableOryCMSPlugin("seo");
    const result = enableOryCMSPlugin("seo");
    expect(result.status).toBe("enabled");
    expect(result.plugin?.id).toBe("seo");
  });

  it("re-registers the plugin in the registry on enable", () => {
    installOryCMSPlugin(p("seo"));
    disableOryCMSPlugin("seo");
    enableOryCMSPlugin("seo");
    expect(hasOryCMSPlugin("seo")).toBe(true);
  });

  it("marks the plugin as enabled in the installed list", () => {
    installOryCMSPlugin(p("seo"));
    disableOryCMSPlugin("seo");
    enableOryCMSPlugin("seo");
    expect(listInstalledOryCMSPlugins()[0].enabled).toBe(true);
  });

  it("returns status=failed for an already enabled plugin", () => {
    installOryCMSPlugin(p("seo"));
    const result = enableOryCMSPlugin("seo");
    expect(result.status).toBe("failed");
    expect(result.reason).toMatch(/already enabled/i);
  });

  it("returns status=failed for a plugin that is not installed", () => {
    const result = enableOryCMSPlugin("ghost");
    expect(result.status).toBe("failed");
    expect(result.reason).toMatch(/not installed/i);
  });

  it("disable → enable → disable round-trip leaves plugin in correct state", () => {
    installOryCMSPlugin(p("seo"));
    disableOryCMSPlugin("seo");
    enableOryCMSPlugin("seo");
    disableOryCMSPlugin("seo");
    expect(listInstalledOryCMSPlugins()[0].enabled).toBe(false);
    expect(hasOryCMSPlugin("seo")).toBe(false);
  });
});

// ── listInstalledOryCMSPlugins ────────────────────────────────────────────────

describe("listInstalledOryCMSPlugins", () => {
  it("returns an empty array when nothing is installed", () => {
    expect(listInstalledOryCMSPlugins()).toHaveLength(0);
  });

  it("returns one entry per installed plugin", () => {
    installOryCMSPlugin(p("a"));
    installOryCMSPlugin(p("b"));
    installOryCMSPlugin(p("c"));
    expect(listInstalledOryCMSPlugins()).toHaveLength(3);
  });

  it("each entry has plugin, enabled, and installedAt fields", () => {
    installOryCMSPlugin(p("seo"));
    const [entry] = listInstalledOryCMSPlugins();
    expect(entry).toHaveProperty("plugin");
    expect(entry).toHaveProperty("enabled");
    expect(entry).toHaveProperty("installedAt");
  });

  it("reflects mixed enabled/disabled states", () => {
    installOryCMSPlugin(p("a"));
    installOryCMSPlugin(p("b"));
    disableOryCMSPlugin("a");
    const list = listInstalledOryCMSPlugins();
    const a = list.find((e) => e.plugin.id === "a")!;
    const b = list.find((e) => e.plugin.id === "b")!;
    expect(a.enabled).toBe(false);
    expect(b.enabled).toBe(true);
  });
});

// ── clearOryCMSInstallerForTests ──────────────────────────────────────────────

describe("clearOryCMSInstallerForTests", () => {
  it("wipes all installer state between tests", () => {
    installOryCMSPlugin(p("seo"));
    clearOryCMSInstallerForTests();
    expect(listInstalledOryCMSPlugins()).toHaveLength(0);
  });
});
