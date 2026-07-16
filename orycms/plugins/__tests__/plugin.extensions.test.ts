import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearAllOryCMSExtensions,
  clearOryCMSCollectionExtensions,
  clearOryCMSCommands,
  clearOryCMSDashboardWidgets,
  clearOryCMSFieldTypes,
  clearOryCMSNavigationGroups,
  clearOryCMSProviders,
  clearOryCMSSettingsSections,
  clearOryCMSValidators,
  listOryCMSCollectionExtensions,
  listOryCMSCommands,
  listOryCMSDashboardWidgets,
  listOryCMSFieldTypes,
  listOryCMSNavigationGroups,
  listOryCMSProviders,
  listOryCMSSettingsSections,
  listOryCMSValidators,
  registerOryCMSCollectionExtensions,
  registerOryCMSCommands,
  registerOryCMSDashboardWidgets,
  registerOryCMSFieldTypes,
  registerOryCMSNavigationGroups,
  registerOryCMSProviders,
  registerOryCMSSettingsSections,
  registerOryCMSValidators,
  unregisterOryCMSCollectionExtensions,
  unregisterOryCMSCommands,
  unregisterOryCMSDashboardWidgets,
  unregisterOryCMSFieldTypes,
  unregisterOryCMSNavigationGroups,
  unregisterOryCMSProviders,
  unregisterOryCMSSettingsSections,
  unregisterOryCMSValidators,
} from "../plugin.extensions";
import { clearOryCMSPluginRegistry, registerOryCMSPlugin, unregisterOryCMSPlugin } from "@/plugins";
import type { OryCMSPlugin } from "@/plugins";

// ── Helpers ───────────────────────────────────────────────────────────────────

function plugin(id: string, extra: Partial<OryCMSPlugin> = {}): OryCMSPlugin {
  return { id, name: `Plugin ${id}`, version: "1.0.0", ...extra };
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  clearAllOryCMSExtensions();
  clearOryCMSPluginRegistry();
});

afterEach(() => {
  clearAllOryCMSExtensions();
  clearOryCMSPluginRegistry();
});

// ── Factory correctness — full suite on one representative type ───────────────
//
// Every registry uses the same factory; one thorough run covers the shared logic.
// We use field types as the representative.

