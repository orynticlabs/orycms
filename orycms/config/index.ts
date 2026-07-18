export { ORYCMS_DEFAULT_CONFIG } from "./config.defaults";
export {
  loadOryCMSConfig,
  mergeOryCMSConfig,
  resetOryCMSConfigCacheForTests,
} from "./config.loader";
export {
  defineOryCMSConfig,
  OryCMSConfigError,
  validateOryCMSConfig,
  validateOryCMSUserConfig,
} from "./config.validator";

export type {
  OryCMSAIConfig,
  OryCMSAdminConfig,
  OryCMSAuthConfig,
  OryCMSConfig,
  OryCMSConfigModule,
  OryCMSDatabaseConfig,
  OryCMSEmailConfig,
  OryCMSEmailProviderId,
  OryCMSHooksConfig,
  OryCMSLoadConfigOptions,
  OryCMSLocalizationConfig,
  OryCMSPluginsConfig,
  OryCMSPluginConfigEntry,
  OryCMSSecurityConfig,
  OryCMSStorageConfig,
  OryCMSUserConfig,
} from "./config.types";
