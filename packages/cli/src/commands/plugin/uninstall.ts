import type { Command } from "commander";

import { logger } from "../../shared/logger";
import { uninstallOryCMSPlugin } from "../../shared/installer";

export function registerUninstallCommand(parent: Command): void {
  parent
    .command("uninstall <id>")
    .description("Uninstall a plugin and remove all its registered hooks, routes, and pages")
    .action((id: string) => {
      try {
        const result = uninstallOryCMSPlugin(id);

        if (result.status === "uninstalled") {
          logger.success(`Plugin "${id}" uninstalled.`);
        } else {
          logger.error(`Uninstall failed: ${result.reason ?? "unknown error"}`);
          process.exit(1);
        }
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
