import { describe, expect, it } from "vitest";

import { DATABASE_PROVIDERS } from "../database/index";
import type { DatabaseProviderDefinition } from "../database/types";
import type { DatabaseProvider } from "../types";

// ── Contract tests applied to every provider ──────────────────────────────────

const ALL_PROVIDERS = Object.entries(DATABASE_PROVIDERS) as [
  DatabaseProvider,
  DatabaseProviderDefinition,
][];

describe.each(ALL_PROVIDERS)("%s provider — contract", (_key, provider) => {
  it("has a non-empty name", () => {
    expect(provider.name.length).toBeGreaterThan(0);
  });

  it("requiredPackages() returns at least one package", () => {
    expect(provider.requiredPackages().length).toBeGreaterThan(0);
  });

  it("generateEnvVariables() returns KEY=value lines", () => {
    const lines = provider.generateEnvVariables();
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).toMatch(/^[A-Z_]+=.+/);
    }
  });

  it("connectionInstructions() returns non-empty string", () => {
    expect(provider.connectionInstructions().trim().length).toBeGreaterThan(0);
  });

  it("migrationInstructions() returns non-empty string", () => {
    expect(provider.migrationInstructions().trim().length).toBeGreaterThan(0);
  });

  it("seedInstructions() returns non-empty string", () => {
    expect(provider.seedInstructions().trim().length).toBeGreaterThan(0);
  });

  it("validateConfig() returns errors when env is empty", () => {
    expect(provider.validateConfig({})).not.toHaveLength(0);
  });

  it("validateConfig() defaults to empty env when called with no args", () => {
    expect(provider.validateConfig()).not.toHaveLength(0);
  });
});

// ── Provider-specific validateConfig assertions ────────────────────────────────

describe("postgresql — validateConfig", () => {
  const p = DATABASE_PROVIDERS.postgresql;

  it("passes when DATABASE_URL is set", () => {
    expect(p.validateConfig({ DATABASE_URL: "postgresql://..." })).toHaveLength(0);
  });

  it("error names DATABASE_URL when missing", () => {
    expect(p.validateConfig({})[0]).toContain("DATABASE_URL");
  });
});

describe("mysql — validateConfig", () => {
  const p = DATABASE_PROVIDERS.mysql;

  it("passes when DATABASE_URL is set", () => {
    expect(p.validateConfig({ DATABASE_URL: "mysql://..." })).toHaveLength(0);
  });

  it("error names DATABASE_URL when missing", () => {
    expect(p.validateConfig({})[0]).toContain("DATABASE_URL");
  });
});

describe("mongodb — validateConfig", () => {
  const p = DATABASE_PROVIDERS.mongodb;

  it("passes when MONGODB_URI is set", () => {
    expect(p.validateConfig({ MONGODB_URI: "mongodb://..." })).toHaveLength(0);
  });

  it("error names MONGODB_URI when missing", () => {
    expect(p.validateConfig({})[0]).toContain("MONGODB_URI");
  });
});

describe("supabase — validateConfig", () => {
  const p = DATABASE_PROVIDERS.supabase;

  const fullEnv = {
    SUPABASE_URL: "https://x.supabase.co",
    SUPABASE_ANON_KEY: "anon",
    SUPABASE_SERVICE_KEY: "service",
  };

  it("passes when all three vars are set", () => {
    expect(p.validateConfig(fullEnv)).toHaveLength(0);
  });

  it("reports three errors when env is empty", () => {
    expect(p.validateConfig({})).toHaveLength(3);
  });

  it("reports missing SUPABASE_URL", () => {
    const { SUPABASE_URL: _, ...rest } = fullEnv;
    expect(p.validateConfig(rest).some((e) => e.includes("SUPABASE_URL"))).toBe(true);
  });

  it("reports missing SUPABASE_ANON_KEY", () => {
    const { SUPABASE_ANON_KEY: _, ...rest } = fullEnv;
    expect(p.validateConfig(rest).some((e) => e.includes("SUPABASE_ANON_KEY"))).toBe(true);
  });

  it("reports missing SUPABASE_SERVICE_KEY", () => {
    const { SUPABASE_SERVICE_KEY: _, ...rest } = fullEnv;
    expect(p.validateConfig(rest).some((e) => e.includes("SUPABASE_SERVICE_KEY"))).toBe(true);
  });
});

describe("neon — validateConfig", () => {
  const p = DATABASE_PROVIDERS.neon;

  it("passes when DATABASE_URL is set", () => {
    expect(p.validateConfig({ DATABASE_URL: "postgresql://...neon.tech/mydb?sslmode=require" })).toHaveLength(0);
  });

  it("error names DATABASE_URL when missing", () => {
    expect(p.validateConfig({})[0]).toContain("DATABASE_URL");
  });
});

describe("firebase — validateConfig", () => {
  const p = DATABASE_PROVIDERS.firebase;

  const fullEnv = {
    FIREBASE_PROJECT_ID: "my-project",
    FIREBASE_PRIVATE_KEY: "-----BEGIN RSA PRIVATE KEY-----",
    FIREBASE_CLIENT_EMAIL: "sa@my-project.iam.gserviceaccount.com",
  };

  it("passes when all three vars are set", () => {
    expect(p.validateConfig(fullEnv)).toHaveLength(0);
  });

  it("reports three errors when env is empty", () => {
    expect(p.validateConfig({})).toHaveLength(3);
  });

  it("reports missing FIREBASE_PROJECT_ID", () => {
    const { FIREBASE_PROJECT_ID: _, ...rest } = fullEnv;
    expect(p.validateConfig(rest).some((e) => e.includes("FIREBASE_PROJECT_ID"))).toBe(true);
  });

  it("reports missing FIREBASE_PRIVATE_KEY", () => {
    const { FIREBASE_PRIVATE_KEY: _, ...rest } = fullEnv;
    expect(p.validateConfig(rest).some((e) => e.includes("FIREBASE_PRIVATE_KEY"))).toBe(true);
  });

  it("reports missing FIREBASE_CLIENT_EMAIL", () => {
    const { FIREBASE_CLIENT_EMAIL: _, ...rest } = fullEnv;
    expect(p.validateConfig(rest).some((e) => e.includes("FIREBASE_CLIENT_EMAIL"))).toBe(true);
  });
});

// ── Registry completeness ─────────────────────────────────────────────────────

describe("DATABASE_PROVIDERS registry", () => {
  const EXPECTED_PROVIDERS: DatabaseProvider[] = [
    "postgresql",
    "mysql",
    "mariadb",
    "sqlite",
    "mongodb",
    "supabase",
    "neon",
    "firebase",
  ];

  it("contains all eight providers", () => {
    expect(Object.keys(DATABASE_PROVIDERS).sort()).toEqual(EXPECTED_PROVIDERS.sort());
  });

  it("every provider key maps to an object with the required methods", () => {
    for (const provider of Object.values(DATABASE_PROVIDERS)) {
      expect(typeof provider.validateConfig).toBe("function");
      expect(typeof provider.requiredPackages).toBe("function");
      expect(typeof provider.generateEnvVariables).toBe("function");
      expect(typeof provider.connectionInstructions).toBe("function");
      expect(typeof provider.migrationInstructions).toBe("function");
      expect(typeof provider.seedInstructions).toBe("function");
    }
  });
});
