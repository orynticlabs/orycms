import type { DatabaseProviderDefinition } from "../types";

export const mysqlProvider: DatabaseProviderDefinition = {
  name: "MySQL",

  validateConfig(env = {}) {
    const errors: string[] = [];
    if (!env["DATABASE_URL"]) errors.push("DATABASE_URL is required");
    return errors;
  },

  requiredPackages() {
    return ["mysql2"];
  },

  generateEnvVariables() {
    return ["DATABASE_URL=mysql://user:password@localhost:3306/mydb"];
  },

  connectionInstructions() {
    return `
MySQL connection:
  Set DATABASE_URL in your .env file.
  Format: mysql://USER:PASSWORD@HOST:PORT/DBNAME

  Local dev with Docker:
    docker run --name orycms-mysql -e MYSQL_ROOT_PASSWORD=password \\
      -e MYSQL_DATABASE=mydb -p 3306:3306 -d mysql:8
`.trim();
  },

  migrationInstructions() {
    return `
MySQL migrations:
  Run OryCMS core schema installer:
    import { installOryCMSCoreSchema } from "@orycms/core";
    await installOryCMSCoreSchema(adapter);

  Or use a migration tool such as Flyway or Liquibase:
    flyway migrate -url=jdbc:mysql://localhost/mydb
`.trim();
  },

  seedInstructions() {
    return `
MySQL seed:
  Create a seed script at scripts/seed.ts and run:
    npx tsx scripts/seed.ts

  Example:
    import { pool } from "@/lib/db";
    await pool.execute("INSERT INTO orycms_settings (key, value) VALUES (?, ?)", ["site_name", '"My Site"']);
`.trim();
  },
};
