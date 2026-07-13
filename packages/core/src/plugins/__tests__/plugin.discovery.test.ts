import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearDiscoveredOryCMSPluginsForTests,
  discoverOryCMSPlugins,
  loadDiscoveredOryCMSPlugins,
  reloadDiscoveredOryCMSPlugins,
} from "../plugin.discovery";
import { clearOryCMSPluginRegistry, hasOryCMSPlugin, registerOryCMSPlugin } from "@/plugins";

// ── Temp directory helpers ────────────────────────────────────────────────────

const tempDirs: string[] = [];

async function makeTempCwd(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "orycms-discovery-"));
  tempDirs.push(dir);
  return dir;
}

/**
 * Create a plugin entry file under {cwd}/plugins/{pluginName}/index.js.
 * The directory also gets a package.json with "type": "module" so that
 * Node.js treats the .js file as an ES module.
 */
async function writeLocalPlugin(cwd: string, pluginName: string, content: string): Promise<string> {
  const dir = join(cwd, "plugins", pluginName);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "package.json"), JSON.stringify({ type: "module" }));
  const entryPath = join(dir, "index.js");
  await writeFile(entryPath, content);
  return entryPath;
}

/**
 * Create a plugin entry file under {cwd}/node_modules/orycms-plugin-{name}/index.js.
 */
async function writeNodeModulesPlugin(cwd: string, name: string, content: string): Promise<string> {
  const dir = join(cwd, "node_modules", `orycms-plugin-${name}`);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "package.json"), JSON.stringify({ type: "module" }));
  const entryPath = join(dir, "index.js");
  await writeFile(entryPath, content);
  return entryPath;
}

function pluginSource(id: string, extra = ""): string {
  return `export default { id: "${id}", name: "${id}", version: "1.0.0"${extra ? `, ${extra}` : ""} };`;
}

// ── Teardown ──────────────────────────────────────────────────────────────────