describe("Field types (representative registry)", () => {
  describe("Registration", () => {
    it("registered items appear in list", () => {
      registerOryCMSFieldTypes("p", [{ id: "rich-text" }]);
      expect(listOryCMSFieldTypes()).toHaveLength(1);
      expect(listOryCMSFieldTypes()[0].id).toBe("rich-text");
    });

    it("stores all provided fields", () => {
      registerOryCMSFieldTypes("p", [{ id: "color", label: "Color Picker", component: null }]);
      expect(listOryCMSFieldTypes()[0]).toMatchObject({ id: "color", label: "Color Picker" });
    });

    it("empty array is a no-op", () => {
      registerOryCMSFieldTypes("p", []);
      expect(listOryCMSFieldTypes()).toHaveLength(0);
    });

    it("empty registration does not block later call for same plugin", () => {
      registerOryCMSFieldTypes("p", []);
      registerOryCMSFieldTypes("p", [{ id: "slider" }]);
      expect(listOryCMSFieldTypes()).toHaveLength(1);
    });

    it("multiple plugins each register items independently", () => {
      registerOryCMSFieldTypes("a", [{ id: "type-a" }]);
      registerOryCMSFieldTypes("b", [{ id: "type-b" }]);
      expect(listOryCMSFieldTypes()).toHaveLength(2);
    });

    it("handler / component is stored but never called", () => {
      const component = { render: () => null };
      registerOryCMSFieldTypes("p", [{ id: "custom", component }]);
      expect(listOryCMSFieldTypes()[0].component).toBe(component);
    });
  });

  describe("Duplicate protection", () => {
    it("throws on cross-plugin duplicate id", () => {
      registerOryCMSFieldTypes("a", [{ id: "dup" }]);
      expect(() => registerOryCMSFieldTypes("b", [{ id: "dup" }])).toThrow(
        'OryCMS field type "dup" is already registered.',
      );
    });

    it("throws on same-plugin re-registration of same id", () => {
      registerOryCMSFieldTypes("p", [{ id: "dup" }]);
      expect(() => registerOryCMSFieldTypes("p", [{ id: "dup" }])).toThrow('"dup"');
    });

    it("throws on intra-batch duplicate and registers nothing", () => {
      expect(() => registerOryCMSFieldTypes("p", [{ id: "x" }, { id: "x" }])).toThrow('"x"');
      expect(listOryCMSFieldTypes()).toHaveLength(0);
    });

    it("freed id can be re-registered after unregister", () => {
      registerOryCMSFieldTypes("p", [{ id: "reusable" }]);
      unregisterOryCMSFieldTypes("p");
      expect(() => registerOryCMSFieldTypes("q", [{ id: "reusable" }])).not.toThrow();
    });
  });

  describe("Ordering", () => {
    it("preserves registration order within a plugin", () => {
      registerOryCMSFieldTypes("p", [{ id: "c" }, { id: "a" }, { id: "b" }]);
      expect(listOryCMSFieldTypes().map((t) => t.id)).toEqual(["c", "a", "b"]);
    });

    it("items from different plugins appear in plugin-registration order", () => {
      registerOryCMSFieldTypes("first", [{ id: "f1" }]);
      registerOryCMSFieldTypes("second", [{ id: "s1" }]);
      expect(listOryCMSFieldTypes().map((t) => t.id)).toEqual(["f1", "s1"]);
    });
  });

  describe("Unregister", () => {
    it("removes only the target plugin's items", () => {
      registerOryCMSFieldTypes("a", [{ id: "type-a" }]);
      registerOryCMSFieldTypes("b", [{ id: "type-b" }]);
      unregisterOryCMSFieldTypes("a");
      const ids = listOryCMSFieldTypes().map((t) => t.id);
      expect(ids).not.toContain("type-a");
      expect(ids).toContain("type-b");
    });

    it("unregistering a plugin that registered nothing is a no-op", () => {
      expect(() => unregisterOryCMSFieldTypes("ghost")).not.toThrow();
    });
  });

  describe("Clear", () => {
    it("clearOryCMSFieldTypes removes all items", () => {
      registerOryCMSFieldTypes("a", [{ id: "x" }]);
      registerOryCMSFieldTypes("b", [{ id: "y" }]);
      clearOryCMSFieldTypes();
      expect(listOryCMSFieldTypes()).toHaveLength(0);
    });

    it("after clear, previously-used ids can be re-registered", () => {
      registerOryCMSFieldTypes("p", [{ id: "color" }]);
      clearOryCMSFieldTypes();
      expect(() => registerOryCMSFieldTypes("p", [{ id: "color" }])).not.toThrow();
    });
  });
});

// ── Spot-checks for the other 7 extension types ───────────────────────────────
//
// Each type uses the same factory; we verify the wiring is correct (right names
// mapped to the right registry instance) rather than re-testing all behaviour.

describe("Collections extension registry", () => {
  it("registers and lists", () => {
    registerOryCMSCollectionExtensions("p", [{ id: "posts" }]);
    expect(listOryCMSCollectionExtensions()[0].id).toBe("posts");
  });
  it("throws on duplicate", () => {
    registerOryCMSCollectionExtensions("a", [{ id: "posts" }]);
    expect(() => registerOryCMSCollectionExtensions("b", [{ id: "posts" }])).toThrow('"posts"');
  });
  it("unregister removes and frees id", () => {
    registerOryCMSCollectionExtensions("p", [{ id: "comments" }]);
    unregisterOryCMSCollectionExtensions("p");
    expect(listOryCMSCollectionExtensions()).toHaveLength(0);
    expect(() => registerOryCMSCollectionExtensions("q", [{ id: "comments" }])).not.toThrow();
  });
  it("clear empties the registry", () => {
    registerOryCMSCollectionExtensions("p", [{ id: "tags" }]);
    clearOryCMSCollectionExtensions();
    expect(listOryCMSCollectionExtensions()).toHaveLength(0);
  });
});

