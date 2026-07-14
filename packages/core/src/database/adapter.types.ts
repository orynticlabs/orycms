export type OryCMSDatabaseAdapterType = "postgresql" | "mysql" | "mongodb" | "firebase" | "oracle";

// -------------------------------------------------------------------
// Connection
// -------------------------------------------------------------------

export interface OryCMSDatabaseConnectionConfig {
  /** Full connection URL — takes precedence over individual fields. */
  url?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  poolSize?: number;
  timeoutMs?: number;
  /** Adapter-specific extra options. */
  options?: Record<string, unknown>;
}

// -------------------------------------------------------------------
// Health
// -------------------------------------------------------------------

export type OryCMSDatabaseHealthStatus = "healthy" | "degraded" | "unreachable";

export interface OryCMSDatabaseHealth {
  status: OryCMSDatabaseHealthStatus;
  latencyMs?: number;
  message?: string;
  checkedAt: string;
}

// -------------------------------------------------------------------
// Adapter capabilities (declare-only, no validation logic)
// -------------------------------------------------------------------

export interface OryCMSDatabaseAdapterCapabilities {
  transactions: boolean;
  relations: boolean;
  fullTextSearch: boolean;
  geospatial: boolean;
  realtime: boolean;
  migrations: boolean;
  jsonFields: boolean;
}

// -------------------------------------------------------------------
// Records
// -------------------------------------------------------------------

export type OryCMSDatabaseRecord = Record<string, unknown>;

// -------------------------------------------------------------------
// Query building
// -------------------------------------------------------------------

export type OryCMSDatabaseFilterOperator =
  "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "nin" | "contains" | "startsWith" | "endsWith";

export interface OryCMSDatabaseQueryFilter {
  field: string;
  operator: OryCMSDatabaseFilterOperator;
  value: unknown;
}

export interface OryCMSDatabaseSortOptions {
  field: string;
  direction: "asc" | "desc";
}

export interface OryCMSDatabasePaginationOptions {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface OryCMSDatabaseFindOptions {
  filters?: OryCMSDatabaseQueryFilter[];
  sort?: OryCMSDatabaseSortOptions[];
  pagination?: OryCMSDatabasePaginationOptions;
  locale?: string;
  /** Relation fields to populate. */
  populate?: string[];
}

// -------------------------------------------------------------------
// Collection schema (adapter-level, not the CMS content schema)
// -------------------------------------------------------------------

export interface OryCMSDatabaseFieldDefinition {
  name: string;
  type: string;
  required?: boolean;
  unique?: boolean;
  default?: unknown;
}

export interface OryCMSDatabaseIndexDefinition {
  fields: string[];
  unique?: boolean;
  name?: string;
}

export interface OryCMSDatabaseCollectionSchema {
  fields: OryCMSDatabaseFieldDefinition[];
  indexes?: OryCMSDatabaseIndexDefinition[];
}

// -------------------------------------------------------------------
// Migrations
// -------------------------------------------------------------------

/** Input definition passed to the adapter — distinct from the stored OryCMSMigration record. */
export interface OryCMSAdapterMigration {
  id: string;
  name: string;
  /** SQL string or adapter-specific operation definition. */
  up: string;
  /** Rollback definition. */
  down?: string;
}

export interface OryCMSMigrationResult {
  migrationId: string;
  name: string;
  success: boolean;
  appliedAt?: string;
  durationMs?: number;
  error?: string;
}