afterEach(async () => {
  clearDiscoveredOryCMSPluginsForTests();
  clearOryCMSPluginRegistry();

  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

// ── discoverOryCMSPlugins ─────────────────────────────────────────────────────

describe("discoverOryCMSPlugins", () => {
  it("discovers a valid local plugin from plugins/*/index.js", async () => {
    const cwd = await makeTempCwd();
    await writeLocalPlugin(cwd, "my-plugin", pluginSource("my-plugin"));

    const { discovered, failed } = await discoverOryCMSPlugins({ cwd });

    expect(discovered).toHaveLength(1);
    expect(discovered[0].plugin?.id).toBe("my-plugin");
    expect(discovered[0].origin).toBe("local");
    expect(discovered[0].status).toBe("discovered");
    expect(failed).toHaveLength(0);
  });

  it("discovers a valid node_modules plugin from orycms-plugin-*/index.js", async () => {
    const cwd = await makeTempCwd();
    await writeNodeModulesPlugin(cwd, "seo", pluginSource("orycms-seo"));

    const { discovered, failed } = await discoverOryCMSPlugins({ cwd });

    expect(discovered).toHaveLength(1);
    expect(discovered[0].plugin?.id).toBe("orycms-seo");
    expect(discovered[0].origin).toBe("node_modules");
    expect(failed).toHaveLength(0);
  });

  it("discovers both local and node_modules plugins in the same run", async () => {
    const cwd = await makeTempCwd();
    await writeLocalPlugin(cwd, "local-one", pluginSource("local-one"));
    await writeNodeModulesPlugin(cwd, "pkg", pluginSource("nm-pkg"));

    const { discovered } = await discoverOryCMSPlugins({ cwd });

    const ids = discovered.map((d) => d.plugin?.id);
    expect(ids).toContain("local-one");
    expect(ids).toContain("nm-pkg");
  });

  it("returns empty discovered when no plugins directory exists", async () => {
    const cwd = await makeTempCwd();
    const { discovered, failed } = await discoverOryCMSPlugins({ cwd });
    expect(discovered).toHaveLength(0);
    expect(failed).toHaveLength(0);
  });

  it("silently ignores subdirectories with no entry file", async () => {
    const cwd = await makeTempCwd();
    // create a plugins/ subdir but no index.js / index.ts inside
    await mkdir(join(cwd, "plugins", "not-a-plugin"), { recursive: true });

    const { discovered, failed } = await discoverOryCMSPlugins({ cwd });

    expect(discovered).toHaveLength(0);
    expect(failed).toHaveLength(0);
  });

  it("ignores node_modules packages that do not start with orycms-plugin-", async () => {
    const cwd = await makeTempCwd();
    await writeNodeModulesPlugin(cwd, "unrelated", pluginSource("unrelated"));
    // rename to not start with orycms-plugin-
    const dir = join(cwd, "node_modules", "unrelated-package");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "package.json"), JSON.stringify({ type: "module" }));
    await writeFile(join(dir, "index.js"), pluginSource("unrelated-package"));

    const { discovered } = await discoverOryCMSPlugins({ cwd });

    // The orycms-plugin-unrelated one should be found; the unrelated-package one should not
    expect(discovered.map((d) => d.plugin?.id)).not.toContain("unrelated-package");
  });

  it("adds to failed when entry file throws at import time", async () => {
    const cwd = await makeTempCwd();
    const dir = join(cwd, "plugins", "broken");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "package.json"), JSON.stringify({ type: "module" }));
    // runtime throw — fails regardless of TypeScript support
    await writeFile(join(dir, "index.js"), `throw new Error("intentional import error");`);

    const { discovered, failed } = await discoverOryCMSPlugins({ cwd });

    expect(discovered).toHaveLength(0);
    expect(failed).toHaveLength(1);
    expect(failed[0].origin).toBe("local");
  });

  it("adds to failed when default export is missing", async () => {
    const cwd = await makeTempCwd();
    await writeLocalPlugin(cwd, "no-export", "// no default export");

    const { discovered, failed } = await discoverOryCMSPlugins({ cwd });

    expect(discovered).toHaveLength(0);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toMatch(/does not export a default plugin definition/);
  });

  it("adds to failed when plugin manifest is invalid (missing name)", async () => {
    const cwd = await makeTempCwd();
    await writeLocalPlugin(cwd, "bad-manifest", `export default { id: "bad", version: "1.0.0" };`);

    const { discovered, failed } = await discoverOryCMSPlugins({ cwd });

    expect(discovered).toHaveLength(0);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toMatch(/name/);
  });

  it("adds to failed when plugin manifest is invalid (missing id)", async () => {
    const cwd = await makeTempCwd();
    await writeLocalPlugin(
      cwd,
      "no-id",
      `export default { name: "No ID Plugin", version: "1.0.0" };`,
    );

    const { discovered, failed } = await discoverOryCMSPlugins({ cwd });

    expect(discovered).toHaveLength(0);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toMatch(/id/);
  });

  it("adds to failed on duplicate plugin id within the same discovery run", async () => {
    const cwd = await makeTempCwd();
    await writeLocalPlugin(cwd, "plugin-a", pluginSource("shared-id"));
    await writeLocalPlugin(cwd, "plugin-b", pluginSource("shared-id"));

    const { discovered, failed } = await discoverOryCMSPlugins({ cwd });

    expect(discovered).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toMatch(/Duplicate plugin id/);
  });

  it("reports source path and origin in each item", async () => {
    const cwd = await makeTempCwd();
    const entryPath = await writeLocalPlugin(cwd, "trace-plugin", pluginSource("trace-plugin"));

    const { discovered } = await discoverOryCMSPlugins({ cwd });

    expect(discovered[0].source).toBe(entryPath);
    expect(discovered[0].origin).toBe("local");
  });

  it("does not execute hooks, routes, or any plugin logic during discovery", async () => {
    const hook = vi.fn();
    const handler = vi.fn();
    const cwd = await makeTempCwd();
    // Store the plugin object with hooks in a global, import it from there
    const key = `__discoveryTestPlugin_${Date.now()}`;
    Reflect.set(globalThis, key, {
      id: "passive-plugin",
      name: "Passive Plugin",
      version: "1.0.0",
      hooks: { beforeCreate: hook },
      routes: [{ path: "/api/test", method: "GET", handler }],
    });

    await writeLocalPlugin(cwd, "passive", `export default globalThis.${key};`);

    await discoverOryCMSPlugins({ cwd });

    expect(hook).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("falls back to index.js when index.ts throws at runtime", async () => {
    const cwd = await makeTempCwd();
    const dir = join(cwd, "plugins", "ts-fallback");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "package.json"), JSON.stringify({ type: "module" }));
    // index.ts throws at runtime — causes the fallback to index.js
    await writeFile(join(dir, "index.ts"), `throw new Error("ts not supported here");`);
    await writeFile(
      join(dir, "index.js"),
      `export default { id: "ts-fallback", name: "TS Fallback", version: "1.0.0" };`,
    );

    const { discovered } = await discoverOryCMSPlugins({ cwd });

    expect(discovered).toHaveLength(1);
    expect(discovered[0].plugin?.id).toBe("ts-fallback");
  });
});

