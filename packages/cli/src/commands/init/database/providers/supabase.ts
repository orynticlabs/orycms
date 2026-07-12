import type { DatabaseProviderDefinition } from "../types";

export const supabaseProvider: DatabaseProviderDefinition = {
  name: "Supabase",

  validateConfig(env = {}) {
    const errors: string[] = [];
    if (!env["SUPABASE_URL"]) errors.push("SUPABASE_URL is required");
    if (!env["SUPABASE_ANON_KEY"]) errors.push("SUPABASE_ANON_KEY is required");
    if (!env["SUPABASE_SERVICE_KEY"]) errors.push("SUPABASE_SERVICE_KEY is required");
    return errors;
  },

  requiredPackages() {
    return ["@supabase/supabase-js"];
  },

  generateEnvVariables() {
    return [
      "SUPABASE_URL=https://your-project.supabase.co",
      "SUPABASE_ANON_KEY=your-anon-key",
      "SUPABASE_SERVICE_KEY=your-service-key",
    ];
  },

  connectionInstructions() {
    return `
Supabase connection:
  Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_KEY in your .env file.
  Find these values at: https://supabase.com/dashboard → Project Settings → API

  The service key is used server-side only — never expose it to the browser.
`.trim();
  },

  migrationInstructions() {
    return `
Supabase migrations:
  Run OryCMS core schema installer:
    import { installOryCMSCoreSchema } from "@orycms/core";
    await installOryCMSCoreSchema(adapter);

  Or use the Supabase CLI:
    supabase db push
`.trim();
  },

  seedInstructions() {
    return `
Supabase seed:
  Create a seed script at scripts/seed.ts and run:
    npx tsx scripts/seed.ts

  Example:
    import { createClient } from "@supabase/supabase-js";
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
    await supabase.from("orycms_settings").insert({ key: "site_name", value: "My Site" });
`.trim();
  },
};
