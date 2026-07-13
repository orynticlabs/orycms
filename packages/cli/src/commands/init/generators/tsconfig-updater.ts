import type { GeneratorResult, InitContext } from "../types";

/**
 * Previously added @ory-cms/* path aliases to the host tsconfig.
 * No longer needed — users install @ory-cms/core and @ory-cms/next from npm,
 * which TypeScript resolves from node_modules without any path aliases.
 */
export function generateTsConfig(_ctx: InitContext): GeneratorResult {
  return {
    path: "tsconfig.json",
    status: "skipped",
    description: "no path aliases needed — @ory-cms packages install from npm",
  };
}
