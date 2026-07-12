import type { DatabaseProviderDefinition } from "../types";

export const postgresqlProvider: DatabaseProviderDefinition = {
  name: "PostgreSQL",

  validateConfig(env = {}) {
    const errors: string[] = [];
    if (!env["DATABASE_URL"]) errors.push("DATABASE_URL is required");
    return errors;
  },

  requiredPackages() {
    return ["pg", "@types/pg"];
  },

  generateEnvVariables() {
    return ["DATABASE_URL=postgresql://user:password@localhost:5432/mydb"];
  },

  connectionInstructions() {
    return `
PostgreSQL connection:
  Set DATABASE_URL in your .env file.
  Format: postgresql://USER:PASSWORD@HOST:PORT/DBNAME

  Local dev with Docker:
    docker run --name orycms-pg -e POSTGRES_PASSWORD=password \\
      -e POSTGRES_DB=mydb -p 5432:5432 -d postgres:16
`.trim();
  },

  migrationInstructions() {
    return `
PostgreSQL migrations:
  Run OryCMS core schema installer:
    import { installOryCMSCoreSchema } from "@orycms/core";
    await installOryCMSCoreSchema(adapter);

  Or use a migration tool such as Flyway or golang-migrate:
    flyway migrate -url=jdbc:postgresql://localhost/mydb
`.trim();
  },

  seedInstructions() {
    return `
PostgreSQL seed:
  Create a seed script at scripts/seed.ts and run:
    npx tsx scripts/seed.ts

  Example:
    import { pool } from "@/lib/db";
    await pool.query("INSERT INTO orycms_settings (key, value) VALUES ($1, $2)", ["site_name", '"My Site"']);
`.trim();
  },
};
