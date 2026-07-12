import type { Command } from "commander";

import { registerConfigInitCommand } from "./init";
import { registerConfigShowCommand } from "./show";

export function registerConfigCommands(program: Command): void {
  const config = program.command("config").description("Manage OryCMS configuration");

  registerConfigShowCommand(config);
  registerConfigInitCommand(config);
}
