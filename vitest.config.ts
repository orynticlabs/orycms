import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    // Exclude packages/core and packages/next — they have their own vitest configs
    exclude: [
      "packages/core/**",
      "packages/next/**",
      "**/node_modules/**",
    ],
  },
  resolve: {
    alias: { "@": path.join(process.cwd(), "src") },
  },
});
