import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildOryCMSConfig, generateOryCMSConfig } from "../generators/orycms-config";
import { generateAppRoutes } from "../generators/admin-route";
import { buildEnvExample, mergeEnvExample, generateEnvExample } from "../generators/env-example";
import {
  buildNextConfig,
  injectOryCMSComment,
  generateNextConfig,
} from "../generators/next-config";
import { generateTsConfig } from "../generators/tsconfig-updater";
import { resolveDependencies, generatePackageJson } from "../generators/package-json-updater";
import type { InitContext } from "../types";
import { readTextFile, fileExists, readJsonFile } from "../../../shared/fs";

// ── Fixture helpers ───────────────────────────────────────────────────────────

let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "orycms-init-gen-"));
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

function makeCtx(overrides: Partial<InitContext["answers"]> = {}): InitContext {
  return {
    cwd,
    packageManager: "npm",
    answers: {
      database: "postgresql",
      auth: "better-auth",
      plugins: [],
      ...overrides,
    },
  };
}

// ── orycms-config ─────────────────────────────────────────────────────────────

describe("buildOryCMSConfig", () => {
  it("includes defineOryCMSConfig call", () => {
    const content = buildOryCMSConfig(makeCtx());
    expect(content).toContain("defineOryCMSConfig");
  });

  it("includes selected database provider", () => {
    const content = buildOryCMSConfig(makeCtx({ database: "neon" }));
    expect(content).toContain("neon");
  });

  it("includes selected auth provider", () => {
    const content = buildOryCMSConfig(makeCtx({ auth: "clerk" }));
    expect(content).toContain("clerk");
  });

  it("includes plugin entries when plugins are selected", () => {
    const content = buildOryCMSConfig(makeCtx({ plugins: ["@ory-cms/plugin-seo"] }));
    expect(content).toContain("@ory-cms/plugin-seo");
  });

  it("produces empty entries array when no plugins selected", () => {
    const content = buildOryCMSConfig(makeCtx({ plugins: [] }));
    expect(content).toContain("entries: []");
  });
});

describe("generateOryCMSConfig", () => {
  it("creates orycms.config.ts when absent", () => {
    const result = generateOryCMSConfig(makeCtx());
    expect(result.status).toBe("created");
    expect(fileExists(join(cwd, "orycms.config.ts"))).toBe(true);
  });

  it("skips when orycms.config.ts already contains defineOryCMSConfig", () => {
    writeFileSync(join(cwd, "orycms.config.ts"), "export default defineOryCMSConfig({})");
    const result = generateOryCMSConfig(makeCtx());
    expect(result.status).toBe("skipped");
  });

  it("is idempotent — running twice leaves file unchanged", () => {
    generateOryCMSConfig(makeCtx());
    const first = readTextFile(join(cwd, "orycms.config.ts"));
    generateOryCMSConfig(makeCtx());
    const second = readTextFile(join(cwd, "orycms.config.ts"));
    expect(first).toBe(second);
  });
});

// ── admin-route ───────────────────────────────────────────────────────────────

describe("generateAppRoutes", () => {
  it("writes orycms component bodies and thin app-route shims", () => {
    mkdirSync(join(cwd, "app"), { recursive: true });
    const results = generateAppRoutes(makeCtx());
    // 3 routes × (orycms body + app shim) = 6 files
    expect(results).toHaveLength(6);
    expect(results.every((r) => r.status === "created")).toBe(true);
    // Bodies live under orycms/, entry files under app/
    expect(results.some((r) => r.path === "orycms/admin/admin-page.tsx")).toBe(true);
    expect(results.some((r) => r.path === "app/admin/page.tsx")).toBe(true);
  });

  it("app-route shims re-export their orycms body", () => {
    mkdirSync(join(cwd, "app"), { recursive: true });
    generateAppRoutes(makeCtx());
    const shim = readTextFile(join(cwd, "app/admin/page.tsx"));
    expect(shim).toContain('from "../../orycms/admin/admin-page"');
  });

  it("keeps all CMS source inside orycms/ (app files are shims only)", () => {
    mkdirSync(join(cwd, "app"), { recursive: true });
    generateAppRoutes(makeCtx());
    const shim = readTextFile(join(cwd, "app/collections/page.tsx"));
    // A shim is a single re-export line, not a component body
    expect(shim).not.toContain("export default function");
    expect(shim).toContain("export { default }");
  });

  it("skips routes that already exist", () => {
    mkdirSync(join(cwd, "app/admin"), { recursive: true });
    writeFileSync(join(cwd, "app/admin/page.tsx"), "existing");
    const results = generateAppRoutes(makeCtx());
    const admin = results.find((r) => r.path === "app/admin/page.tsx")!;
    expect(admin.status).toBe("skipped");
  });

  it("is idempotent — skips all on second run", () => {
    mkdirSync(join(cwd, "app"), { recursive: true });
    generateAppRoutes(makeCtx());
    const second = generateAppRoutes(makeCtx());
    expect(second.every((r) => r.status === "skipped")).toBe(true);
  });
});

