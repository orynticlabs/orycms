import type { OryCMSPlugin } from "../plugins/plugin.types";

export type OryCMSDatabaseConfig = {
  url?: string;
  schema?: string;
  tablePrefix?: string;
};

export type OryCMSStorageConfig = {
  provider?: "local" | "s3" | "custom";
  bucket?: string;
  baseUrl?: string;
};

export type OryCMSAuthConfig = {
  sessionCookieName?: string;
  tokenTtlSeconds?: number;
};

export type OryCMSAdminConfig = {
  enabled?: boolean;
  basePath?: string;
};

export type OryCMSPluginsConfig = {
  enabled?: boolean;
  directory?: string;
  entries?: OryCMSPluginConfigEntry[];
};

export type OryCMSPluginConfigEntry =
  | OryCMSPlugin
  | {
      enabled?: boolean;
      plugin: OryCMSPlugin;
    };

export type OryCMSHooksConfig = {
  enabled?: boolean;
  timeoutMs?: number;
};

export type OryCMSEmailProviderId =
  | "resend"
  | "smtp"
  | "sendgrid"
  | "ses"
  | "mailgun"
  | "postmark"
  | "custom";

export type OryCMSEmailConfig = {
  /**
   * Which provider to send through. When omitted (and no ORYCMS_EMAIL_PROVIDER
   * env var is set), OryCMS runs in dev mode: token links are returned in the
   * API response instead of being emailed.
   */
  provider?: OryCMSEmailProviderId;
  /** Default From address, e.g. "OryCMS <no-reply@example.com>". */
  from?: string;
  /** Provider-specific options (API keys, SMTP host, region, …). Env vars win. */
  options?: Record<string, unknown>;
};

export type OryCMSAIConfig = {
  enabled?: boolean;
  provider?: string;
};

export type OryCMSLocalizationConfig = {
  defaultLocale?: string;
  locales?: string[];
};

export type OryCMSSecurityConfig = {
  corsOrigins?: string[];
  contentSecurityPolicy?: boolean;
};

export type OryCMSConfig = {
  database: OryCMSDatabaseConfig;
  storage: OryCMSStorageConfig;
  auth: OryCMSAuthConfig;
  admin: OryCMSAdminConfig;
  plugins: OryCMSPluginsConfig;
  hooks: OryCMSHooksConfig;
  email: OryCMSEmailConfig;
  ai: OryCMSAIConfig;
  localization: OryCMSLocalizationConfig;
  security: OryCMSSecurityConfig;
};

export type OryCMSUserConfig = Partial<{
  database: Partial<OryCMSDatabaseConfig>;
  storage: Partial<OryCMSStorageConfig>;
  auth: Partial<OryCMSAuthConfig>;
  admin: Partial<OryCMSAdminConfig>;
  plugins: Partial<OryCMSPluginsConfig>;
  hooks: Partial<OryCMSHooksConfig>;
  email: Partial<OryCMSEmailConfig>;
  ai: Partial<OryCMSAIConfig>;
  localization: Partial<OryCMSLocalizationConfig>;
  security: Partial<OryCMSSecurityConfig>;
}>;

export type OryCMSConfigModule = {
  default?: OryCMSUserConfig;
  config?: OryCMSUserConfig;
};

export type OryCMSLoadConfigOptions = {
  cwd?: string;
  configPath?: string;
  bypassCache?: boolean;
};
