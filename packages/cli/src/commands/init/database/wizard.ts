import type { DatabaseProvider } from "../types";

// ── Per-provider result types (discriminated union) ───────────────────────────

type HostPortFields = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

export type PostgresqlWizardResult = { provider: "postgresql" } & HostPortFields & { ssl: boolean };
export type MysqlWizardResult = { provider: "mysql" } & HostPortFields;
export type MariadbWizardResult = { provider: "mariadb" } & HostPortFields;
export type SqliteWizardResult = { provider: "sqlite"; filePath: string };
export type MongodbWizardResult = { provider: "mongodb"; uri: string };
export type SupabaseWizardResult = {
  provider: "supabase";
  url: string;
  anonKey: string;
  serviceKey: string;
};
export type NeonWizardResult = { provider: "neon"; databaseUrl: string };
export type FirebaseWizardResult = {
  provider: "firebase";
  projectId: string;
  privateKey: string;
  clientEmail: string;
};

export type DatabaseWizardResult =
  | PostgresqlWizardResult
  | MysqlWizardResult
  | MariadbWizardResult
  | SqliteWizardResult
  | MongodbWizardResult
  | SupabaseWizardResult
  | NeonWizardResult
  | FirebaseWizardResult;

// ── Pure validation ───────────────────────────────────────────────────────────

/** Returns an error string for every invalid field; empty array = valid. */
export function validateDatabaseWizardResult(result: DatabaseWizardResult): string[] {
  const errors: string[] = [];

  switch (result.provider) {
    case "postgresql":
    case "mysql":
    case "mariadb":
      if (!result.host.trim()) errors.push("host is required");
      if (!result.user.trim()) errors.push("user is required");
      if (!result.database.trim()) errors.push("database is required");
      if (!Number.isInteger(result.port) || result.port < 1 || result.port > 65535)
        errors.push("port must be an integer between 1 and 65535");
      break;
    case "sqlite":
      if (!result.filePath.trim()) errors.push("filePath is required");
      break;
    case "mongodb":
      if (!result.uri.trim()) errors.push("uri is required");
      break;
    case "supabase":
      if (!result.url.trim()) errors.push("url is required");
      if (!result.anonKey.trim()) errors.push("anonKey is required");
      if (!result.serviceKey.trim()) errors.push("serviceKey is required");
      break;
    case "neon":
      if (!result.databaseUrl.trim()) errors.push("databaseUrl is required");
      break;
    case "firebase":
      if (!result.projectId.trim()) errors.push("projectId is required");
      if (!result.privateKey.trim()) errors.push("privateKey is required");
      if (!result.clientEmail.trim()) errors.push("clientEmail is required");
      break;
  }

  return errors;
}

// ── Injectable ask-function type ──────────────────────────────────────────────

/**
 * Signature of the interactive wizard function.
 * Tests supply a stub; the default implementation uses @inquirer/prompts.
 */
export type DatabaseWizardAskFn = () => Promise<DatabaseWizardResult>;

// ── Interactive implementation ────────────────────────────────────────────────

const PROVIDER_CHOICES: Array<{ name: string; value: DatabaseProvider }> = [
  { name: "PostgreSQL", value: "postgresql" },
  { name: "MySQL", value: "mysql" },
  { name: "MariaDB", value: "mariadb" },
  { name: "SQLite", value: "sqlite" },
  { name: "MongoDB", value: "mongodb" },
  { name: "Supabase", value: "supabase" },
  { name: "Neon (serverless Postgres)", value: "neon" },
  { name: "Firebase", value: "firebase" },
];

const required = (label: string) => (v: string) =>
  v.trim().length > 0 ? true : `${label} is required`;

const validPort = (v: string) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 65535 ? true : "port must be an integer 1–65535";
};

/**
 * Default interactive wizard — asks all provider-specific questions via TTY.
 * Imported lazily so non-interactive environments (CI, tests) never hit TTY.
 */
export async function askDatabaseWizard(): Promise<DatabaseWizardResult> {
  const { select, input, password, confirm } = await import("@inquirer/prompts");

  const provider = await select<DatabaseProvider>({
    message: "Which database provider will you use?",
    choices: PROVIDER_CHOICES,
  });

  switch (provider) {
    case "postgresql": {
      const host = await input({ message: "Host:", default: "localhost", validate: required("host") });
      const portStr = await input({ message: "Port:", default: "5432", validate: validPort });
      const user = await input({ message: "User:", default: "postgres", validate: required("user") });
      const pwd = await password({ message: "Password (leave blank for none):" });
      const database = await input({ message: "Database name:", default: "mydb", validate: required("database") });
      const ssl = await confirm({ message: "Enable SSL?", default: false });
      return { provider, host, port: Number(portStr), user, password: pwd, database, ssl };
    }

    case "mysql":
    case "mariadb": {
      const host = await input({ message: "Host:", default: "localhost", validate: required("host") });
      const portStr = await input({ message: "Port:", default: "3306", validate: validPort });
      const user = await input({ message: "User:", default: "root", validate: required("user") });
      const pwd = await password({ message: "Password (leave blank for none):" });
      const database = await input({ message: "Database name:", default: "mydb", validate: required("database") });
      return { provider, host, port: Number(portStr), user, password: pwd, database };
    }

    case "sqlite": {
      const filePath = await input({
        message: "SQLite file path:",
        default: "./mydb.sqlite",
        validate: required("filePath"),
      });
      return { provider, filePath };
    }

    case "mongodb": {
      const uri = await input({
        message: "MongoDB URI:",
        default: "mongodb://localhost:27017/mydb",
        validate: required("uri"),
      });
      return { provider, uri };
    }

    case "supabase": {
      const url = await input({ message: "Supabase URL:", validate: required("url") });
      const anonKey = await input({ message: "Anon key:", validate: required("anonKey") });
      const serviceKey = await password({ message: "Service key:" });
      return { provider, url, anonKey, serviceKey };
    }

    case "neon": {
      const databaseUrl = await input({
        message: "Neon DATABASE_URL:",
        default: "postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/mydb?sslmode=require",
        validate: required("databaseUrl"),
      });
      return { provider, databaseUrl };
    }

    case "firebase": {
      const projectId = await input({ message: "Firebase project ID:", validate: required("projectId") });
      const privateKey = await password({ message: "Firebase private key:" });
      const clientEmail = await input({ message: "Firebase client email:", validate: required("clientEmail") });
      return { provider, projectId, privateKey, clientEmail };
    }
  }
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

/**
 * Run the database configuration wizard.
 *
 * Collects provider-specific connection details interactively (or via the
 * injected `askFn` in tests), validates the result, and returns a typed
 * config object. No files are created.
 *
 * @throws {Error} if the collected configuration fails validation.
 */
export async function runDatabaseWizard(
  askFn: DatabaseWizardAskFn = askDatabaseWizard,
): Promise<DatabaseWizardResult> {
  const result = await askFn();

  const errors = validateDatabaseWizardResult(result);
  if (errors.length > 0) {
    throw new Error(`Database configuration invalid:\n${errors.map((e) => `  • ${e}`).join("\n")}`);
  }

  return result;
}
