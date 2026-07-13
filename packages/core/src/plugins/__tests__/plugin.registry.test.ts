import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearOryCMSPluginRegistry,
  defineOryCMSPlugin,
  getOryCMSPlugin,
  hasOryCMSPlugin,
  listOryCMSPlugins,
  OryCMSPluginError,
  registerOryCMSPlugin,
  unregisterOryCMSPlugin,
} from "@/plugins";
import type { OryCMSPlugin } from "@/plugins";

afterEach(() => {
  clearOryCMSPluginRegistry();
});

describe("OryCMS plugin registry", () => {
  it("defines a typed plugin without registering it", () => {
    const plugin = defineOryCMSPlugin(createPlugin());

    expect(plugin.id).toBe("seo-tools");
    expect(hasOryCMSPlugin("seo-tools")).toBe(false);
    expect(listOryCMSPlugins()).toEqual([]);
  });

  it("registers, retrieves, lists, and checks plugins by id", () => {
    const plugin = createPlugin();

    const registered = registerOryCMSPlugin(plugin);

    expect(registered).toBe(plugin);
    expect(getOryCMSPlugin("seo-tools")).toBe(plugin);
    expect(hasOryCMSPlugin("seo-tools")).toBe(true);
    expect(listOryCMSPlugins()).toEqual([plugin]);
  });

  it("unregisters plugins by id", () => {
    registerOryCMSPlugin(createPlugin());

    expect(unregisterOryCMSPlugin("seo-tools")).toBe(true);
    expect(unregisterOryCMSPlugin("seo-tools")).toBe(false);
    expect(getOryCMSPlugin("seo-tools")).toBeUndefined();
    expect(listOryCMSPlugins()).toEqual([]);
  });

  it("rejects duplicate plugin ids with a descriptive error", () => {
    registerOryCMSPlugin(createPlugin());

    expect(() => registerOryCMSPlugin(createPlugin())).toThrow(OryCMSPluginError);
    expect(() => registerOryCMSPlugin(createPlugin())).toThrow(
      'OryCMS plugin "seo-tools" is already registered.',
    );
  });

  it("rejects invalid plugin definitions", () => {
    expect(() =>
      defineOryCMSPlugin({
        id: "",
        name: "Broken Plugin",
        version: "1.0.0",
      }),
    ).toThrow("plugin.id must be a non-empty string.");

    expect(() =>
      defineOryCMSPlugin({
        id: "broken",
        name: "Broken Plugin",
        version: "1.0.0",
        routes: [{ method: "GET" } as never],
      }),
    ).toThrow("plugin.routes[0].path must be a non-empty string.");

    expect(() =>
      defineOryCMSPlugin({
        id: "broken",
        name: "Broken Plugin",
        version: "1.0.0",
        config: [] as never,
      }),
    ).toThrow("plugin.config must be an object.");
  });

  it("supports all future plugin extension surfaces without executing them", () => {
    const hook = vi.fn();
    const routeHandler = vi.fn();
    const pageComponent = vi.fn();
    const plugin = createPlugin({
      collections: [
        {
          name: "Announcement",
          slug: "announcements",
          labels: {
            singular: "Announcement",
            plural: "Announcements",
          },
          fields: [
            {
              name: "title",
              type: "text",
              required: true,
            },
          ],
        },
      ],
      hooks: {
        afterCreate: hook,
      },
      routes: [
        {
          path: "/api/plugin/seo-tools",
          method: "GET",
          handler: routeHandler,
        },
      ],
      sidebar: [
        {
          id: "seo-tools",
          label: "SEO Tools",
          href: "/plugins/seo-tools",
        },
      ],
      pages: [
        {
          id: "seo-dashboard",
          title: "SEO Dashboard",
          path: "/plugins/seo-tools",
          component: pageComponent,
        },
      ],
      settings: [
        {
          key: "enabled",
          label: "Enabled",
          type: "boolean",
          defaultValue: true,
        },
      ],
      permissions: [
        {
          key: "seo.manage",
          label: "Manage SEO",
        },
      ],
      config: {
        enabled: true,
      },
    });

    registerOryCMSPlugin(plugin);

    expect(getOryCMSPlugin("seo-tools")).toMatchObject({
      id: "seo-tools",
      name: "SEO Tools",
      version: "1.0.0",
    });
    expect(hook).not.toHaveBeenCalled();
    expect(routeHandler).not.toHaveBeenCalled();
    expect(pageComponent).not.toHaveBeenCalled();
  });
});

function createPlugin(overrides: Partial<OryCMSPlugin> = {}): OryCMSPlugin {
  return {
    id: "seo-tools",
    name: "SEO Tools",
    version: "1.0.0",
    description: "Adds future SEO helpers.",
    author: {
      name: "OrynticLabs Private Limited",
    },
    ...overrides,
  };
}
