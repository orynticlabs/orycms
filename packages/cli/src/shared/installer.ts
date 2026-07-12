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
} from "../../../../src/plugins/plugin.installer";

export type {
  OryCMSInstallOptions,
  OryCMSInstallResult,
  OryCMSInstallStatus,
  OryCMSInstalledPluginEntry,
} from "../../../../src/plugins/plugin.installer";

export { readOryCMSPluginManifest } from "../../../../src/plugins/plugin.manifest";
export type { OryCMSPluginManifest } from "../../../../src/plugins/plugin.manifest";
