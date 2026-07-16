import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  defineOryCMSConfig,
  loadOryCMSConfig,
  mergeOryCMSConfig,
  OryCMSConfigError,
  resetOryCMSConfigCacheForTests,
} from "@/config";

const tempDirs: string[] = [];

afterEach(async () => {
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

describe("OryCMS config", () => {
  it("defines typed user configuration", () => {
    const config = defineOryCMSConfig({
      admin: {
        basePath: "/admin",
      },
      plugins: {
        enabled: false,
      },
    });

    expect(config.admin?.basePath).toBe("/admin");
    expect(config.plugins?.enabled).toBe(false);
  });

  it("merges user configuration with defaults", () => {
    const config = mergeOryCMSConfig({
      admin: {
        basePath: "/dashboard",
      },
      localization: {
        locales: ["en", "hi"],
      },
    });

    expect(config.admin).toEqual({
      enabled: true,
      basePath: "/dashboard",
    });
    expect(config.storage.provider).toBe("local");
    expect(config.localization).toEqual({
      defaultLocale: "en",
      locales: ["en", "hi"],
    });
  });

  it("uses defaults when the root config file does not exist", async () => {
    const cwd = await createTempDir();

    const config = await loadOryCMSConfig({
      cwd,
      bypassCache: true,
    });

    expect(config.admin.basePath).toBe("/admin");
    expect(config.storage.provider).toBe("local");
  });

  it("loads and caches user configuration", async () => {
    const cwd = await createTempDir();
    const configPath = join(cwd, "orycms.config.mjs");

    await writeFile(
      configPath,
      "export default { admin: { basePath: '/studio' }, hooks: { timeoutMs: 2500 } };",
    );

    const firstConfig = await loadOryCMSConfig({
      cwd,
      configPath,
    });
    const secondConfig = await loadOryCMSConfig({
      cwd,
      configPath,
    });

    expect(firstConfig).toBe(secondConfig);
    expect(firstConfig.admin.basePath).toBe("/studio");
    expect(firstConfig.hooks.timeoutMs).toBe(2500);
  });

  it("throws descriptive errors for invalid configuration", () => {
    expect(() =>
      mergeOryCMSConfig({
        admin: {
          basePath: "admin",
        },
      }),
    ).toThrow(OryCMSConfigError);

    expect(() =>
      mergeOryCMSConfig({
        storage: {
          provider: "database" as "local",
        },
      }),
    ).toThrow('config.storage.provider must be one of "local", "s3", or "custom".');
  });
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "orycms-config-"));

  tempDirs.push(dir);

  return dir;
}