// ── loadDiscoveredOryCMSPlugins ───────────────────────────────────────────────

describe("loadDiscoveredOryCMSPlugins", () => {
  it("registers discovered plugins via the plugin registry", async () => {
    const cwd = await makeTempCwd();
    await writeLocalPlugin(cwd, "loaded-plugin", pluginSource("loaded-plugin"));

    const result = await loadDiscoveredOryCMSPlugins({ cwd });

    expect(result.loaded).toHaveLength(1);
    expect(result.loaded[0].plugin?.id).toBe("loaded-plugin");
    expect(hasOryCMSPlugin("loaded-plugin")).toBe(true);
  });

  it("places discovery failures in skipped", async () => {
    const cwd = await makeTempCwd();
    await writeLocalPlugin(cwd, "bad", "export default { version: '1.0.0' };"); // missing id + name

    const result = await loadDiscoveredOryCMSPlugins({ cwd });

    expect(result.loaded).toHaveLength(0);
    expect(result.skipped.length).toBeGreaterThan(0);
  });

  it("skips a plugin that is already registered", async () => {
    const cwd = await makeTempCwd();
    await writeLocalPlugin(cwd, "already-here", pluginSource("already-here"));

    registerOryCMSPlugin({ id: "already-here", name: "Already Here", version: "1.0.0" });

    const result = await loadDiscoveredOryCMSPlugins({ cwd });

    expect(result.loaded).toHaveLength(0);
    expect(result.skipped.some((s) => s.reason?.includes("already registered"))).toBe(true);
  });

  it("loads multiple plugins in one call", async () => {
    const cwd = await makeTempCwd();
    await writeLocalPlugin(cwd, "alpha", pluginSource("alpha"));
    await writeLocalPlugin(cwd, "beta", pluginSource("beta"));

    const result = await loadDiscoveredOryCMSPlugins({ cwd });

    expect(result.loaded).toHaveLength(2);
    expect(hasOryCMSPlugin("alpha")).toBe(true);
    expect(hasOryCMSPlugin("beta")).toBe(true);
  });

  it("does not execute hooks or routes when loading", async () => {
    const hook = vi.fn();
    const cwd = await makeTempCwd();
    const key = `__loadTestPlugin_${Date.now()}`;
    Reflect.set(globalThis, key, {
      id: "passive-load",
      name: "Passive Load",
      version: "1.0.0",
      hooks: { afterCreate: hook },
    });
    await writeLocalPlugin(cwd, "passive-load", `export default globalThis.${key};`);

    await loadDiscoveredOryCMSPlugins({ cwd });

    expect(hook).not.toHaveBeenCalled();
  });
});

