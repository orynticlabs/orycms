import type { Command } from "commander";

import { logger } from "../../shared/logger";
import { enableOryCMSPlugin } from "../../shared/installer";

export function registerEnableCommand(parent: Command): void {
  parent
    .command("enable <id>")
    .description("Enable a previously disabled plugin")
    .action((id: string) => {
      try {
        const result = enableOryCMSPlugin(id);

        if (result.status === "enabled") {
          logger.success(`Plugin "${id}" enabled.`);
        } else {
          logger.error(`Enable failed: ${result.reason ?? "unknown error"}`);
          process.exit(1);
        }
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