describe("Dashboard widgets registry", () => {
  it("registers, lists, deduplicates, unregisters, clears", () => {
    registerOryCMSDashboardWidgets("p", [{ id: "stats-card" }]);
    expect(listOryCMSDashboardWidgets()[0].id).toBe("stats-card");
    expect(() => registerOryCMSDashboardWidgets("q", [{ id: "stats-card" }])).toThrow(
      '"stats-card"',
    );
    unregisterOryCMSDashboardWidgets("p");
    expect(listOryCMSDashboardWidgets()).toHaveLength(0);
    clearOryCMSDashboardWidgets();
  });
});

describe("Navigation groups registry", () => {
  it("registers, lists, deduplicates, unregisters, clears", () => {
    registerOryCMSNavigationGroups("p", [{ id: "commerce" }]);
    expect(listOryCMSNavigationGroups()[0].id).toBe("commerce");
    expect(() => registerOryCMSNavigationGroups("q", [{ id: "commerce" }])).toThrow('"commerce"');
    unregisterOryCMSNavigationGroups("p");
    expect(listOryCMSNavigationGroups()).toHaveLength(0);
    clearOryCMSNavigationGroups();
  });
});

describe("Settings sections registry", () => {
  it("registers, lists, deduplicates, unregisters, clears", () => {
    registerOryCMSSettingsSections("p", [{ id: "billing" }]);
    expect(listOryCMSSettingsSections()[0].id).toBe("billing");
    expect(() => registerOryCMSSettingsSections("q", [{ id: "billing" }])).toThrow('"billing"');
    unregisterOryCMSSettingsSections("p");
    expect(listOryCMSSettingsSections()).toHaveLength(0);
    clearOryCMSSettingsSections();
  });
});

describe("Commands registry", () => {
  it("registers, lists, deduplicates, unregisters, clears", () => {
    registerOryCMSCommands("p", [{ id: "export-csv" }]);
    expect(listOryCMSCommands()[0].id).toBe("export-csv");
    expect(() => registerOryCMSCommands("q", [{ id: "export-csv" }])).toThrow('"export-csv"');
    unregisterOryCMSCommands("p");
    expect(listOryCMSCommands()).toHaveLength(0);
    clearOryCMSCommands();
  });
});

describe("Providers registry", () => {
  it("registers, lists, deduplicates, unregisters, clears", () => {
    registerOryCMSProviders("p", [{ id: "openai" }]);
    expect(listOryCMSProviders()[0].id).toBe("openai");
    expect(() => registerOryCMSProviders("q", [{ id: "openai" }])).toThrow('"openai"');
    unregisterOryCMSProviders("p");
    expect(listOryCMSProviders()).toHaveLength(0);
    clearOryCMSProviders();
  });
});

describe("Validators registry", () => {
  it("registers, lists, deduplicates, unregisters, clears", () => {
    registerOryCMSValidators("p", [{ id: "url-format" }]);
    expect(listOryCMSValidators()[0].id).toBe("url-format");
    expect(() => registerOryCMSValidators("q", [{ id: "url-format" }])).toThrow('"url-format"');
    unregisterOryCMSValidators("p");
    expect(listOryCMSValidators()).toHaveLength(0);
    clearOryCMSValidators();
  });
});

// ── clearAllOryCMSExtensions ──────────────────────────────────────────────────

describe("clearAllOryCMSExtensions", () => {
  it("clears all 8 registries at once", () => {
    registerOryCMSFieldTypes("p", [{ id: "ft" }]);
    registerOryCMSCollectionExtensions("p", [{ id: "col" }]);
    registerOryCMSDashboardWidgets("p", [{ id: "dw" }]);
    registerOryCMSNavigationGroups("p", [{ id: "ng" }]);
    registerOryCMSSettingsSections("p", [{ id: "ss" }]);
    registerOryCMSCommands("p", [{ id: "cmd" }]);
    registerOryCMSProviders("p", [{ id: "prov" }]);
    registerOryCMSValidators("p", [{ id: "val" }]);

    clearAllOryCMSExtensions();

    expect(listOryCMSFieldTypes()).toHaveLength(0);
    expect(listOryCMSCollectionExtensions()).toHaveLength(0);
    expect(listOryCMSDashboardWidgets()).toHaveLength(0);
    expect(listOryCMSNavigationGroups()).toHaveLength(0);
    expect(listOryCMSSettingsSections()).toHaveLength(0);
    expect(listOryCMSCommands()).toHaveLength(0);
    expect(listOryCMSProviders()).toHaveLength(0);
    expect(listOryCMSValidators()).toHaveLength(0);
  });
});

