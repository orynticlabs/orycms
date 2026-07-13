import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: false,
  // ponytail: node builtins + runtime deps external — resolved from node_modules at runtime
  external: [
    "pg",
    "pg-protocol",
    "bcryptjs",
    "crypto",
    "fs",
    "path",
    "node:crypto",
    "node:fs",
    "node:path",
    "node:os",
    "node:url",
    "node:buffer",
    "node:stream",
    "node:net",
    "node:tls",
    "node:events",
  ],
  esbuildOptions(options) {
    options.alias = { "@": "./src" };
  },
});
