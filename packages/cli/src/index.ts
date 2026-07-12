#!/usr/bin/env node
import { Command } from "commander";

import { registerConfigCommands } from "./commands/config/index";
import { registerInitCommand } from "./commands/init/index";
import { registerPluginCommands } from "./commands/plugin/index";

const program = new Command();

program.name("orycms").description("OryCMS command-line interface").version("0.1.0");

registerInitCommand(program);
registerPluginCommands(program);
registerConfigCommands(program);

program.parse();
