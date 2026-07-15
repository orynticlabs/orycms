import { defineConfig } from "tsup";
import path from "path";
import { chmodSync } from "fs";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  clean: true,
  sourcemap: false,
  dts: false,
  external: [
    "@inquirer/prompts",
    "commander",
    "pg",
    "bcryptjs",
    "better-sqlite3",
    "mysql2",
    "mongoose",
    "firebase-admin",
    "@supabase/supabase-js",
    "@neondatabase/serverless",
  ],
  esbuildOptions(options) {
    // Root monorepo src/ files (pulled in transitively via the CLI) use the @/ alias
    options.alias = { "@": path.resolve(__dirname, "../../src") };
  },
  async onSuccess() {
    chmodSync("dist/index.js", 0o755);
    console.log("Made dist/index.js executable");
  },
});
