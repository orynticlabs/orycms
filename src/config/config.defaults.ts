import type { OryCMSConfig } from "./config.types";

export const ORYCMS_DEFAULT_CONFIG: OryCMSConfig = {
  database: {},
  storage: {
    provider: "local",
  },
  auth: {},
  admin: {
    enabled: true,
    basePath: "/admin",
  },
  plugins: {
    enabled: false,
  },
  hooks: {
    enabled: true,
  },
  email: {},
  ai: {
    enabled: false,
  },
  localization: {
    defaultLocale: "en",
    locales: ["en"],
  },
  security: {
    contentSecurityPolicy: false,
  },
};
