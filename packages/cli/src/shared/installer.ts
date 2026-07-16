/**
 * Thin re-export of the OryCMS Plugin Installer Engine.
 * CLI commands import from here to keep their own import paths short
 * and to give us a single place to swap the underlying module if needed.
 */
export {
  disableOryCMSPlugin,
  enableOryCMSPlugin,
  installOryCMSPlugin,
  listInstalledOryCMSPlugins,
  uninstallOryCMSPlugin,
  updateOryCMSPlugin,
} from "../../../../orycms/plugins/plugin.installer";

export type {
  OryCMSInstallOptions,
  OryCMSInstallResult,
  OryCMSInstallStatus,
  OryCMSInstalledPluginEntry,
} from "../../../../orycms/plugins/plugin.installer";

export { readOryCMSPluginManifest } from "../../../../orycms/plugins/plugin.manifest";
export type { OryCMSPluginManifest } from "../../../../orycms/plugins/plugin.manifest";