// ── env-example ───────────────────────────────────────────────────────────────

describe("buildEnvExample", () => {
  it("includes OryCMS sentinel comment", () => {
    expect(buildEnvExample(makeCtx())).toContain("# OryCMS");
  });

  it("includes postgresql DATABASE_URL for postgresql provider", () => {
    const content = buildEnvExample(makeCtx({ database: "postgresql" }));
    expect(content).toContain("DATABASE_URL=postgresql://");
  });

  it("includes Supabase env vars for supabase provider", () => {
    const content = buildEnvExample(makeCtx({ database: "supabase" }));
    expect(content).toContain("SUPABASE_URL");
    expect(content).toContain("SUPABASE_ANON_KEY");
  });

  it("includes Better Auth vars", () => {
    const content = buildEnvExample(makeCtx({ auth: "better-auth" }));
    expect(content).toContain("BETTER_AUTH_SECRET");
  });

  it("includes Clerk vars", () => {
    const content = buildEnvExample(makeCtx({ auth: "clerk" }));
    expect(content).toContain("CLERK_SECRET_KEY");
  });

  it("no auth vars for 'none' provider", () => {
    const content = buildEnvExample(makeCtx({ auth: "none" }));
    expect(content).not.toContain("AUTH_SECRET");
    expect(content).not.toContain("CLERK_SECRET_KEY");
  });
});

describe("mergeEnvExample", () => {
  it("appends new vars that are not already present", () => {
    const result = mergeEnvExample("EXISTING=1\n", "NEW_VAR=2\n");
    expect(result).toContain("EXISTING=1");
    expect(result).toContain("NEW_VAR=2");
  });

  it("does not duplicate existing lines", () => {
    const existing = "DATABASE_URL=postgresql://...\n";
    const result = mergeEnvExample(existing, existing);
    expect(result.split("DATABASE_URL").length - 1).toBe(1);
  });
});

describe("generateEnvExample", () => {
  it("creates .env.example when absent", () => {
    const result = generateEnvExample(makeCtx());
    expect(result.status).toBe("created");
    expect(fileExists(join(cwd, ".env.example"))).toBe(true);
  });

  it("skips when OryCMS sentinel already present", () => {
    writeFileSync(join(cwd, ".env.example"), "# OryCMS\nORYCMS_DATABASE_URL=x\n");
    expect(generateEnvExample(makeCtx()).status).toBe("skipped");
  });

  it("merges into existing .env.example without OryCMS vars", () => {
    writeFileSync(join(cwd, ".env.example"), "MY_VAR=hello\n");
    const result = generateEnvExample(makeCtx());
    expect(result.status).toBe("updated");
    const content = readTextFile(join(cwd, ".env.example"));
    expect(content).toContain("MY_VAR=hello");
    expect(content).toContain("DATABASE_URL");
  });
});

// ── next-config ───────────────────────────────────────────────────────────────

describe("buildNextConfig", () => {
  it("includes the orycms sentinel comment", () => {
    expect(buildNextConfig()).toContain("// orycms");
  });

  it("is valid TypeScript module shape", () => {
    const content = buildNextConfig();
    expect(content).toContain("NextConfig");
    expect(content).toContain("export default");
  });
});

describe("injectOryCMSComment", () => {
  it("injects comment before nextConfig declaration", () => {
    const source = `import type { NextConfig } from "next";\nconst nextConfig: NextConfig = {};\nexport default nextConfig;\n`;
    const result = injectOryCMSComment(source);
    expect(result).toContain("// orycms");
    expect(result.indexOf("// orycms")).toBeLessThan(result.indexOf("const nextConfig"));
  });

  it("is idempotent — does not inject twice", () => {
    const source = `// orycms\nconst nextConfig = {};\nexport default nextConfig;\n`;
    expect(injectOryCMSComment(source)).toBe(source);
  });
});

