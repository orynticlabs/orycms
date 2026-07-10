import type { OryCMSDatabaseTable, OryCMSMigration } from "@/types";
import type {
  OryCMSDatabaseAdapterType,
  OryCMSMigrationResult,
  OryCMSAdapterMigration,
} from "@/database/adapter.types";
import type { OryCMSDatabaseAdapter } from "@/database/adapter.interface";
import { getOryCMSDatabaseAdapter, listOryCMSDatabaseAdapters } from "@/database/registry";

let _activeType: OryCMSDatabaseAdapterType | null = null;

export const OryCMSDatabaseService = {
  // ── Adapter selection ───────────────────────────────────────────────

  setAdapter(type: OryCMSDatabaseAdapterType): void {
    _activeType = type;
  },

  getActiveAdapterType(): OryCMSDatabaseAdapterType | null {
    return _activeType;
  },

  listAvailableAdapters(): OryCMSDatabaseAdapterType[] {
    return listOryCMSDatabaseAdapters();
  },

  /** Resolves the active adapter or throws if none is configured. */
  resolveAdapter(): OryCMSDatabaseAdapter {
    if (!_activeType) throw new Error("OryCMS: no database adapter configured");
    return getOryCMSDatabaseAdapter(_activeType);
  },

  // ── Lifecycle (delegates to adapter) ───────────────────────────────

  async testConnection() {
    return this.resolveAdapter().testConnection();
  },

  // ── Migrations (delegates to adapter for execution) ────────────────

  async runMigration(migration: OryCMSAdapterMigration): Promise<OryCMSMigrationResult> {
    return this.resolveAdapter().runMigration(migration);
  },

  // ── Introspection stubs (Phase 2 — will query DB schema) ───────────

  async getTables(): Promise<OryCMSDatabaseTable[]> {
    throw new Error("Not implemented");
  },

  async getTable(_name: string): Promise<OryCMSDatabaseTable> {
    throw new Error("Not implemented");
  },

  async getMigrations(): Promise<OryCMSMigration[]> {
    throw new Error("Not implemented");
  },

  async runMigrations(): Promise<OryCMSMigration[]> {
    throw new Error("Not implemented");
  },

  async rollbackMigration(_id: string): Promise<void> {
    throw new Error("Not implemented");
  },
};
