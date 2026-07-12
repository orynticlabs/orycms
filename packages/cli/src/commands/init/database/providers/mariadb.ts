import type { DatabaseProviderDefinition } from "../types";

export const mariadbProvider: DatabaseProviderDefinition = {
  name: "MariaDB",

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
MariaDB connection:
  Set DATABASE_URL in your .env file.
  Format: mysql://USER:PASSWORD@HOST:PORT/DBNAME

  Local dev with Docker:
    docker run --name orycms-mariadb -e MARIADB_ROOT_PASSWORD=password \\
      -e MARIADB_DATABASE=mydb -p 3306:3306 -d mariadb:11
`.trim();
  },

  migrationInstructions() {
    return `
MariaDB migrations:
  Run OryCMS core schema installer:
    import { installOryCMSCoreSchema } from "@orycms/core";
    await installOryCMSCoreSchema(adapter);

  Or use a migration tool such as Flyway or Liquibase:
    flyway migrate -url=jdbc:mariadb://localhost/mydb
`.trim();
  },

  seedInstructions() {
    return `
MariaDB seed:
  Create a seed script at scripts/seed.ts and run:
    npx tsx scripts/seed.ts

  Example:
    import mysql from "mysql2/promise";
    const conn = await mysql.createConnection(process.env.DATABASE_URL!);
    await conn.execute("INSERT INTO orycms_settings (key, value) VALUES (?, ?)", ["site_name", '"My Site"']);
`.trim();
  },
};
