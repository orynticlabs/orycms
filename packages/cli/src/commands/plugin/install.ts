import type { Command } from "commander";

import { logger } from "../../shared/logger";
import { installOryCMSPlugin, readOryCMSPluginManifest } from "../../shared/installer";

export function registerInstallCommand(parent: Command): void {
  parent
    .command("install <dir>")
    .description("Install a plugin from a directory containing orycms-plugin.json")
    .option("--skip-compat", "Skip OryCMS compatibility check")
    .option("--skip-deps", "Skip dependency check against installed plugins")
    .option("--orycms-version <version>", "Override OryCMS version for compatibility check")
    .action(
      (dir: string, opts: { skipCompat?: boolean; skipDeps?: boolean; oryCMSVersion?: string }) => {
        try {
          const manifest = readOryCMSPluginManifest(dir);

          const plugin = { id: manifest.id, name: manifest.name, version: manifest.version };

          const result = installOryCMSPlugin(plugin, {
            dir,
            skipCompatibilityCheck: opts.skipCompat ?? false,
            skipDependencyCheck: opts.skipDeps ?? false,
            ...(opts.oryCMSVersion ? { oryCMSVersion: opts.oryCMSVersion } : {}),
            manifest,
          });

          if (result.status === "installed") {
            logger.success(`Plugin "${manifest.id}@${manifest.version}" installed.`);
          } else {
            logger.error(`Install failed: ${result.reason ?? "unknown error"}`);
            for (const e of result.validationErrors ?? []) logger.error(`  • ${e}`);
            process.exit(1);
          }
        } catch (err) {
          logger.error(err instanceof Error ? err.message : String(err));
          process.exit(1);
        }
      },
    );
}
