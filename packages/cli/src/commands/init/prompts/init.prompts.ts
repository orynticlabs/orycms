import type { AuthProvider, DatabaseProvider, InitAnswers, OfficialPlugin } from "../types";

/**
 * Signature of the prompts function so it can be injected in tests.
 * The default implementation calls @inquirer/prompts; tests supply a stub.
 */
export type AskFn = () => Promise<InitAnswers>;

const DATABASE_CHOICES: Array<{ name: string; value: DatabaseProvider }> = [
  { name: "PostgreSQL", value: "postgresql" },
  { name: "MySQL", value: "mysql" },
  { name: "MariaDB", value: "mariadb" },
  { name: "SQLite", value: "sqlite" },
  { name: "MongoDB", value: "mongodb" },
  { name: "Supabase", value: "supabase" },
  { name: "Neon (serverless Postgres)", value: "neon" },
  { name: "Firebase", value: "firebase" },
];

const AUTH_CHOICES: Array<{ name: string; value: AuthProvider }> = [
  { name: "Better Auth", value: "better-auth" },
  { name: "Auth.js (NextAuth)", value: "auth-js" },
  { name: "Clerk", value: "clerk" },
  { name: "None (set up later)", value: "none" },
];

const PLUGIN_CHOICES: Array<{ name: string; value: OfficialPlugin }> = [
  { name: "SEO — metadata, open-graph, sitemaps", value: "@ory-cms/plugin-seo" },
  { name: "Media — image/file management with S3 support", value: "@ory-cms/plugin-media" },
  { name: "i18n — internationalisation and localisation", value: "@ory-cms/plugin-i18n" },
  { name: "Analytics — page-view and event tracking", value: "@ory-cms/plugin-analytics" },
  { name: "Sitemap — automatic XML sitemap generation", value: "@ory-cms/plugin-sitemap" },
  { name: "Comments — moderated comment threads", value: "@ory-cms/plugin-comments" },
];

/**
 * Default interactive prompt implementation using @inquirer/prompts.
 * Imported lazily so that the module can be required in non-interactive
 * environments (e.g. tests) without triggering TTY setup.
 */
export async function askInitQuestions(): Promise<InitAnswers> {
  // Lazy import keeps cold-start fast and lets tests avoid the TTY dependency.
  const { select, checkbox } = await import("@inquirer/prompts");

  const database = await select<DatabaseProvider>({
    message: "Which database provider will you use?",
    choices: DATABASE_CHOICES,
  });

  const auth = await select<AuthProvider>({
    message: "Which authentication provider will you use?",
    choices: AUTH_CHOICES,
  });

  const plugins = await checkbox<OfficialPlugin>({
    message: "Which official OryCMS plugins do you want to install? (space to select)",
    choices: PLUGIN_CHOICES,
  });

  return { database, auth, plugins };
}
