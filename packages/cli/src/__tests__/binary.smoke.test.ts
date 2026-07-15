/**
 * Smoke test: the built dist/index.js must load through Node's ESM loader
 * without ERR_MODULE_NOT_FOUND. This guards against the tsc-era regression
 * where extensionless relative imports crashed the published binary.
 *
 * Runs the real compiled binary in a child process with --help.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const DIST = join(__dirname, "../../dist/index.js");

describe("built binary", () => {
  it("dist/index.js exists (build ran)", () => {
    expect(existsSync(DIST)).toBe(true);
  });

  it("loads and prints help without ERR_MODULE_NOT_FOUND", () => {
    // If any import is unresolved, node exits non-zero and throws here.
    const out = execFileSync("node", [DIST, "--help"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    expect(out).toContain("orycms");
    expect(out).toContain("init");
  });
});
