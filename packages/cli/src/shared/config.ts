import { loadOryCMSConfig } from "../../../../orycms/config/config.loader";
import type { OryCMSConfig, OryCMSLoadConfigOptions } from "../../../../orycms/config/config.types";

/**
 * Load the OryCMS configuration from orycms.config.ts in the given directory.
 * Defaults to the current working directory.
 */
export async function loadConfig(options: OryCMSLoadConfigOptions = {}): Promise<OryCMSConfig> {
  return loadOryCMSConfig({ cwd: process.cwd(), ...options });
}

export type { OryCMSConfig, OryCMSLoadConfigOptions };
