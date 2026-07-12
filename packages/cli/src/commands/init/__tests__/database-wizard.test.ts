import { describe, expect, it } from "vitest";

import {
  validateDatabaseWizardResult,
  runDatabaseWizard,
} from "../database/wizard";
import type {
  DatabaseWizardResult,
  PostgresqlWizardResult,
  MysqlWizardResult,
  MariadbWizardResult,
  SqliteWizardResult,
  MongodbWizardResult,
  SupabaseWizardResult,
  NeonWizardResult,
  FirebaseWizardResult,
} from "../database/wizard";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PG: PostgresqlWizardResult = {
  provider: "postgresql",
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "secret",
  database: "mydb",
  ssl: false,
};

const MYSQL: MysqlWizardResult = {
  provider: "mysql",
  host: "localhost",
  port: 3306,
  user: "root",
  password: "",
  database: "mydb",
};

const MARIADB: MariadbWizardResult = {
  provider: "mariadb",
  host: "localhost",
  port: 3306,
  user: "root",
  password: "",
  database: "mydb",
};

const SQLITE: SqliteWizardResult = {
  provider: "sqlite",
  filePath: "./mydb.sqlite",
};

const MONGO: MongodbWizardResult = {
  provider: "mongodb",
  uri: "mongodb://localhost:27017/mydb",
};

const SUPABASE: SupabaseWizardResult = {
  provider: "supabase",
  url: "https://xyz.supabase.co",
  anonKey: "anon-key",
  serviceKey: "service-key",
};

const NEON: NeonWizardResult = {
  provider: "neon",
  databaseUrl: "postgresql://u:p@ep-xxx.us-east-2.aws.neon.tech/mydb?sslmode=require",
};

const FIREBASE: FirebaseWizardResult = {
  provider: "firebase",
  projectId: "my-project",
  privateKey: "-----BEGIN RSA PRIVATE KEY-----\n...",
  clientEmail: "sa@my-project.iam.gserviceaccount.com",
};

const ALL_VALID: DatabaseWizardResult[] = [
  PG, MYSQL, MARIADB, SQLITE, MONGO, SUPABASE, NEON, FIREBASE,
];

// ── validateDatabaseWizardResult — happy paths ────────────────────────────────

describe("validateDatabaseWizardResult — valid configs", () => {
  it.each(ALL_VALID)("$provider returns no errors", (result) => {
    expect(validateDatabaseWizardResult(result)).toHaveLength(0);
  });
});

// ── validateDatabaseWizardResult — postgresql ─────────────────────────────────

describe("validateDatabaseWizardResult — postgresql", () => {
  it("errors when host is empty", () => {
    const errs = validateDatabaseWizardResult({ ...PG, host: "" });
    expect(errs).toContain("host is required");
  });

  it("errors when user is empty", () => {
    const errs = validateDatabaseWizardResult({ ...PG, user: "" });
    expect(errs).toContain("user is required");
  });

  it("errors when database is empty", () => {
    const errs = validateDatabaseWizardResult({ ...PG, database: "" });
    expect(errs).toContain("database is required");
  });

  it("errors when port is 0", () => {
    const errs = validateDatabaseWizardResult({ ...PG, port: 0 });
    expect(errs.some((e) => e.includes("port"))).toBe(true);
  });

  it("errors when port is 65536", () => {
    const errs = validateDatabaseWizardResult({ ...PG, port: 65536 });
    expect(errs.some((e) => e.includes("port"))).toBe(true);
  });

  it("errors when port is a float", () => {
    const errs = validateDatabaseWizardResult({ ...PG, port: 54.5 });
    expect(errs.some((e) => e.includes("port"))).toBe(true);
  });

  it("accepts port 1", () => {
    expect(validateDatabaseWizardResult({ ...PG, port: 1 })).toHaveLength(0);
  });

  it("accepts port 65535", () => {
    expect(validateDatabaseWizardResult({ ...PG, port: 65535 })).toHaveLength(0);
  });

  it("allows empty password (optional)", () => {
    expect(validateDatabaseWizardResult({ ...PG, password: "" })).toHaveLength(0);
  });

  it("ssl=true is valid", () => {
    expect(validateDatabaseWizardResult({ ...PG, ssl: true })).toHaveLength(0);
  });

  it("collects multiple errors at once", () => {
    const errs = validateDatabaseWizardResult({ ...PG, host: "", user: "", database: "" });
    expect(errs).toHaveLength(3);
  });
});

// ── validateDatabaseWizardResult — mysql ──────────────────────────────────────

describe("validateDatabaseWizardResult — mysql", () => {
  it("errors when host is empty", () => {
    expect(validateDatabaseWizardResult({ ...MYSQL, host: "" })).toContain("host is required");
  });

  it("errors when user is empty", () => {
    expect(validateDatabaseWizardResult({ ...MYSQL, user: "" })).toContain("user is required");
  });

  it("errors when database is empty", () => {
    expect(validateDatabaseWizardResult({ ...MYSQL, database: "" })).toContain("database is required");
  });

  it("errors on invalid port", () => {
    expect(
      validateDatabaseWizardResult({ ...MYSQL, port: -1 }).some((e) => e.includes("port")),
    ).toBe(true);
  });
});

// ── validateDatabaseWizardResult — mariadb ────────────────────────────────────

