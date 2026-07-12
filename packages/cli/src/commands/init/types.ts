// ── Choices ───────────────────────────────────────────────────────────────────

export type DatabaseProvider =
  | "postgresql"
  | "mysql"
  | "mariadb"
  | "sqlite"
  | "mongodb"
  | "supabase"
  | "neon"
  | "firebase";

export type AuthProvider = "better-auth" | "auth-js" | "clerk" | "none";

export type OfficialPlugin =
  | "@orycms/plugin-seo"
  | "@orycms/plugin-media"
  | "@orycms/plugin-i18n"
  | "@orycms/plugin-analytics"
  | "@orycms/plugin-sitemap"
  | "@orycms/plugin-comments";

// ── User answers from the interactive prompts ─────────────────────────────────

export type InitAnswers = {
  database: DatabaseProvider;
  auth: AuthProvider;
  plugins: OfficialPlugin[];
};

// ── Environment ───────────────────────────────────────────────────────────────

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export type NextJsInfo = {
  detected: boolean;
  hasAppRouter: boolean;
  nextVersion?: string;
};

// ── Generator contract ────────────────────────────────────────────────────────

export type GeneratorStatus = "created" | "updated" | "skipped";

export type GeneratorResult = {
  /** Path relative to `cwd`. */
  path: string;
  status: GeneratorStatus;
  /** Human-readable description shown in the summary. */
  description?: string;
};

// ── Full init context passed to generators ────────────────────────────────────

export type InitContext = {
  cwd: string;
  packageManager: PackageManager;
  answers: InitAnswers;
};
