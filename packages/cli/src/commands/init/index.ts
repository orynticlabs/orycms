import type { Command } from "commander";

import { logger } from "../../shared/logger";
import { detectNextJs } from "./detectors/nextjs";
import { detectPackageManager } from "./detectors/package-manager";
import { runInit } from "./init";
import type { AskFn } from "./prompts/init.prompts";

/**
 * Register the `orycms init` command.
 *
 * Accepts an optional `askFn` so tests can inject a stub that bypasses
 * the interactive @inquirer/prompts TTY flow.
 */
export function registerInitCommand(program: Command, askFn?: AskFn): void {
  program
    .command("init")
    .description("Initialise OryCMS in an existing Next.js App Router project")
    .option("--cwd <path>", "Target directory (defaults to process.cwd())")
    .action(async (opts: { cwd?: string }) => {
      const cwd = opts.cwd ? opts.cwd : process.cwd();

      // ── 1. Detect environment ─────────────────────────────────────────────

      const nextInfo = detectNextJs(cwd);

      if (!nextInfo.detected) {
        logger.error(
          "No Next.js project detected. Make sure package.json contains 'next' as a dependency.",
        );
        process.exit(1);
      }

      if (!nextInfo.hasAppRouter) {
        logger.warn("App Router directory (app/) not found. OryCMS requires Next.js App Router.");
      }

      const packageManager = detectPackageManager(cwd);

      logger.info(`Detected: Next.js ${nextInfo.nextVersion ?? ""} | ${packageManager}`);
      logger.blank();

      // ── 2. Interactive prompts ────────────────────────────────────────────

      const ask = askFn ?? (await import("./prompts/init.prompts")).askInitQuestions;
      const answers = await ask();

      logger.blank();

      // ── 3. Run generators ─────────────────────────────────────────────────

      const { files, installCmd } = runInit({ cwd, packageManager, answers });

      // ── 4. Print summary ──────────────────────────────────────────────────

      for (const result of files) {
        const icon = result.status === "skipped" ? "–" : result.status === "created" ? "+" : "~";
        const label =
          result.status === "created"
            ? "created"
            : result.status === "updated"
              ? "updated"
              : "skipped";
        logger.info(`  ${icon} ${result.path} (${label})`);
      }

      logger.blank();

      if (installCmd) {
        logger.info("Install missing dependencies:");
        logger.info(`  ${installCmd}`);
        logger.blank();
      }

      logger.success("OryCMS initialised. Run `orycms config show` to verify your configuration.");
    });
}
