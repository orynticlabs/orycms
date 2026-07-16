import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  OryCMSManifestError,
  readOryCMSPluginManifest,
  readOryCMSPluginManifests,
  validateOryCMSPluginManifest,
} from "../plugin.manifest";
import type { OryCMSPluginManifest } from "../plugin.manifest";

// ── Helpers ───────────────────────────────────────────────────────────────────

const tempDirs: string[] = [];

async function makeTempCwd(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "orycms-manifest-"));
  tempDirs.push(dir);
  return dir;
}

async function writeManifest(dir: string, data: unknown): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "orycms-plugin.json"), JSON.stringify(data));
}

const MIN: OryCMSPluginManifest = { id: "my-plugin", name: "My Plugin", version: "1.0.0" };

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

// ── validateOryCMSPluginManifest ──────────────────────────────────────────────

describe("validateOryCMSPluginManifest", () => {
  it("passes for a minimal valid manifest", () => {
    expect(() => validateOryCMSPluginManifest({ ...MIN })).not.toThrow();
  });

  it("passes for a manifest with all optional fields", () => {
    expect(() =>
      validateOryCMSPluginManifest({
        id: "full-plugin",
        name: "Full Plugin",
        version: "2.1.0",
        description: "A complete plugin",
        author: { name: "Alice", email: "alice@example.com", url: "https://example.com" },
        license: "MIT",
        homepage: "https://example.com",
        repository: { type: "git", url: "https://github.com/org/plugin" },
        keywords: ["seo", "cms"],
        icon: "search",
        category: "seo",
        compatibility: { orycms: "^1.0.0" },
        dependencies: { "some-package": "^1.0.0" },
        peerDependencies: { react: ">=18" },
        permissions: ["content.read", "content.write"],
      }),
    ).not.toThrow();
  });

  it("passes with string author", () => {
    expect(() =>
      validateOryCMSPluginManifest({ ...MIN, author: "Alice <alice@example.com>" }),
    ).not.toThrow();
  });

  it("passes with string repository", () => {
    expect(() =>
      validateOryCMSPluginManifest({ ...MIN, repository: "https://github.com/org/plugin" }),
    ).not.toThrow();
  });

  it("passes for every valid category value", () => {
    const categories = [
      "analytics",
      "auth",
      "commerce",
      "content",
      "email",
      "media",
      "other",
      "seo",
      "storage",
    ];
    for (const category of categories) {
      expect(() => validateOryCMSPluginManifest({ ...MIN, category })).not.toThrow();
    }
  });

  // ── Required field failures ─────────────────────────────────────────────────

  it("throws MANIFEST_INVALID when id is missing", () => {
    expect(() => validateOryCMSPluginManifest({ name: "P", version: "1.0.0" })).toThrow(
      expect.objectContaining({ code: "MANIFEST_INVALID" }),
    );
  });

  it("throws MANIFEST_INVALID when id is empty string", () => {
    expect(() => validateOryCMSPluginManifest({ id: "", name: "P", version: "1.0.0" })).toThrow(
      /id/,
    );
  });

  it("throws MANIFEST_INVALID when name is missing", () => {
    expect(() => validateOryCMSPluginManifest({ id: "p", version: "1.0.0" })).toThrow(/name/);
  });

  it("throws MANIFEST_INVALID when version is missing", () => {
    expect(() => validateOryCMSPluginManifest({ id: "p", name: "P" })).toThrow(/version/);
  });

  it("throws MANIFEST_INVALID when manifest is not an object", () => {
    expect(() => validateOryCMSPluginManifest("not-an-object")).toThrow(
      expect.objectContaining({ code: "MANIFEST_INVALID" }),
    );
  });

  it("throws MANIFEST_INVALID when manifest is an array", () => {
    expect(() => validateOryCMSPluginManifest([])).toThrow(
      expect.objectContaining({ code: "MANIFEST_INVALID" }),
    );
  });

  it("throws MANIFEST_INVALID when manifest is null", () => {
    expect(() => validateOryCMSPluginManifest(null)).toThrow(
      expect.objectContaining({ code: "MANIFEST_INVALID" }),
    );
  });

  // ── Optional field type failures ────────────────────────────────────────────

  it("throws MANIFEST_INVALID for unknown category", () => {
    expect(() => validateOryCMSPluginManifest({ ...MIN, category: "unknown-cat" })).toThrow(
      /category/,
    );
  });

  it("throws MANIFEST_INVALID when keywords is not an array", () => {
    expect(() => validateOryCMSPluginManifest({ ...MIN, keywords: "seo" })).toThrow(/keywords/);
  });

  it("throws MANIFEST_INVALID when keywords contains non-string", () => {
    expect(() => validateOryCMSPluginManifest({ ...MIN, keywords: ["seo", 42] })).toThrow(
      /keywords/,
    );
  });

  it("throws MANIFEST_INVALID when permissions is not an array", () => {
    expect(() => validateOryCMSPluginManifest({ ...MIN, permissions: "content.read" })).toThrow(
      /permissions/,
    );
  });

  it("throws MANIFEST_INVALID when permissions contains non-string", () => {
    expect(() =>
      validateOryCMSPluginManifest({ ...MIN, permissions: ["content.read", true] }),
    ).toThrow(/permissions/);
  });

  it("throws MANIFEST_INVALID when compatibility value is not a string", () => {
    expect(() => validateOryCMSPluginManifest({ ...MIN, compatibility: { orycms: 1 } })).toThrow(
      /compatibility/,
    );
  });

  it("throws MANIFEST_INVALID when dependencies is not an object", () => {
    expect(() => validateOryCMSPluginManifest({ ...MIN, dependencies: ["dep"] })).toThrow(
      /dependencies/,
    );
  });

  it("throws MANIFEST_INVALID when author object is missing name", () => {
    expect(() => validateOryCMSPluginManifest({ ...MIN, author: { email: "x@x.com" } })).toThrow(
      /author\.name/,
    );
  });

  it("throws MANIFEST_INVALID when repository object is missing url", () => {
    expect(() => validateOryCMSPluginManifest({ ...MIN, repository: { type: "git" } })).toThrow(
      /repository\.url/,
    );
  });

  it("OryCMSManifestError is an instance of Error", () => {
    const err = new OryCMSManifestError("MANIFEST_INVALID", "test");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("OryCMSManifestError");
    expect(err.code).toBe("MANIFEST_INVALID");
  });
});

