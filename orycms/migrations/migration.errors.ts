export type OryCMSMigrationErrorCode =
  | "MIGRATION_UNSAFE"
  | "MIGRATION_DESTRUCTIVE_UNCONFIRMED"
  | "MIGRATION_ALREADY_APPLIED"
  | "MIGRATION_NOT_FOUND"
  | "MIGRATION_NOT_REVERSIBLE"
  | "MIGRATION_EXECUTION_FAILED"
  | "MIGRATION_NO_OPERATIONS";

export class OryCMSMigrationError extends Error {
  readonly code: OryCMSMigrationErrorCode;
  readonly statusCode: number;

  constructor(code: OryCMSMigrationErrorCode, message: string, statusCode = 400) {
    super(message);
    this.name = "OryCMSMigrationError";
    this.code = code;
    this.statusCode = statusCode;
  }
}
