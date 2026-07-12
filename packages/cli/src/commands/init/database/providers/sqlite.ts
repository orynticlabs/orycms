import type { DatabaseProviderDefinition } from "../types";

export const sqliteProvider: DatabaseProviderDefinition = {
  name: "SQLite",

  validateConfig(env = {}) {
    const errors: string[] = [];
    if (!env["DATABASE_URL"]) errors.push("DATABASE_URL is required");
    return errors;
  },

  requiredPackages() {
    return ["better-sqlite3", "@types/better-sqlite3"];
  },

  generateEnvVariables() {
    return ["DATABASE_URL=file:./mydb.sqlite"];
  },

  connectionInstructions() {
    return `
SQLite connection:
  Set DATABASE_URL in your .env file.
  Format: file:PATH_TO_FILE  (e.g. file:./mydb.sqlite)

  No server setup required — SQLite is a file-based database.
  Ensure the directory containing the file is writable by the process.
`.trim();
  },

  migrationInstructions() {
    return `
SQLite migrations:
  Run OryCMS core schema installer:
    import { installOryCMSCoreSchema } from "@orycms/core";
    await installOryCMSCoreSchema(adapter);

  Or use a migration tool such as drizzle-kit or knex:
    npx drizzle-kit migrate
`.trim();
  },

  seedInstructions() {
    return `
SQLite seed:
  Create a seed script at scripts/seed.ts and run:
    npx tsx scripts/seed.ts

  Example:
    import Database from "better-sqlite3";
    const db = new Database("./mydb.sqlite");
    db.prepare("INSERT INTO orycms_settings (key, value) VALUES (?, ?)").run("site_name", '"My Site"');
`.trim();
  },
};