// ── readOryCMSPluginManifest ──────────────────────────────────────────────────

describe("readOryCMSPluginManifest", () => {
  it("reads and returns a valid manifest", async () => {
    const cwd = await makeTempCwd();
    await writeManifest(cwd, MIN);

    const manifest = readOryCMSPluginManifest(cwd);
    expect(manifest.id).toBe("my-plugin");
    expect(manifest.name).toBe("My Plugin");
    expect(manifest.version).toBe("1.0.0");
  });

  it("returns all optional fields when present", async () => {
    const cwd = await makeTempCwd();
    const full = {
      ...MIN,
      description: "A plugin",
      license: "MIT",
      keywords: ["cms"],
      category: "content",
      permissions: ["content.read"],
    };
    await writeManifest(cwd, full);

    const manifest = readOryCMSPluginManifest(cwd);
    expect(manifest.description).toBe("A plugin");
    expect(manifest.license).toBe("MIT");
    expect(manifest.keywords).toEqual(["cms"]);
    expect(manifest.category).toBe("content");
    expect(manifest.permissions).toEqual(["content.read"]);
  });

  it("throws MANIFEST_NOT_FOUND when the file does not exist", async () => {
    const cwd = await makeTempCwd();
    expect(() => readOryCMSPluginManifest(cwd)).toThrow(
      expect.objectContaining({ code: "MANIFEST_NOT_FOUND" }),
    );
  });

  it("throws MANIFEST_INVALID_JSON for malformed JSON", async () => {
    const cwd = await makeTempCwd();
    await writeFile(join(cwd, "orycms-plugin.json"), "{ not valid json }");

    expect(() => readOryCMSPluginManifest(cwd)).toThrow(
      expect.objectContaining({ code: "MANIFEST_INVALID_JSON" }),
    );
  });

  it("throws MANIFEST_INVALID when JSON is valid but schema is wrong", async () => {
    const cwd = await makeTempCwd();
    await writeManifest(cwd, { id: "p", version: "1.0.0" }); // missing name

    expect(() => readOryCMSPluginManifest(cwd)).toThrow(
      expect.objectContaining({ code: "MANIFEST_INVALID" }),
    );
  });

  it("does not import or execute any plugin code", async () => {
    // Manifest reading is purely synchronous JSON file I/O — no dynamic import occurs.
    // This is a structural guarantee: readOryCMSPluginManifest does not call import().
    const cwd = await makeTempCwd();
    await writeManifest(cwd, MIN);

    // If this were to import code it would throw trying to find a JS entry file.
    // The fact that it returns successfully without a JS file proves no code is executed.
    const manifest = readOryCMSPluginManifest(cwd);
    expect(manifest).toBeDefined();
  });
});

// ── readOryCMSPluginManifests ─────────────────────────────────────────────────

