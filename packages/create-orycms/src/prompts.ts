import { basename } from "node:path";

import { detectAppStructure } from "../../cli/src/commands/init/bootstrap";
import { detectPackageManager } from "../../cli/src/commands/init/detectors/package-manager";
import { logger } from "../../cli/src/shared/logger";
import type { AuthProvider, OfficialPlugin, PackageManager } from "../../cli/src/commands/init/types";
import type { RouterType } from "../../cli/src/commands/init/bootstrap";
import type { CreateAnswers, StorageProvider } from "./runner";

// ── Choice lists ───────────────────────────────────────────────────────────────

const PM_CHOICES: Array<{ name: string; value: PackageManager }> = [
  { name: "npm", value: "npm" },
  { name: "pnpm", value: "pnpm" },
  { name: "yarn", value: "yarn" },
  { name: "bun", value: "bun" },
];

const ROUTER_CHOICES: Array<{ name: string; value: RouterType }> = [
  { name: "App Router (recommended for Next.js 13+)", value: "app" },
  { name: "Pages Router", value: "pages" },
];

const STORAGE_CHOICES: Array<{ name: string; value: StorageProvider }> = [
  { name: "Local filesystem", value: "local" },
  { name: "Amazon S3 (or compatible)", value: "s3" },
  { name: "Cloudinary", value: "cloudinary" },
  { name: "None (configure later)", value: "none" },
];

const AUTH_CHOICES: Array<{ name: string; value: AuthProvider }> = [
  { name: "Better Auth", value: "better-auth" },
  { name: "Auth.js (NextAuth)", value: "auth-js" },
  { name: "Clerk", value: "clerk" },
  { name: "None (set up later)", value: "none" },
];

const PLUGIN_CHOICES: Array<{ name: string; value: OfficialPlugin }> = [
  { name: "SEO — metadata, open-graph, sitemaps", value: "@orycms/plugin-seo" },
  { name: "Media — image/file management with S3 support", value: "@orycms/plugin-media" },
  { name: "i18n — internationalisation and localisation", value: "@orycms/plugin-i18n" },
  { name: "Analytics — page-view and event tracking", value: "@orycms/plugin-analytics" },
  { name: "Sitemap — automatic XML sitemap generation", value: "@orycms/plugin-sitemap" },
  { name: "Comments — moderated comment threads", value: "@orycms/plugin-comments" },
];

// ── Interactive prompt implementation ─────────────────────────────────────────

/**
 * Walk the user through all creation prompts.
 * Lazy-imports @inquirer/prompts so non-interactive environments
 * (tests, CI) can import this module without TTY setup.
 */
export async function askCreateQuestions(cwd: string): Promise<CreateAnswers> {
  const { input, select, checkbox, confirm, password } = await import("@inquirer/prompts");
  const { runDatabaseWizard } = await import(
    "../../cli/src/commands/init/database/wizard"
  );

  // ── 1. Project name ─────────────────────────────────────────────────────────
  const projectName = await input({
    message: "Project name:",
    default: basename(cwd),
    validate: (v) => (v.trim().length > 0 ? true : "Project name is required"),
  });

  // ── 2. Package manager ──────────────────────────────────────────────────────
  const detected = detectPackageManager(cwd);
  const packageManager = await select<PackageManager>({
    message: "Package manager:",
    choices: PM_CHOICES,
    default: detected,
  });

  // ── 3. Router detection or selection ────────────────────────────────────────
  const structure = detectAppStructure(cwd);
  let router: RouterType;
  if (structure.hasAppDir || structure.hasPagesDir) {
    router = structure.router;
    logger.info(
      `Detected: ${router === "app" ? "App Router (app/)" : "Pages Router (pages/)"}`,
    );
  } else {
    router = await select<RouterType>({
      message: "Which Next.js router will you use?",
      choices: ROUTER_CHOICES,
    });
  }

  // ── 4. Database wizard (provider + connection fields) ───────────────────────
  logger.blank();
  logger.info("Database configuration:");
  const dbConfig = await runDatabaseWizard();

  // ── 5. Storage provider ─────────────────────────────────────────────────────
  const storageProvider = await select<StorageProvider>({
    message: "Storage provider:",
    choices: STORAGE_CHOICES,
  });

  // ── 6. Auth provider ────────────────────────────────────────────────────────
  const authProvider = await select<AuthProvider>({
    message: "Authentication provider:",
    choices: AUTH_CHOICES,
  });

  // ── 7. Admin Dashboard ──────────────────────────────────────────────────────
  const installAdmin = await confirm({
    message: "Install the OryCMS Admin Dashboard?",
    default: true,
  });

  // ── 8-9. Seeding ────────────────────────────────────────────────────────────
  const seedDb = await confirm({
    message: "Seed the database with default roles, permissions, and settings?",
    default: true,
  });

  let createOwner = false;
  let ownerEmail = "admin@localhost";
  let ownerPassword = "";

  if (seedDb) {
    createOwner = await confirm({
      message: "Create an initial Owner account?",
      default: true,
    });
    if (createOwner) {
      ownerEmail = await input({
        message: "Owner email:",
        default: "admin@localhost",
        validate: (v) => (v.includes("@") ? true : "Enter a valid email address"),
      });
      ownerPassword = await password({
        message: "Owner password:",
        validate: (v) => (v.length >= 8 ? true : "Password must be at least 8 characters"),
      });
    }
  }

  // ── 10. Plugins ─────────────────────────────────────────────────────────────
  const plugins = await checkbox<OfficialPlugin>({
    message: "Optional plugins (space to select, enter to confirm):",
    choices: PLUGIN_CHOICES,
  });

  return {
    projectName,
    packageManager,
    router,
    dbConfig,
    storageProvider,
    authProvider,
    installAdmin,
    seedDb,
    createOwner,
    ownerEmail,
    ownerPassword,
    plugins,
  };
}
