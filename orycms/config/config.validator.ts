import type { OryCMSConfig, OryCMSUserConfig } from "./config.types";

const CONFIG_SECTIONS = [
  "database",
  "storage",
  "auth",
  "admin",
  "plugins",
  "hooks",
  "email",
  "ai",
  "localization",
  "security",
] as const;

type OryCMSConfigSection = (typeof CONFIG_SECTIONS)[number];

export class OryCMSConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OryCMSConfigError";
  }
}

export function defineOryCMSConfig(config: OryCMSUserConfig): OryCMSUserConfig {
  return config;
}

export function validateOryCMSUserConfig(config: unknown): asserts config is OryCMSUserConfig {
  if (config === undefined) {
    return;
  }

  assertPlainObject(config, "config");

  for (const key of Object.keys(config)) {
    if (!CONFIG_SECTIONS.includes(key as OryCMSConfigSection)) {
      throw new OryCMSConfigError(
        `Unknown OryCMS config section "${key}". Supported sections: ${CONFIG_SECTIONS.join(", ")}.`,
      );
    }
  }

  for (const section of CONFIG_SECTIONS) {
    const value = (config as Record<string, unknown>)[section];
    if (value !== undefined) {
      assertPlainObject(value, `config.${section}`);
    }
  }
}

export function validateOryCMSConfig(config: OryCMSConfig): OryCMSConfig {
  validateOryCMSUserConfig(config);

  if (config.storage.provider && !["local", "s3", "custom"].includes(config.storage.provider)) {
    throw new OryCMSConfigError(
      'config.storage.provider must be one of "local", "s3", or "custom".',
    );
  }

  if (config.admin.basePath !== undefined && !config.admin.basePath.startsWith("/")) {
    throw new OryCMSConfigError('config.admin.basePath must start with "/".');
  }

  if (config.email.provider && !["smtp", "custom"].includes(config.email.provider)) {
    throw new OryCMSConfigError('config.email.provider must be one of "smtp" or "custom".');
  }

  if (config.localization.locales && config.localization.locales.length === 0) {
    throw new OryCMSConfigError("config.localization.locales must include at least one locale.");
  }

  return config;
}

function assertPlainObject(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OryCMSConfigError(`${path} must be an object.`);
  }
}