// ── reloadDiscoveredOryCMSPlugins ─────────────────────────────────────────────

describe("reloadDiscoveredOryCMSPlugins", () => {
  it("reloads and re-registers plugins", async () => {
    const cwd = await makeTempCwd();
    await writeLocalPlugin(cwd, "reload-me", pluginSource("reload-me"));

    await loadDiscoveredOryCMSPlugins({ cwd });
    expect(hasOryCMSPlugin("reload-me")).toBe(true);

    const result = await reloadDiscoveredOryCMSPlugins({ cwd });

    expect(result.loaded).toHaveLength(1);
    expect(hasOryCMSPlugin("reload-me")).toBe(true);
  });

  it("unregisters previously discovered plugins before re-loading", async () => {
    const cwd = await makeTempCwd();
    await writeLocalPlugin(cwd, "temp-plugin", pluginSource("temp-plugin"));

    await loadDiscoveredOryCMSPlugins({ cwd });
    expect(hasOryCMSPlugin("temp-plugin")).toBe(true);

    // remove the plugin directory
    await rm(join(cwd, "plugins", "temp-plugin"), { recursive: true, force: true });

    const result = await reloadDiscoveredOryCMSPlugins({ cwd });

    expect(result.loaded).toHaveLength(0);
    expect(hasOryCMSPlugin("temp-plugin")).toBe(false);
  });

  it("loads a newly added plugin on reload", async () => {
    const cwd = await makeTempCwd();
    // initial load with no plugins
    await loadDiscoveredOryCMSPlugins({ cwd });

    // add a plugin
    await writeLocalPlugin(cwd, "new-plugin", pluginSource("new-plugin"));

    const result = await reloadDiscoveredOryCMSPlugins({ cwd });

    expect(result.loaded).toHaveLength(1);
    expect(result.loaded[0].plugin?.id).toBe("new-plugin");
  });

  it("does not duplicate plugins when called twice", async () => {
    const cwd = await makeTempCwd();
    await writeLocalPlugin(cwd, "stable", pluginSource("stable"));

    await loadDiscoveredOryCMSPlugins({ cwd });
    const result = await reloadDiscoveredOryCMSPlugins({ cwd });

    expect(result.loaded).toHaveLength(1);
    expect(result.skipped.filter((s) => s.reason?.includes("already registered"))).toHaveLength(0);
  });

  it("does not unregister plugins that were registered outside discovery", async () => {
    const cwd = await makeTempCwd();
    registerOryCMSPlugin({ id: "manual-plugin", name: "Manual", version: "1.0.0" });

    await loadDiscoveredOryCMSPlugins({ cwd });
    await reloadDiscoveredOryCMSPlugins({ cwd });

    expect(hasOryCMSPlugin("manual-plugin")).toBe(true);
  });
});

// ── clearDiscoveredOryCMSPluginsForTests ──────────────────────────────────────

describe("clearDiscoveredOryCMSPluginsForTests", () => {
  it("resets the internal state so reload does not unregister old discoveries", async () => {
    const cwd = await makeTempCwd();
    await writeLocalPlugin(cwd, "to-forget", pluginSource("to-forget"));

    await loadDiscoveredOryCMSPlugins({ cwd });
    expect(hasOryCMSPlugin("to-forget")).toBe(true);

    clearDiscoveredOryCMSPluginsForTests();

    // reload sees no previously-discovered plugins, so does NOT unregister "to-forget"
    const result = await reloadDiscoveredOryCMSPlugins({ cwd });
    // plugin was not unregistered before reload; now found again → skipped as already registered
    expect(hasOryCMSPlugin("to-forget")).toBe(true);
    expect(result.skipped.some((s) => s.reason?.includes("already registered"))).toBe(true);
  });
});
