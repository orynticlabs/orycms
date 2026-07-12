import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { ORYCMS_DEFAULT_CONFIG } from "./config.defaults";
import type {
  OryCMSConfig,
  OryCMSConfigModule,
  OryCMSLoadConfigOptions,
  OryCMSUserConfig,
} from "./config.types";
import { validateOryCMSConfig, validateOryCMSUserConfig } from "./config.validator";

let cachedConfig: OryCMSConfig | undefined;
let cachedConfigPath: string | undefined;
let configImportCacheBust = 0;

export async function loadOryCMSConfig(
  options: OryCMSLoadConfigOptions = {},
): Promise<OryCMSConfig> {
  const configPath = resolve(
    options.cwd ?? process.cwd(),
    options.configPath ?? "orycms.config.ts",
  );

  if (!options.bypassCache && cachedConfig && cachedConfigPath === configPath) {
    return cachedConfig;
  }

  const userConfig = await loadUserConfig(configPath, options.bypassCache);
  const mergedConfig = mergeOryCMSConfig(userConfig);

  cachedConfig = mergedConfig;
  cachedConfigPath = configPath;

  return mergedConfig;
}

export function mergeOryCMSConfig(userConfig: OryCMSUserConfig = {}): OryCMSConfig {
  validateOryCMSUserConfig(userConfig);

  return validateOryCMSConfig({
    database: {
      ...ORYCMS_DEFAULT_CONFIG.database,
      ...userConfig.database,
    },
    storage: {
      ...ORYCMS_DEFAULT_CONFIG.storage,
      ...userConfig.storage,
    },
    auth: {
      ...ORYCMS_DEFAULT_CONFIG.auth,
      ...userConfig.auth,
    },
    admin: {
      ...ORYCMS_DEFAULT_CONFIG.admin,
      ...userConfig.admin,
    },
    plugins: {
      ...ORYCMS_DEFAULT_CONFIG.plugins,
      ...userConfig.plugins,
    },
    hooks: {
      ...ORYCMS_DEFAULT_CONFIG.hooks,
      ...userConfig.hooks,
    },
    email: {
      ...ORYCMS_DEFAULT_CONFIG.email,
      ...userConfig.email,
    },
    ai: {
      ...ORYCMS_DEFAULT_CONFIG.ai,
      ...userConfig.ai,
    },
    localization: {
      ...ORYCMS_DEFAULT_CONFIG.localization,
      ...userConfig.localization,
    },
    security: {
      ...ORYCMS_DEFAULT_CONFIG.security,
      ...userConfig.security,
    },
  });
}

export function resetOryCMSConfigCacheForTests(): void {
  cachedConfig = undefined;
  cachedConfigPath = undefined;
}

async function loadUserConfig(
  configPath: string,
  bypassImportCache = false,
): Promise<OryCMSUserConfig> {
  if (!existsSync(configPath)) {
    return {};
  }

  const configUrl = pathToFileURL(configPath);
  if (bypassImportCache) {
    configImportCacheBust += 1;
    configUrl.searchParams.set("t", configImportCacheBust.toString());
  }

  const configModule = (await import(configUrl.href)) as OryCMSConfigModule;
  const userConfig = configModule.default ?? configModule.config ?? {};

  validateOryCMSUserConfig(userConfig);

  return userConfig;
}
