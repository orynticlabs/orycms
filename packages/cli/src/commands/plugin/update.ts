import type { Command } from "commander";

import { logger } from "../../shared/logger";
import { readOryCMSPluginManifest, updateOryCMSPlugin } from "../../shared/installer";

export function registerUpdateCommand(parent: Command): void {
  parent
    .command("update <id> <dir>")
    .description("Atomically uninstall the current version and install a new one from <dir>")
    .option("--skip-compat", "Skip OryCMS compatibility check")
    .option("--skip-deps", "Skip dependency check")
    .option("--orycms-version <version>", "Override OryCMS version for compatibility check")
    .action(
      (
        id: string,
        dir: string,
        opts: { skipCompat?: boolean; skipDeps?: boolean; oryCMSVersion?: string },
      ) => {
        try {
          const manifest = readOryCMSPluginManifest(dir);

          const newPlugin = { id: manifest.id, name: manifest.name, version: manifest.version };

          const result = updateOryCMSPlugin(id, newPlugin, {
            dir,
            skipCompatibilityCheck: opts.skipCompat ?? false,
            skipDependencyCheck: opts.skipDeps ?? false,
            ...(opts.oryCMSVersion ? { oryCMSVersion: opts.oryCMSVersion } : {}),
            manifest,
          });

          if (result.status === "updated") {
            logger.success(`Plugin "${id}" updated to "${manifest.version}".`);
          } else {
            logger.error(`Update failed: ${result.reason ?? "unknown error"}`);
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
