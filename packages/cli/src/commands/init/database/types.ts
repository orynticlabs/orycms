/**
 * Contract every database provider must satisfy.
 *
 * All methods are synchronous and pure (no I/O) — they only produce
 * configuration artifacts and human-readable instructions.
 */
export interface DatabaseProviderDefinition {
  /** Short human-readable label, e.g. "PostgreSQL" */
  readonly name: string;

  /**
   * Validate a subset of an environment object.
   * Returns an error string for each required variable that is absent.
   * Returns an empty array when all required variables are present.
   *
   * @param env - Key/value pairs to check against (defaults to `{}`).
   */
  validateConfig(env?: Record<string, string>): string[];

  /** npm package names that must be installed to use this provider. */
  requiredPackages(): string[];

  /**
   * KEY=value lines suitable for .env.example.
   * Each line should include a placeholder value showing the expected format.
   */
  generateEnvVariables(): string[];

  /** Plain-text instructions for establishing a database connection. */
  connectionInstructions(): string;

  /** Plain-text instructions for running schema migrations. */
  migrationInstructions(): string;

  /** Plain-text instructions for seeding initial data. */
  seedInstructions(): string;
}
