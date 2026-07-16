import type {
  OryCMSDatabaseAdapterType,
  OryCMSDatabaseAdapterCapabilities,
  OryCMSDatabaseConnectionConfig,
  OryCMSDatabaseHealth,
  OryCMSDatabaseCollectionSchema,
  OryCMSDatabaseRecord,
  OryCMSDatabaseFindOptions,
  OryCMSAdapterMigration,
  OryCMSMigrationResult,
} from "./adapter.types";

/**
 * Contract every OryCMS database adapter must satisfy.
 * SQL and NoSQL providers implement this interface; higher-level services
 * program against it and never import a concrete adapter directly.
 */
export interface OryCMSDatabaseAdapter {
  /** Identifies the adapter in the registry. */
  readonly type: OryCMSDatabaseAdapterType;

  /** Declares which optional features the adapter supports. */
  readonly capabilities: OryCMSDatabaseAdapterCapabilities;

  // ── Lifecycle ──────────────────────────────────────────────────────

  connect(config: OryCMSDatabaseConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  testConnection(): Promise<OryCMSDatabaseHealth>;

  // ── Schema management ──────────────────────────────────────────────

  createCollection(name: string, schema?: OryCMSDatabaseCollectionSchema): Promise<void>;
  updateCollection(name: string, schema: Partial<OryCMSDatabaseCollectionSchema>): Promise<void>;
  deleteCollection(name: string): Promise<void>;

  // ── Record operations ──────────────────────────────────────────────

  createRecord(collection: string, data: OryCMSDatabaseRecord): Promise<OryCMSDatabaseRecord>;
  findRecords(
    collection: string,
    options?: OryCMSDatabaseFindOptions,
  ): Promise<OryCMSDatabaseRecord[]>;
  findRecordById(collection: string, id: string): Promise<OryCMSDatabaseRecord | null>;
  updateRecord(
    collection: string,
    id: string,
    data: Partial<OryCMSDatabaseRecord>,
  ): Promise<OryCMSDatabaseRecord>;
  deleteRecord(collection: string, id: string): Promise<void>;

  // ── Migrations ─────────────────────────────────────────────────────

  runMigration(migration: OryCMSAdapterMigration): Promise<OryCMSMigrationResult>;
}
