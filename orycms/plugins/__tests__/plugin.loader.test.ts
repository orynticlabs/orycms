import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearLoadedOryCMSPluginsForTests,
  clearOryCMSPluginRegistry,
  getOryCMSPlugin,
  hasOryCMSPlugin,
  listLoadedOryCMSPlugins,
  listOryCMSPlugins,
  loadOryCMSPlugin,
  loadOryCMSPlugins,
  registerOryCMSPlugin,
  reloadOryCMSPlugins,
  unloadOryCMSPlugin,
} from "@/plugins";
import { resetOryCMSConfigCacheForTests } from "@/config";

const tempDirs: string[] = [];

afterEach(async () => {
  clearLoadedOryCMSPluginsForTests();
  clearOryCMSPluginRegistry();
  resetOryCMSConfigCacheForTests();

  await Promise.all(
    tempDirs.splice(0).map((dir) =>
      rm(dir, {
        force: true,
        recursive: true,
      }),
    ),
  );
});

describe("OryCMS plugin loader", () => {
  it("loads enabled plugins from configuration and registers them", async () => {
    const config = await createConfig(`
      export default {
        plugins: {
          enabled: true,
          entries: [
            {
              id: "seo-tools",
              name: "SEO Tools",
              version: "1.0.0"
            }
          ]
        }
      };
    `);

    const result = await loadOryCMSPlugins({
      config,
    });

    expect(result.loaded).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
    expect(hasOryCMSPlugin("seo-tools")).toBe(true);
    expect(getOryCMSPlugin("seo-tools")?.name).toBe("SEO Tools");
    expect(listLoadedOryCMSPlugins()).toHaveLength(1);
  });

  it("skips all configured plugins when plugin loading is globally disabled", async () => {
    const config = await createConfig(`
      export default {
        plugins: {
          enabled: false,
          entries: [
            {
              id: "seo-tools",
              name: "SEO Tools",
              version: "1.0.0"
            }
          ]
        }
      };
    `);

    const result = await loadOryCMSPlugins({
      config,
    });

    expect(result.loaded).toHaveLength(0);
    expect(result.skipped).toEqual([
      expect.objectContaining({
        id: "seo-tools",
        reason: "Plugin loading is disabled in OryCMS configuration.",
      }),
    ]);
    expect(hasOryCMSPlugin("seo-tools")).toBe(false);
  });

  it("supports disabled state per plugin without registering disabled plugins", async () => {
    const config = await createConfig(`
      export default {
        plugins: {
          enabled: true,
          entries: [
            {
              enabled: false,
              plugin: {
                id: "disabled-plugin",
                name: "Disabled Plugin",
                version: "1.0.0"
              }
            }
          ]
        }
      };
    `);

    const result = await loadOryCMSPlugins({
      config,
    });

    expect(result.loaded).toHaveLength(0);
    expect(result.skipped).toEqual([
      expect.objectContaining({
        id: "disabled-plugin",
        reason: 'OryCMS plugin "disabled-plugin" is disabled in configuration.',
      }),
    ]);
    expect(hasOryCMSPlugin("disabled-plugin")).toBe(false);
    expect(listLoadedOryCMSPlugins()).toEqual([]);
  });

  it("prevents duplicate loading through the loader cache", async () => {
    const config = await createConfig(`
      export default {
        plugins: {
          enabled: true,
          entries: [
            {
              id: "seo-tools",
              name: "SEO Tools",
              version: "1.0.0"
            }
          ]
        }
      };
    `);

    const firstResult = await loadOryCMSPlugins({
      config,
    });
    const secondResult = await loadOryCMSPlugins({
      config,
    });

    expect(firstResult.loaded).toHaveLength(1);
    expect(secondResult.loaded).toHaveLength(0);
    expect(secondResult.skipped).toEqual([
      expect.objectContaining({
        id: "seo-tools",
        reason: 'OryCMS plugin "seo-tools" is already loaded.',
      }),
    ]);
    expect(listOryCMSPlugins()).toHaveLength(1);
  });

  it("returns failed results for invalid configured plugins", async () => {
    const config = await createConfig(`
      export default {
        plugins: {
          enabled: true,
          entries: [
            {
              id: "",
              name: "Broken Plugin",
              version: "1.0.0"
            }
          ]
        }
      };
    `);

    const result = await loadOryCMSPlugins({
      config,
    });

    expect(result.loaded).toHaveLength(0);
    expect(result.failed).toEqual([
      expect.objectContaining({
        id: "",
        status: "failed",
      }),
    ]);
    expect(result.failed[0]?.error?.message).toBe("plugin.id must be a non-empty string.");
  });

  it("loads a single configured plugin by id", async () => {
    const config = await createConfig(`
      export default {
        plugins: {
          enabled: true,
          entries: [
            {
              id: "seo-tools",
              name: "SEO Tools",
              version: "1.0.0"
            },
            {
              id: "analytics-tools",
              name: "Analytics Tools",
              version: "1.0.0"
            }
          ]
        }
      };
    `);

    const result = await loadOryCMSPlugin("analytics-tools", {
      config,
    });

    expect(result.status).toBe("loaded");
    expect(hasOryCMSPlugin("analytics-tools")).toBe(true);
    expect(hasOryCMSPlugin("seo-tools")).toBe(false);
  });

  it("returns a descriptive failure when a single plugin is not configured", async () => {
    const config = await createConfig(`
      export default {
        plugins: {
          enabled: true,
          entries: []
        }
      };
    `);

    const result = await loadOryCMSPlugin("missing-plugin", {
      config,
    });

    expect(result.status).toBe("failed");
    expect(result.error?.message).toBe(
      'OryCMS plugin "missing-plugin" was not found in configuration.',
    );
  });

  it("unloads plugins from both loader cache and registry", async () => {
    const config = await createConfig(`
      export default {
        plugins: {
          enabled: true,
          entries: [
            {
              id: "seo-tools",
              name: "SEO Tools",
              version: "1.0.0"
            }
          ]
        }
      };
    `);

    await loadOryCMSPlugins({
      config,
    });

    const result = unloadOryCMSPlugin("seo-tools");

    expect(result.status).toBe("unloaded");
    expect(hasOryCMSPlugin("seo-tools")).toBe(false);
    expect(listLoadedOryCMSPlugins()).toEqual([]);
  });

  it("reloads plugins from fresh configuration", async () => {
    const configPath = await createConfigFile(`
      export default {
        plugins: {
          enabled: true,
          entries: [
            {
              id: "seo-tools",
              name: "SEO Tools",
              version: "1.0.0"
            }
          ]
        }
      };
    `);

    await loadOryCMSPlugins({
      config: configPath,
    });

    await writeFile(
      configPath.configPath,
      `
        export default {
          plugins: {
            enabled: true,
            entries: [
              {
                id: "analytics-tools",
                name: "Analytics Tools",
                version: "1.0.0"
              }
            ]
          }
        };
      `,
    );

    const result = await reloadOryCMSPlugins({
      config: configPath,
    });

    expect(result.loaded).toEqual([
      expect.objectContaining({
        id: "analytics-tools",
      }),
    ]);
    expect(hasOryCMSPlugin("seo-tools")).toBe(false);
    expect(hasOryCMSPlugin("analytics-tools")).toBe(true);
  });

  it("does not execute plugin hooks, routes, pages, collections, or settings while loading", async () => {
    const hook = vi.fn();
    const handler = vi.fn();
    const component = vi.fn();

    const config = await createConfigFromObject({
      plugins: {
        enabled: true,
        entries: [
          {
            id: "runtime-surfaces",
            name: "Runtime Surfaces",
            version: "1.0.0",
            hooks: {
              afterCreate: hook,
            },
            routes: [
              {
                path: "/api/runtime-surfaces",
                handler,
              },
            ],
            pages: [
              {
                id: "runtime-surfaces",
                title: "Runtime Surfaces",
                path: "/plugins/runtime-surfaces",
                component,
              },
            ],
            sidebar: [
              {
                id: "runtime-surfaces",
                label: "Runtime Surfaces",
              },
            ],
            collections: [
              {
                name: "Plugin Doc",
                slug: "plugin-docs",
                labels: {
                  singular: "Plugin Doc",
                  plural: "Plugin Docs",
                },
                fields: [
                  {
                    name: "title",
                    type: "text",
                  },
                ],
              },
            ],
            settings: [
              {
                key: "enabled",
                label: "Enabled",
                type: "boolean",
              },
            ],
          },
        ],
      },
    });

    const result = await loadOryCMSPlugins({
      config,
    });

    expect(result.loaded).toHaveLength(1);
    expect(hook).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
    expect(component).not.toHaveBeenCalled();
  });

  it("skips registration when a plugin id is already present in the registry", async () => {
    registerOryCMSPlugin({
      id: "seo-tools",
      name: "Existing SEO Tools",
      version: "1.0.0",
    });

    const config = await createConfig(`
      export default {
        plugins: {
          enabled: true,
          entries: [
            {
              id: "seo-tools",
              name: "SEO Tools",
              version: "1.0.0"
            }
          ]
        }
      };
    `);

    const result = await loadOryCMSPlugins({
      config,
    });

    expect(result.loaded).toHaveLength(0);
    expect(result.skipped).toEqual([
      expect.objectContaining({
        id: "seo-tools",
        reason: 'OryCMS plugin "seo-tools" is already registered.',
      }),
    ]);
    expect(getOryCMSPlugin("seo-tools")?.name).toBe("Existing SEO Tools");
  });
});

async function createConfig(source: string) {
  return createConfigFile(source);
}

async function createConfigFromObject(config: unknown) {
  const key = `__orycmsPluginLoaderConfig${Date.now()}${Math.random().toString(16).slice(2)}`;
  Reflect.set(globalThis, key, config);

  return createConfigFile(`export default globalThis.${key};`);
}

async function createConfigFile(source: string) {
  const cwd = await mkdtemp(join(tmpdir(), "orycms-plugin-loader-"));
  const configPath = join(cwd, "orycms.config.mjs");

  tempDirs.push(cwd);
  await writeFile(configPath, source);

  return {
    cwd,
    configPath,
    bypassCache: true,
  };
}
