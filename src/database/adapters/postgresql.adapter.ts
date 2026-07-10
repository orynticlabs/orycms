import type { OryCMSDatabaseAdapter } from "../adapter.interface";
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
} from "../adapter.types";

/**
 * PostgreSQL adapter stub.
 * Neon and Supabase will extend/compose this adapter in Phase 2 —
 * do not duplicate PostgreSQL logic in separate Neon/Supabase adapters.
 */
export const OryCMSPostgreSQLAdapter: OryCMSDatabaseAdapter = {
  type: "postgresql" satisfies OryCMSDatabaseAdapterType,

  capabilities: {
    transactions: true,
    relations: true,
    fullTextSearch: true,
    geospatial: true,
    realtime: false,
    migrations: true,
    jsonFields: true,
  } satisfies OryCMSDatabaseAdapterCapabilities,

  async connect(_config: OryCMSDatabaseConnectionConfig): Promise<void> {
    throw new Error("Not implemented");
  },

  async disconnect(): Promise<void> {
    throw new Error("Not implemented");
  },

  async testConnection(): Promise<OryCMSDatabaseHealth> {
    throw new Error("Not implemented");
  },

  async createCollection(_name: string, _schema?: OryCMSDatabaseCollectionSchema): Promise<void> {
    throw new Error("Not implemented");
  },

  async updateCollection(
    _name: string,
    _schema: Partial<OryCMSDatabaseCollectionSchema>,
  ): Promise<void> {
    throw new Error("Not implemented");
  },

  async deleteCollection(_name: string): Promise<void> {
    throw new Error("Not implemented");
  },

  async createRecord(
    _collection: string,
    _data: OryCMSDatabaseRecord,
  ): Promise<OryCMSDatabaseRecord> {
    throw new Error("Not implemented");
  },

  async findRecords(
    _collection: string,
    _options?: OryCMSDatabaseFindOptions,
  ): Promise<OryCMSDatabaseRecord[]> {
    throw new Error("Not implemented");
  },

  async findRecordById(_collection: string, _id: string): Promise<OryCMSDatabaseRecord | null> {
    throw new Error("Not implemented");
  },

  async updateRecord(
    _collection: string,
    _id: string,
    _data: Partial<OryCMSDatabaseRecord>,
  ): Promise<OryCMSDatabaseRecord> {
    throw new Error("Not implemented");
  },

  async deleteRecord(_collection: string, _id: string): Promise<void> {
    throw new Error("Not implemented");
  },

  async runMigration(_migration: OryCMSAdapterMigration): Promise<OryCMSMigrationResult> {
    throw new Error("Not implemented");
  },
};
