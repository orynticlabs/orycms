import type { OryCMSDatabaseAdapterType, OryCMSDatabaseAdapterCapabilities } from "@/database";

// ─────────────────────────────────────────────────────────────────────────────
// Mapped field
// ─────────────────────────────────────────────────────────────────────────────

export interface OryCMSMappedFieldReference {
  /** Target table / collection name. */
  table: string;
  /** Target primary key column. */
  column: string;
  onDelete?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
}

export interface OryCMSMappedDatabaseField {
  name: string;
  /** Native database type string (e.g. "VARCHAR(255)", "JSONB", "ObjectId"). */
  nativeType: string;
  nullable: boolean;
  unique: boolean;
  primaryKey: boolean;
  autoIncrement?: boolean;
  /** SQL-ready default value string, or raw value string for NoSQL adapters. */
  defaultValue?: string;
  /** Condition appended to a SQL CHECK constraint (without column name prefix). */
  checkConstraint?: string;
  /** FK reference; populated only for relation fields on SQL adapters. */
  references?: OryCMSMappedFieldReference;
  comment?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapped schema
// ─────────────────────────────────────────────────────────────────────────────

export type OryCMSMappedIndexType = "btree" | "hash" | "text" | "default";

export interface OryCMSMappedDatabaseIndex {
  name: string;
  fields: string[];
  unique: boolean;
  type: OryCMSMappedIndexType;
}

export interface OryCMSMappedDatabaseSchema {
  collectionSlug: string;
  tableName: string;
  adapterType: OryCMSDatabaseAdapterType;
  fields: OryCMSMappedDatabaseField[];
  indexes: OryCMSMappedDatabaseIndex[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Migration plan
// ─────────────────────────────────────────────────────────────────────────────

export type OryCMSMigrationOperationType =
  | "CREATE_COLLECTION"
  | "ADD_FIELD"
  | "ADD_INDEX"
  | "ADD_UNIQUE_CONSTRAINT"
  | "ADD_FOREIGN_KEY"
  | "CREATE_JUNCTION_TABLE";

export interface OryCMSJunctionTableSpec {
  /** e.g. "blog_posts_tags" */
  name: string;
  sourceColumn: string;
  sourceTable: string;
  targetColumn: string;
  targetTable: string;
}

export interface OryCMSMigrationOperation {
  type: OryCMSMigrationOperationType;
  /** Primary table / collection this operation targets. */
  target: string;
  field?: OryCMSMappedDatabaseField;
  index?: OryCMSMappedDatabaseIndex;
  junction?: OryCMSJunctionTableSpec;
  /** Forward statement. SQL string for SQL adapters; JS/JSON string for NoSQL adapters. */
  upStatement?: string;
  /** Rollback statement. */
  downStatement?: string;
  reversible: boolean;
}

export interface OryCMSCollectionMigrationPlan {
  migrationId: string;
  generatedAt: string;
  collectionSlug: string;
  collectionName: string;
  tableName: string;
  adapterType: OryCMSDatabaseAdapterType;
  schema: OryCMSMappedDatabaseSchema;
  operations: OryCMSMigrationOperation[];
  /** Non-blocking issues discovered during planning. */
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Capability validation
// ─────────────────────────────────────────────────────────────────────────────

export type OryCMSCapabilityIssueCode =
  | "UNSUPPORTED_JSON_FIELDS"
  | "UNSUPPORTED_RELATIONS"
  | "UNSUPPORTED_FULL_TEXT_SEARCH"
  | "UNSUPPORTED_MIGRATIONS"
  | "PARTIAL_RELATION_SUPPORT";

export type OryCMSCapabilityIssueSeverity = "error" | "warning";

export interface OryCMSCapabilityValidationIssue {
  code: OryCMSCapabilityIssueCode;
  severity: OryCMSCapabilityIssueSeverity;
  capability: keyof OryCMSDatabaseAdapterCapabilities;
  message: string;
  fieldName?: string;
}

export interface OryCMSCapabilityValidationResult {
  valid: boolean;
  issues: OryCMSCapabilityValidationIssue[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Default capabilities (matches the adapter stubs in src/database/adapters/)
// ─────────────────────────────────────────────────────────────────────────────

export const ORYCMS_DEFAULT_ADAPTER_CAPABILITIES: Record<
  OryCMSDatabaseAdapterType,
  OryCMSDatabaseAdapterCapabilities
> = {
  postgresql: {
    transactions: true,
    relations: true,
    fullTextSearch: true,
    geospatial: true,
    realtime: false,
    migrations: true,
    jsonFields: true,
  },
  mysql: {
    transactions: true,
    relations: true,
    fullTextSearch: true,
    geospatial: true,
    realtime: false,
    migrations: true,
    jsonFields: true,
  },
  mongodb: {
    transactions: true,
    relations: false,
    fullTextSearch: true,
    geospatial: true,
    realtime: true,
    migrations: false,
    jsonFields: true,
  },
  firebase: {
    transactions: true,
    relations: false,
    fullTextSearch: false,
    geospatial: false,
    realtime: true,
    migrations: false,
    jsonFields: true,
  },
  oracle: {
    transactions: true,
    relations: true,
    fullTextSearch: true,
    geospatial: true,
    realtime: false,
    migrations: true,
    jsonFields: true,
  },
};
