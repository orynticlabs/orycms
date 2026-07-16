import type { OryCMSHookEventName, OryCMSHookFn } from "@/hooks";
import type { OryCMSCollectionDefinition } from "@/schema";
import type { OryCMSPluginExtensions } from "./plugin.extensions";

export type OryCMSPluginAuthor =
  | string
  | {
      name: string;
      url?: string;
      email?: string;
    };

export type OryCMSPluginHooks = Partial<Record<OryCMSHookEventName, OryCMSHookFn | OryCMSHookFn[]>>;

export type OryCMSPluginRoute = {
  path: string;
  method?: string | string[];
  handler?: unknown;
  [key: string]: unknown;
};

export type OryCMSPluginSidebarItem = {
  id: string;
  label: string;
  href?: string;
  icon?: string;
  group?: string;
  order?: number;
  permission?: string;
  [key: string]: unknown;
};

export type OryCMSPluginPage = {
  id: string;
  title: string;
  path: string;
  component?: unknown;
  layout?: string;
  order?: number;
  permission?: string;
  [key: string]: unknown;
};

export type OryCMSPluginSettingType = "string" | "number" | "boolean" | "select" | "json";

export type OryCMSPluginSetting = {
  key: string;
  label: string;
  type: OryCMSPluginSettingType;
  description?: string;
  required?: boolean;
  defaultValue?: unknown;
  options?: Array<{
    label: string;
    value: string;
  }>;
};

export type OryCMSPluginPermission = {
  key: string;
  label: string;
  description?: string;
};

export type OryCMSPluginConfig = Record<string, unknown>;

export type OryCMSPlugin = {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: OryCMSPluginAuthor;
  collections?: OryCMSCollectionDefinition[];
  hooks?: OryCMSPluginHooks;
  routes?: OryCMSPluginRoute[];
  sidebar?: OryCMSPluginSidebarItem[];
  pages?: OryCMSPluginPage[];
  settings?: OryCMSPluginSetting[];
  permissions?: OryCMSPluginPermission[];
  extensions?: OryCMSPluginExtensions;
  config?: OryCMSPluginConfig;
};

export type OryCMSPluginInput = OryCMSPlugin;