// ── Plugin lifecycle integration ──────────────────────────────────────────────

describe("Plugin lifecycle integration", () => {
  it("registerOryCMSPlugin auto-registers all extension types declared in plugin.extensions", () => {
    registerOryCMSPlugin(
      plugin("tools", {
        extensions: {
          collections: [{ id: "announcements" }],
          fieldTypes: [{ id: "star-rating" }],
          dashboardWidgets: [{ id: "kpi-card" }],
          navigationGroups: [{ id: "platform" }],
          settingsSections: [{ id: "integrations" }],
          commands: [{ id: "export-pdf" }],
          providers: [{ id: "stripe" }],
          validators: [{ id: "credit-card" }],
        },
      }),
    );

    expect(listOryCMSCollectionExtensions()[0].id).toBe("announcements");
    expect(listOryCMSFieldTypes()[0].id).toBe("star-rating");
    expect(listOryCMSDashboardWidgets()[0].id).toBe("kpi-card");
    expect(listOryCMSNavigationGroups()[0].id).toBe("platform");
    expect(listOryCMSSettingsSections()[0].id).toBe("integrations");
    expect(listOryCMSCommands()[0].id).toBe("export-pdf");
    expect(listOryCMSProviders()[0].id).toBe("stripe");
    expect(listOryCMSValidators()[0].id).toBe("credit-card");
  });

  it("unregisterOryCMSPlugin removes all extension types registered by that plugin", () => {
    registerOryCMSPlugin(
      plugin("tools", {
        extensions: {
          fieldTypes: [{ id: "star-rating" }],
          commands: [{ id: "export-pdf" }],
        },
      }),
    );
    unregisterOryCMSPlugin("tools");

    expect(listOryCMSFieldTypes()).toHaveLength(0);
    expect(listOryCMSCommands()).toHaveLength(0);
  });

  it("unregistering one plugin does not remove another plugin's extensions", () => {
    registerOryCMSPlugin(plugin("a", { extensions: { fieldTypes: [{ id: "type-a" }] } }));
    registerOryCMSPlugin(plugin("b", { extensions: { fieldTypes: [{ id: "type-b" }] } }));
    unregisterOryCMSPlugin("a");

    const ids = listOryCMSFieldTypes().map((t) => t.id);
    expect(ids).not.toContain("type-a");
    expect(ids).toContain("type-b");
  });

  it("clearOryCMSPluginRegistry removes extensions for all plugins", () => {
    registerOryCMSPlugin(plugin("a", { extensions: { validators: [{ id: "v-a" }] } }));
    registerOryCMSPlugin(plugin("b", { extensions: { validators: [{ id: "v-b" }] } }));
    clearOryCMSPluginRegistry();

    expect(listOryCMSValidators()).toHaveLength(0);
  });

  it("reload: unregister then re-register produces exactly one copy of extensions", () => {
    registerOryCMSPlugin(plugin("seo", { extensions: { commands: [{ id: "analyze" }] } }));
    unregisterOryCMSPlugin("seo");
    registerOryCMSPlugin(plugin("seo", { extensions: { commands: [{ id: "analyze" }] } }));

    expect(listOryCMSCommands()).toHaveLength(1);
  });

  it("plugin without extensions registers without touching extension registries", () => {
    registerOryCMSPlugin(plugin("no-ext"));
    expect(listOryCMSFieldTypes()).toHaveLength(0);
    expect(listOryCMSCommands()).toHaveLength(0);
  });

  it("extensions are never executed during plugin registration", () => {
    let executed = false;
    registerOryCMSPlugin(
      plugin("passive", {
        extensions: {
          providers: [
            {
              id: "lazy-provider",
              factory: () => {
                executed = true;
              },
            },
          ],
        },
      }),
    );
    expect(executed).toBe(false);
  });
});
