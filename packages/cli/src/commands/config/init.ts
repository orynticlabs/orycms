import { join } from "node:path";

import type { Command } from "commander";

import { fileExists, fromCwd, writeTextFile } from "../../shared/fs";
import { logger } from "../../shared/logger";

const CONFIG_TEMPLATE = `import { defineOryCMSConfig } from "./src/config/config.validator.ts";

export default defineOryCMSConfig({
  plugins: {
    enabled: true,
    entries: [],
  },
  hooks: {
    enabled: true,
  },
  admin: {
    enabled: true,
    basePath: "/admin",
  },
  storage: {
    provider: "local",
  },
});
`;

export function registerConfigInitCommand(parent: Command): void {
  parent
    .command("init")
    .description("Create an orycms.config.ts file in the current directory")
    .option("--force", "Overwrite an existing config file")
    .action((opts: { force?: boolean }) => {
      try {
        const dest = join(fromCwd(), "orycms.config.ts");

        if (fileExists(dest) && !opts.force) {
          logger.warn(`Config already exists at ${dest}. Use --force to overwrite.`);
          process.exit(1);
        }

        writeTextFile(dest, CONFIG_TEMPLATE);
        logger.success(`Created orycms.config.ts`);
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
