import type { DatabaseProviderDefinition } from "../types";

export const neonProvider: DatabaseProviderDefinition = {
  name: "Neon",

  validateConfig(env = {}) {
    const errors: string[] = [];
    if (!env["DATABASE_URL"]) errors.push("DATABASE_URL is required");
    return errors;
  },

  requiredPackages() {
    return ["@neondatabase/serverless"];
  },

  generateEnvVariables() {
    return [
      "DATABASE_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/mydb?sslmode=require",
    ];
  },

  connectionInstructions() {
    return `
Neon connection:
  Set DATABASE_URL in your .env file.
  Find your connection string at: https://console.neon.tech → Project → Connection Details

  The ?sslmode=require query parameter is required for Neon connections.
`.trim();
  },

  migrationInstructions() {
    return `
Neon migrations:
  Run OryCMS core schema installer:
    import { installOryCMSCoreSchema } from "@ory-cms/core";
    await installOryCMSCoreSchema(adapter);

  Or use the Neon CLI for branch-based migrations:
    neon branches create --name migrations
`.trim();
  },

  seedInstructions() {
    return `
Neon seed:
  Create a seed script at scripts/seed.ts and run:
    npx tsx scripts/seed.ts

  Example:
    import { neon } from "@neondatabase/serverless";
    const sql = neon(process.env.DATABASE_URL!);
    await sql\`INSERT INTO orycms_settings (key, value) VALUES ('site_name', '"My Site"')\`;
`.trim();
  },
};
