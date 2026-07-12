#!/usr/bin/env node
import { Command } from "commander";

import { logger } from "../../cli/src/shared/logger";
import { detectNextJs } from "../../cli/src/commands/init/detectors/nextjs";
import { runCreate, createSummaryLines } from "./runner";
import type { CreateAskFn } from "./runner";

// ── CLI registration ───────────────────────────────────────────────────────────

/**
 * Register the create-orycms command on a Commander program.
 * Accepts an optional `askFn` for test injection (bypasses @inquirer/prompts).
 */
export function registerCreateCommand(program: Command, askFn?: CreateAskFn): void {
  program
    .name("create-orycms")
    .description("Add OryCMS to a Next.js project")
    .option("--cwd <path>", "Target directory (defaults to process.cwd())")
    .option("--skip-db", "Skip database connection test and DB operations")
    .action(async (opts: { cwd?: string; skipDb?: boolean }) => {
      const cwd = opts.cwd ?? process.cwd();
      const skipDbOps = opts.skipDb ?? false;

      // ── Detect Next.js ────────────────────────────────────────────────────
      const nextInfo = detectNextJs(cwd);
      if (nextInfo.detected) {
        logger.info(
          `Detected: Next.js ${nextInfo.nextVersion ?? ""} | ${nextInfo.hasAppRouter ? "App Router" : "Pages Router"}`,
        );
      } else {
        logger.warn(
          "No Next.js project detected. Files will be created but you may need to install Next.js separately.",
        );
      }
      logger.blank();

      // ── Prompts ───────────────────────────────────────────────────────────
      const ask: CreateAskFn =
        askFn ?? (await import("./prompts")).askCreateQuestions;

      const answers = await ask(cwd);
      logger.blank();

      // ── Run ───────────────────────────────────────────────────────────────
      const result = await runCreate({ cwd, answers, skipDbOps });

      // ── Summary ───────────────────────────────────────────────────────────
      logger.blank();
      for (const f of result.files) {
        const icon =
          f.status === "created" ? "+" : f.status === "updated" ? "~" : "–";
        logger.info(
          `  ${icon} ${f.path} (${f.status})`,
        );
      }
      logger.blank();

      if (result.installCmd) {
        logger.info("Install dependencies:");
        logger.info(`  ${result.installCmd}`);
        logger.blank();
      }

      if (!skipDbOps) {
        if (result.dbConnected) {
          logger.success("Database connection verified.");
        } else {
          logger.warn(
            "Database connection could not be verified. Configure your .env file and test manually.",
          );
        }
        logger.blank();
      }

      logger.success("OryCMS is ready!");
      logger.blank();

      for (const line of createSummaryLines(result)) {
        if (line === "") {
          logger.blank();
        } else {
          logger.info(`  ${line}`);
        }
      }
      logger.blank();
    });
}

// ── Entry point ────────────────────────────────────────────────────────────────

const program = new Command();
program.version("0.1.0");
registerCreateCommand(program);
program.parse();
