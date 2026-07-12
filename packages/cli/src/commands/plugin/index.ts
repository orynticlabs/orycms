import type { Command } from "commander";

import { registerDisableCommand } from "./disable";
import { registerEnableCommand } from "./enable";
import { registerInstallCommand } from "./install";
import { registerListCommand } from "./list";
import { registerUninstallCommand } from "./uninstall";
import { registerUpdateCommand } from "./update";

export function registerPluginCommands(program: Command): void {
  const plugin = program.command("plugin").description("Manage OryCMS plugins");

  registerInstallCommand(plugin);
  registerUninstallCommand(plugin);
  registerUpdateCommand(plugin);
  registerListCommand(plugin);
  registerEnableCommand(plugin);
  registerDisableCommand(plugin);
}
