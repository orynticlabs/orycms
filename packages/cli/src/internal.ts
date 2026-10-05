/**
 * Internal, non-SemVer-stable surface shared with @ory-cms/create-ory-cms.
 *
 * `create-ory-cms` reuses the CLI's init/bootstrap/database logic so the two
 * packages never duplicate or drift from each other. This subpath is not part
 * of the CLI's public (binary) contract and may change without a major bump.
 */

export { logger } from "./shared/logger";
export type { Logger } from "./shared/logger";
export { fileExists } from "./shared/fs";

export { detectNextJs, findNextConfigPath } from "./commands/init/detectors/nextjs";
export { detectPackageManager, installCommand } from "./commands/init/detectors/package-manager";

export { detectAppStructure, bootstrapAdmin } from "./commands/init/bootstrap";
export type {
  AppStructure,
  BootstrapOptions,
  BootstrapResult,
  ConfirmFn,
  RouterType,
} from "./commands/init/bootstrap";

export { runInit } from "./commands/init/init";
export type { InitSummary } from "./commands/init/init";

export type {
  AuthProvider,
  DatabaseProvider,
  GeneratorResult,
  GeneratorStatus,
  InitAnswers,
  InitContext,
  NextJsInfo,
  OfficialPlugin,
  PackageManager,
} from "./commands/init/types";

export {
  testDatabaseConnection,
  getDatabaseConnectionError,
} from "./commands/init/database/connection";
export type { ConnectionTestResult } from "./commands/init/database/connection";

export {
  migrateDatabase,
  rollbackMigration,
  migrationStatus,
} from "./commands/init/database/migrations";
export type {
  MigrateResult,
  RollbackResult,
  MigrationStatusResult,
} from "./commands/init/database/migrations";

export {
  seedDatabase,
  seedDatabaseIfNeeded,
  getDatabaseSeedStatus,
} from "./commands/init/database/seeder";
export type { SeedResult, SeedStatusResult } from "./commands/init/database/seeder";

export { runDatabaseWizard, validateDatabaseWizardResult } from "./commands/init/database/wizard";
export type {
  DatabaseWizardResult,
  DatabaseWizardAskFn,
  PostgresqlWizardResult,
  MysqlWizardResult,
  MariadbWizardResult,
  SqliteWizardResult,
  MongodbWizardResult,
  SupabaseWizardResult,
  NeonWizardResult,
  FirebaseWizardResult,
} from "./commands/init/database/wizard";
