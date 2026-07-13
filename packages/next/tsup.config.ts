import { defineConfig } from "tsup";
import { copyFileSync } from "fs";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: false,
  // All peer deps and large UI deps are external — resolved from host node_modules
  external: [
    "@ory-cms/core",
    "react",
    "react-dom",
    "next",
    /^next\//,
    /^@radix-ui\//,
    "class-variance-authority",
    "clsx",
    "tailwind-merge",
    "cmdk",
    "date-fns",
    "embla-carousel-react",
    "input-otp",
    "lucide-react",
    "react-day-picker",
    "react-hook-form",
    "@hookform/resolvers",
    "react-resizable-panels",
    "recharts",
    "sonner",
    "vaul",
    "zod",
  ],
  esbuildOptions(options) {
    options.alias = { "@": "./src" };
  },
  async onSuccess() {
    copyFileSync("src/styles.css", "dist/styles.css");
    console.log("Copied styles.css → dist/styles.css");
  },
});
