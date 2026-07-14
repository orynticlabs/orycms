import type { OryCMSPlugin, OryCMSPluginAuthor } from "./plugin.types";

export type OryCMSPluginErrorCode = "INVALID_PLUGIN" | "DUPLICATE_PLUGIN" | "PLUGIN_NOT_FOUND";

const PLUGIN_SETTING_TYPES = ["string", "number", "boolean", "select", "json"] as const;

export class OryCMSPluginError extends Error {
  constructor(
    public readonly code: OryCMSPluginErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "OryCMSPluginError";
  }
}

export function defineOryCMSPlugin(plugin: OryCMSPlugin): OryCMSPlugin {
  validateOryCMSPlugin(plugin);
  return plugin;
}

export function validateOryCMSPlugin(plugin: unknown): asserts plugin is OryCMSPlugin {
  assertPlainObject(plugin, "plugin");

  const candidate = plugin as Partial<OryCMSPlugin>;

  assertNonEmptyString(candidate.id, "plugin.id");
  assertNonEmptyString(candidate.name, "plugin.name");
  assertNonEmptyString(candidate.version, "plugin.version");

  if (candidate.description !== undefined) {
    assertString(candidate.description, "plugin.description");
  }

  if (candidate.author !== undefined) {
    validateAuthor(candidate.author);
  }

  assertOptionalArray(candidate.collections, "plugin.collections");
  assertOptionalPlainObject(candidate.hooks, "plugin.hooks");
  assertOptionalArray(candidate.routes, "plugin.routes");
  assertOptionalArray(candidate.sidebar, "plugin.sidebar");
  assertOptionalArray(candidate.pages, "plugin.pages");
  assertOptionalArray(candidate.settings, "plugin.settings");
  assertOptionalArray(candidate.permissions, "plugin.permissions");
  assertOptionalPlainObject(candidate.config, "plugin.config");

  candidate.routes?.forEach((route, index) => {
    assertPlainObject(route, `plugin.routes[${index}]`);
    assertNonEmptyString(route.path, `plugin.routes[${index}].path`);
  });

  candidate.sidebar?.forEach((item, index) => {
    assertPlainObject(item, `plugin.sidebar[${index}]`);
    assertNonEmptyString(item.id, `plugin.sidebar[${index}].id`);
    assertNonEmptyString(item.label, `plugin.sidebar[${index}].label`);
  });

  candidate.pages?.forEach((page, index) => {
    assertPlainObject(page, `plugin.pages[${index}]`);
    assertNonEmptyString(page.id, `plugin.pages[${index}].id`);
    assertNonEmptyString(page.title, `plugin.pages[${index}].title`);
    assertNonEmptyString(page.path, `plugin.pages[${index}].path`);
  });

  candidate.settings?.forEach((setting, index) => {
    assertPlainObject(setting, `plugin.settings[${index}]`);
    assertNonEmptyString(setting.key, `plugin.settings[${index}].key`);
    assertNonEmptyString(setting.label, `plugin.settings[${index}].label`);
    assertNonEmptyString(setting.type, `plugin.settings[${index}].type`);

    if (!PLUGIN_SETTING_TYPES.includes(setting.type as (typeof PLUGIN_SETTING_TYPES)[number])) {
      throwInvalid(
        `plugin.settings[${index}].type must be one of ${PLUGIN_SETTING_TYPES.map((type) => `"${type}"`).join(", ")}.`,
      );
    }
  });

  candidate.permissions?.forEach((permission, index) => {
    assertPlainObject(permission, `plugin.permissions[${index}]`);
    assertNonEmptyString(permission.key, `plugin.permissions[${index}].key`);
    assertNonEmptyString(permission.label, `plugin.permissions[${index}].label`);
  });
}

function validateAuthor(author: OryCMSPluginAuthor): void {
  if (typeof author === "string") {
    assertNonEmptyString(author, "plugin.author");
    return;
  }

  assertPlainObject(author, "plugin.author");
  assertNonEmptyString(author.name, "plugin.author.name");

  if (author.url !== undefined) {
    assertString(author.url, "plugin.author.url");
  }

  if (author.email !== undefined) {
    assertString(author.email, "plugin.author.email");
  }
}

function assertOptionalArray(value: unknown, path: string): asserts value is unknown[] | undefined {
  if (value !== undefined && !Array.isArray(value)) {
    throwInvalid(`${path} must be an array.`);
  }
}

function assertOptionalPlainObject(
  value: unknown,
  path: string,
): asserts value is Record<string, unknown> | undefined {
  if (value !== undefined) {
    assertPlainObject(value, path);
  }
}

function assertPlainObject(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throwInvalid(`${path} must be an object.`);
  }
}

function assertNonEmptyString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throwInvalid(`${path} must be a non-empty string.`);
  }
}

function assertString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string") {
    throwInvalid(`${path} must be a string.`);
  }
}

function throwInvalid(message: string): never {
  throw new OryCMSPluginError("INVALID_PLUGIN", message);
}
