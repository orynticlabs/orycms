import type { Command } from "commander";

import { logger } from "../../shared/logger";
import { listInstalledOryCMSPlugins } from "../../shared/installer";

export function registerListCommand(parent: Command): void {
  parent
    .command("list")
    .description("List all installed plugins")
    .option("--json", "Output as JSON")
    .action((opts: { json?: boolean }) => {
      try {
        const entries = listInstalledOryCMSPlugins();

        if (opts.json) {
          process.stdout.write(JSON.stringify(entries, null, 2) + "\n");
          return;
        }

        if (entries.length === 0) {
          logger.info("No plugins installed.");
          return;
        }

        logger.info(`${entries.length} plugin${entries.length === 1 ? "" : "s"} installed:\n`);

        for (const entry of entries) {
          const status = entry.enabled ? "enabled" : "disabled";
          logger.table([
            ["id", entry.plugin.id],
            ["name", entry.plugin.name],
            ["version", entry.plugin.version],
            ["status", status],
            ["installed", entry.installedAt],
          ]);
          logger.blank();
        }
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
