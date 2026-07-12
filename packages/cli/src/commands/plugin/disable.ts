import type { Command } from "commander";

import { logger } from "../../shared/logger";
import { disableOryCMSPlugin } from "../../shared/installer";

export function registerDisableCommand(parent: Command): void {
  parent
    .command("disable <id>")
    .description("Disable a plugin without uninstalling it")
    .action((id: string) => {
      try {
        const result = disableOryCMSPlugin(id);

        if (result.status === "disabled") {
          logger.success(`Plugin "${id}" disabled.`);
        } else {
          logger.error(`Disable failed: ${result.reason ?? "unknown error"}`);
          process.exit(1);
        }
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
