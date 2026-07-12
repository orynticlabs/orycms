import type { Command } from "commander";

import { logger } from "../../shared/logger";
import { loadConfig } from "../../shared/config";

export function registerConfigShowCommand(parent: Command): void {
  parent
    .command("show")
    .description("Display the resolved OryCMS configuration")
    .option("--json", "Output as JSON")
    .option("--cwd <path>", "Directory containing orycms.config.ts")
    .action(async (opts: { json?: boolean; cwd?: string }) => {
      try {
        const config = await loadConfig({ cwd: opts.cwd });

        if (opts.json) {
          process.stdout.write(JSON.stringify(config, null, 2) + "\n");
          return;
        }

        logger.info("OryCMS configuration:");
        logger.blank();
        logger.table([
          ["plugins.enabled", String(config.plugins.enabled ?? false)],
          ["hooks.enabled", String(config.hooks.enabled ?? true)],
          ["admin.enabled", String(config.admin.enabled ?? true)],
          ["admin.basePath", config.admin.basePath ?? "/admin"],
          ["storage.provider", config.storage.provider ?? "local"],
          ["auth.sessionCookieName", config.auth.sessionCookieName ?? "(default)"],
        ]);
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