describe("generateNextConfig", () => {
  it("creates next.config.ts when none exists", () => {
    const result = generateNextConfig(makeCtx());
    expect(result.status).toBe("created");
    expect(fileExists(join(cwd, "next.config.ts"))).toBe(true);
  });

  it("updates existing next.config.ts", () => {
    writeFileSync(
      join(cwd, "next.config.ts"),
      `import type { NextConfig } from "next";\nconst nextConfig: NextConfig = {};\nexport default nextConfig;\n`,
    );
    const result = generateNextConfig(makeCtx());
    expect(result.status).toBe("updated");
    expect(readTextFile(join(cwd, "next.config.ts"))).toContain("// orycms");
  });

  it("skips when sentinel already present", () => {
    writeFileSync(join(cwd, "next.config.ts"), "// orycms\nexport default {};\n");
    expect(generateNextConfig(makeCtx()).status).toBe("skipped");
  });
});

// ── tsconfig-updater ──────────────────────────────────────────────────────────

describe("generateTsConfig", () => {
  it("skips when tsconfig.json is absent", () => {
    expect(generateTsConfig(makeCtx()).status).toBe("skipped");
  });

  it("always skips — @ory-cms packages install from npm, no path aliases needed", () => {
    writeFileSync(
      join(cwd, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } } }),
    );
    const result = generateTsConfig(makeCtx());
    expect(result.status).toBe("skipped");
  });

  it("does not add @ory-cms/* to tsconfig paths", () => {
    writeFileSync(
      join(cwd, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } } }),
    );
    generateTsConfig(makeCtx());
    const ts = readJsonFile<{ compilerOptions: { paths: Record<string, string[]> } }>(
      join(cwd, "tsconfig.json"),
    );
    expect(ts.compilerOptions.paths["@ory-cms/*"]).toBeUndefined();
  });

  it("does not modify the tsconfig file", () => {
    const original = JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } } });
    writeFileSync(join(cwd, "tsconfig.json"), original);
    generateTsConfig(makeCtx());
    expect(readTextFile(join(cwd, "tsconfig.json"))).toBe(original);
  });
});

// ── package-json-updater ──────────────────────────────────────────────────────

describe("resolveDependencies", () => {
  it("always includes @ory-cms/core and @ory-cms/next", () => {
    const deps = resolveDependencies("postgresql", "none", []);
    expect(deps).toContain("@ory-cms/core");
    expect(deps).toContain("@ory-cms/next");
  });

  it("includes DB packages for postgresql", () => {
    const deps = resolveDependencies("postgresql", "none", []);
    expect(deps).toContain("pg");
    expect(deps).toContain("@types/pg");
  });

  it("includes auth packages for better-auth", () => {
    const deps = resolveDependencies("postgresql", "better-auth", []);
    expect(deps).toContain("better-auth");
  });

  it("includes plugin packages", () => {
    const deps = resolveDependencies("postgresql", "none", ["@ory-cms/plugin-seo"]);
    expect(deps).toContain("@ory-cms/plugin-seo");
  });

  it("no auth packages when auth=none", () => {
    const deps = resolveDependencies("postgresql", "none", []);
    expect(deps).not.toContain("better-auth");
    expect(deps).not.toContain("next-auth");
  });
});

describe("generatePackageJson", () => {
  it("skips when package.json is absent", () => {
    expect(generatePackageJson(makeCtx()).status).toBe("skipped");
  });

  it("adds missing dependencies to package.json", () => {
    writeFileSync(join(cwd, "package.json"), JSON.stringify({ dependencies: {} }));
    const result = generatePackageJson(makeCtx());
    expect(result.status).toBe("updated");
    expect(result.toInstall.length).toBeGreaterThan(0);
    expect(result.toInstall).toContain("@ory-cms/core");
    expect(result.toInstall).toContain("@ory-cms/next");
  });

  it("skips deps already present", () => {
    const existing = {
      dependencies: { "@ory-cms/core": "^1.0.0", "@ory-cms/next": "^1.0.0", pg: "^8", "@types/pg": "^8", "better-auth": "^1" },
    };
    writeFileSync(join(cwd, "package.json"), JSON.stringify(existing));
    const result = generatePackageJson(makeCtx());
    expect(result.toInstall).not.toContain("@ory-cms/core");
    expect(result.toInstall).not.toContain("@ory-cms/next");
  });

  it("is idempotent — second run adds nothing new", () => {
    writeFileSync(join(cwd, "package.json"), JSON.stringify({ dependencies: {} }));
    generatePackageJson(makeCtx());
    // Read back and run again — all deps now present
    const result2 = generatePackageJson(makeCtx());
    expect(result2.toInstall).toHaveLength(0);
  });
});