describe("validateDatabaseWizardResult — mariadb", () => {
  it("errors when host is empty", () => {
    expect(validateDatabaseWizardResult({ ...MARIADB, host: "" })).toContain("host is required");
  });

  it("errors when database is empty", () => {
    expect(validateDatabaseWizardResult({ ...MARIADB, database: "" })).toContain(
      "database is required",
    );
  });

  it("valid config returns no errors", () => {
    expect(validateDatabaseWizardResult(MARIADB)).toHaveLength(0);
  });
});

// ── validateDatabaseWizardResult — sqlite ─────────────────────────────────────

describe("validateDatabaseWizardResult — sqlite", () => {
  it("errors when filePath is empty", () => {
    expect(validateDatabaseWizardResult({ provider: "sqlite", filePath: "" })).toContain(
      "filePath is required",
    );
  });

  it("errors when filePath is whitespace-only", () => {
    expect(validateDatabaseWizardResult({ provider: "sqlite", filePath: "  " })).toContain(
      "filePath is required",
    );
  });

  it("any non-empty path is valid", () => {
    expect(validateDatabaseWizardResult({ provider: "sqlite", filePath: ":memory:" })).toHaveLength(0);
  });
});

// ── validateDatabaseWizardResult — mongodb ────────────────────────────────────

describe("validateDatabaseWizardResult — mongodb", () => {
  it("errors when uri is empty", () => {
    expect(validateDatabaseWizardResult({ provider: "mongodb", uri: "" })).toContain(
      "uri is required",
    );
  });

  it("valid uri returns no errors", () => {
    expect(validateDatabaseWizardResult(MONGO)).toHaveLength(0);
  });
});

// ── validateDatabaseWizardResult — supabase ───────────────────────────────────

describe("validateDatabaseWizardResult — supabase", () => {
  it("errors when url is empty", () => {
    expect(validateDatabaseWizardResult({ ...SUPABASE, url: "" })).toContain("url is required");
  });

  it("errors when anonKey is empty", () => {
    expect(validateDatabaseWizardResult({ ...SUPABASE, anonKey: "" })).toContain(
      "anonKey is required",
    );
  });

  it("errors when serviceKey is empty", () => {
    expect(validateDatabaseWizardResult({ ...SUPABASE, serviceKey: "" })).toContain(
      "serviceKey is required",
    );
  });

  it("reports all three errors at once", () => {
    expect(
      validateDatabaseWizardResult({ provider: "supabase", url: "", anonKey: "", serviceKey: "" }),
    ).toHaveLength(3);
  });
});

// ── validateDatabaseWizardResult — neon ───────────────────────────────────────

describe("validateDatabaseWizardResult — neon", () => {
  it("errors when databaseUrl is empty", () => {
    expect(validateDatabaseWizardResult({ provider: "neon", databaseUrl: "" })).toContain(
      "databaseUrl is required",
    );
  });

  it("valid url returns no errors", () => {
    expect(validateDatabaseWizardResult(NEON)).toHaveLength(0);
  });
});

// ── validateDatabaseWizardResult — firebase ───────────────────────────────────

describe("validateDatabaseWizardResult — firebase", () => {
  it("errors when projectId is empty", () => {
    expect(validateDatabaseWizardResult({ ...FIREBASE, projectId: "" })).toContain(
      "projectId is required",
    );
  });

  it("errors when privateKey is empty", () => {
    expect(validateDatabaseWizardResult({ ...FIREBASE, privateKey: "" })).toContain(
      "privateKey is required",
    );
  });

  it("errors when clientEmail is empty", () => {
    expect(validateDatabaseWizardResult({ ...FIREBASE, clientEmail: "" })).toContain(
      "clientEmail is required",
    );
  });

  it("reports all three errors at once", () => {
    expect(
      validateDatabaseWizardResult({
        provider: "firebase",
        projectId: "",
        privateKey: "",
        clientEmail: "",
      }),
    ).toHaveLength(3);
  });
});

// ── runDatabaseWizard — orchestrator ─────────────────────────────────────────

describe("runDatabaseWizard", () => {
  it("returns the result from the injected askFn", async () => {
    const result = await runDatabaseWizard(async () => PG);
    expect(result).toEqual(PG);
  });

  it("throws when the injected askFn returns an invalid config", async () => {
    const bad: PostgresqlWizardResult = { ...PG, host: "", database: "" };
    await expect(runDatabaseWizard(async () => bad)).rejects.toThrow(
      "Database configuration invalid",
    );
  });

  it("error message lists all failing fields", async () => {
    const bad: PostgresqlWizardResult = { ...PG, host: "", user: "" };
    let caught: Error | undefined;
    try {
      await runDatabaseWizard(async () => bad);
    } catch (e) {
      caught = e as Error;
    }
    expect(caught?.message).toContain("host is required");
    expect(caught?.message).toContain("user is required");
  });

  it.each(ALL_VALID)("passes through a valid $provider config", async (config) => {
    const result = await runDatabaseWizard(async () => config);
    expect(result).toEqual(config);
  });

  it("re-throws errors from the askFn itself", async () => {
    const boom = async (): Promise<DatabaseWizardResult> => {
      throw new Error("TTY unavailable");
    };
    await expect(runDatabaseWizard(boom)).rejects.toThrow("TTY unavailable");
  });
});
