export { OryCMSPluginService } from "@/services/plugins.service";
export type { OryCMSPlugin as OryCMSInstalledPlugin, OryCMSUpdatePluginConfigInput } from "@/types";

export {
  clearOryCMSInstallerForTests,
  disableOryCMSPlugin,
  enableOryCMSPlugin,
  installOryCMSPlugin,
  listInstalledOryCMSPlugins,
  uninstallOryCMSPlugin,
  updateOryCMSPlugin,
} from "./plugin.installer";
export type {
  OryCMSInstallOptions,
  OryCMSInstallResult,
  OryCMSInstallStatus,
  OryCMSInstalledPluginEntry,
} from "./plugin.installer";

export {
  getOryCMSPluginCompatibilityReport,
  isOryCMSPluginCompatible,
  ORYCMS_VERSION,
  validateOryCMSPluginCompatibility,
} from "./plugin.compatibility";
export type {
  OryCMSCompatibilityError,
  OryCMSCompatibilityErrorCode,
  OryCMSCompatibilityOptions,
  OryCMSCompatibilityReport,
} from "./plugin.compatibility";

export {
  getOryCMSPluginLoadOrder,
  resolveOryCMSPluginDependencies,
  validateOryCMSPluginDependencies,
} from "./plugin.dependencies";
export type {
  OryCMSDependencyIssue,
  OryCMSDependencyIssueCode,
  OryCMSDependencyResult,
} from "./plugin.dependencies";

export {
  OryCMSManifestError,
  readOryCMSPluginManifest,
  readOryCMSPluginManifests,
  validateOryCMSPluginManifest,
} from "./plugin.manifest";
export type {
  OryCMSManifestAuthor,
  OryCMSManifestErrorCode,
  OryCMSManifestOptions,
  OryCMSManifestReadItem,
  OryCMSManifestResult,
  OryCMSPluginCategory,
  OryCMSPluginManifest,
} from "./plugin.manifest";

export {
  clearDiscoveredOryCMSPluginsForTests,
  discoverOryCMSPlugins,
  loadDiscoveredOryCMSPlugins,
  reloadDiscoveredOryCMSPlugins,
} from "./plugin.discovery";
export type {
  OryCMSDiscoveredPluginItem,
  OryCMSDiscoveryLoadResult,
  OryCMSDiscoveryOptions,
  OryCMSDiscoveryResult,
  OryCMSPluginOrigin,
} from "./plugin.discovery";

export {
  clearOryCMSPluginRegistry,
  defineOryCMSPlugin,
  getOryCMSPlugin,
  hasOryCMSPlugin,
  listOryCMSPlugins,
  OryCMSPluginError,
  registerOryCMSPlugin,
  unregisterOryCMSPlugin,
  validateOryCMSPlugin,
} from "./plugin.api";

export {
  clearLoadedOryCMSPluginsForTests,
  listLoadedOryCMSPlugins,
  loadOryCMSPlugin,
  loadOryCMSPlugins,
  reloadOryCMSPlugins,
  unloadOryCMSPlugin,
} from "./plugin.loader";
export type {
  OryCMSPluginLoadOptions,
  OryCMSPluginLoadResult,
  OryCMSPluginLoadResultItem,
  OryCMSPluginLoadStatus,
} from "./plugin.loader";

export type {
  OryCMSPlugin,
  OryCMSPluginAuthor,
  OryCMSPluginConfig,
  OryCMSPluginHooks,
  OryCMSPluginInput,
  OryCMSPluginPage,
  OryCMSPluginPermission,
  OryCMSPluginRoute,
  OryCMSPluginSetting,
  OryCMSPluginSettingType,
  OryCMSPluginSidebarItem,
} from "./plugin.types";

export {
  clearAllOryCMSExtensions,
  clearOryCMSCollectionExtensions,
  clearOryCMSCommands,
  clearOryCMSDashboardWidgets,
  clearOryCMSFieldTypes,
  clearOryCMSNavigationGroups,
  clearOryCMSProviders,
  clearOryCMSSettingsSections,
  clearOryCMSValidators,
  listOryCMSCollectionExtensions,
  listOryCMSCommands,
  listOryCMSDashboardWidgets,
  listOryCMSFieldTypes,
  listOryCMSNavigationGroups,
  listOryCMSProviders,
  listOryCMSSettingsSections,
  listOryCMSValidators,
  registerOryCMSCollectionExtensions,
  registerOryCMSCommands,
  registerOryCMSDashboardWidgets,
  registerOryCMSFieldTypes,
  registerOryCMSNavigationGroups,
  registerOryCMSProviders,
  registerOryCMSSettingsSections,
  registerOryCMSValidators,
  unregisterOryCMSCollectionExtensions,
  unregisterOryCMSCommands,
  unregisterOryCMSDashboardWidgets,
  unregisterOryCMSFieldTypes,
  unregisterOryCMSNavigationGroups,
  unregisterOryCMSProviders,
  unregisterOryCMSSettingsSections,
  unregisterOryCMSValidators,
} from "./plugin.extensions";
export type {
  OryCMSCollectionExtension,
  OryCMSCommandExtension,
  OryCMSDashboardWidgetExtension,
  OryCMSFieldTypeExtension,
  OryCMSNavigationGroupExtension,
  OryCMSPluginExtensions,
  OryCMSProviderExtension,
  OryCMSSettingsSectionExtension,
  OryCMSValidatorExtension,
} from "./plugin.extensions";
