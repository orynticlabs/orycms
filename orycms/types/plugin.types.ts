import type { OryCMSID, OryCMSTimestamps, OryCMSStatus } from "./common.types";

export type OryCMSPluginCategory =
  "analytics" | "seo" | "media" | "auth" | "commerce" | "email" | "storage" | "content" | "other";

export interface OryCMSPluginAuthor {
  name: string;
  url?: string;
  email?: string;
}

export interface OryCMSPlugin {
  id: OryCMSID;
  slug: string;
  name: string;
  description: string;
  version: string;
  author: OryCMSPluginAuthor;
  category: OryCMSPluginCategory;
  status: OryCMSStatus;
  isInstalled: boolean;
  isEnabled: boolean;
  config?: Record<string, unknown>;
  timestamps: OryCMSTimestamps;
}

export interface OryCMSPluginConfigSchema {
  [key: string]: {
    type: "string" | "number" | "boolean" | "select";
    label: string;
    description?: string;
    required?: boolean;
    default?: unknown;
    options?: Array<{ label: string; value: string }>;
  };
}

export interface OryCMSUpdatePluginConfigInput {
  config: Record<string, unknown>;
}