describe("readOryCMSPluginManifests", () => {
  it("reads manifest from local plugins/*/orycms-plugin.json", async () => {
    const cwd = await makeTempCwd();
    await writeManifest(join(cwd, "plugins", "my-plugin"), MIN);

    const result = readOryCMSPluginManifests({ cwd });

    expect(result.found).toHaveLength(1);
    expect(result.found[0].manifest?.id).toBe("my-plugin");
    expect(result.found[0].origin).toBe("local");
    expect(result.found[0].status).toBe("found");
    expect(result.missing).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
  });

  it("reads manifest from node_modules/orycms-plugin-*/orycms-plugin.json", async () => {
    const cwd = await makeTempCwd();
    const nmDir = join(cwd, "node_modules", "orycms-plugin-seo");
    await writeManifest(nmDir, { ...MIN, id: "orycms-seo" });

    const result = readOryCMSPluginManifests({ cwd });

    expect(result.found).toHaveLength(1);
    expect(result.found[0].manifest?.id).toBe("orycms-seo");
    expect(result.found[0].origin).toBe("node_modules");
  });

  it("reads both local and node_modules manifests in one call", async () => {
    const cwd = await makeTempCwd();
    await writeManifest(join(cwd, "plugins", "local-plugin"), { ...MIN, id: "local" });
    await writeManifest(join(cwd, "node_modules", "orycms-plugin-seo"), {
      ...MIN,
      id: "nm-seo",
    });

    const result = readOryCMSPluginManifests({ cwd });
    const ids = result.found.map((f) => f.manifest?.id);
    expect(ids).toContain("local");
    expect(ids).toContain("nm-seo");
  });

  it("adds to missing when plugin directory has no manifest file", async () => {
    const cwd = await makeTempCwd();
    // create the plugin directory but no manifest inside
    await mkdir(join(cwd, "plugins", "no-manifest"), { recursive: true });

    const result = readOryCMSPluginManifests({ cwd });

    expect(result.missing).toHaveLength(1);
    expect(result.missing[0].origin).toBe("local");
    expect(result.missing[0].status).toBe("missing");
    expect(result.found).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
  });

  it("adds to failed when manifest JSON is invalid", async () => {
    const cwd = await makeTempCwd();
    const dir = join(cwd, "plugins", "bad-json");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "orycms-plugin.json"), "{ bad json }");

    const result = readOryCMSPluginManifests({ cwd });

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toMatch(/invalid JSON/i);
    expect(result.failed[0].status).toBe("failed");
  });

  it("adds to failed when manifest fails schema validation", async () => {
    const cwd = await makeTempCwd();
    // manifest is valid JSON but missing required 'name' field
    await writeManifest(join(cwd, "plugins", "bad-schema"), { id: "p", version: "1.0.0" });

    const result = readOryCMSPluginManifests({ cwd });

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toMatch(/name/);
  });

  it("returns all three bucket categories in a mixed scan", async () => {
    const cwd = await makeTempCwd();
    // good manifest
    await writeManifest(join(cwd, "plugins", "good"), { ...MIN, id: "good" });
    // directory without manifest
    await mkdir(join(cwd, "plugins", "no-manifest"), { recursive: true });
    // directory with invalid manifest
    await writeManifest(join(cwd, "plugins", "bad"), { version: "1.0.0" }); // missing id+name

    const result = readOryCMSPluginManifests({ cwd });

    expect(result.found).toHaveLength(1);
    expect(result.missing).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
  });

  it("returns empty result when no plugin directories exist", async () => {
    const cwd = await makeTempCwd();
    const result = readOryCMSPluginManifests({ cwd });
    expect(result.found).toHaveLength(0);
    expect(result.missing).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
  });

  it("ignores node_modules packages that do not start with orycms-plugin-", async () => {
    const cwd = await makeTempCwd();
    const unrelated = join(cwd, "node_modules", "unrelated-package");
    await writeManifest(unrelated, MIN);

    const result = readOryCMSPluginManifests({ cwd });
    expect(result.found).toHaveLength(0);
    expect(result.missing).toHaveLength(0);
  });

  it("provides dir path in every result item", async () => {
    const cwd = await makeTempCwd();
    const pluginDir = join(cwd, "plugins", "trace-plugin");
    await writeManifest(pluginDir, { ...MIN, id: "trace" });

    const result = readOryCMSPluginManifests({ cwd });
    expect(result.found[0].dir).toBe(pluginDir);
  });

  it("reads manifests without importing any JS files", async () => {
    // Structural test: readOryCMSPluginManifests is synchronous and never calls import().
    const cwd = await makeTempCwd();
    await writeManifest(join(cwd, "plugins", "json-only"), MIN);
    // No index.js or index.ts exists — proves no code import happens
    const result = readOryCMSPluginManifests({ cwd });
    expect(result.found).toHaveLength(1);
  });
});
