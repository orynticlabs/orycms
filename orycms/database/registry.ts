import type { OryCMSDatabaseAdapter } from "./adapter.interface";
import type { OryCMSDatabaseAdapterType } from "./adapter.types";
import { OryCMSPostgreSQLAdapter } from "./adapters/postgresql.adapter";
import { OryCMSMySQLAdapter } from "./adapters/mysql.adapter";
import { OryCMSMongoDBAdapter } from "./adapters/mongodb.adapter";
import { OryCMSFirebaseAdapter } from "./adapters/firebase.adapter";
import { OryCMSOracleAdapter } from "./adapters/oracle.adapter";

const registry = new Map<OryCMSDatabaseAdapterType, OryCMSDatabaseAdapter>();

// ── Public API ────────────────────────────────────────────────────────

export function registerOryCMSDatabaseAdapter(adapter: OryCMSDatabaseAdapter): void {
  registry.set(adapter.type, adapter);
}

export function getOryCMSDatabaseAdapter(type: OryCMSDatabaseAdapterType): OryCMSDatabaseAdapter {
  const adapter = registry.get(type);
  if (!adapter) throw new Error(`OryCMS: no adapter registered for "${type}"`);
  return adapter;
}

export function listOryCMSDatabaseAdapters(): OryCMSDatabaseAdapterType[] {
  return Array.from(registry.keys());
}

// ── Default registrations ─────────────────────────────────────────────
// All bundled adapters are registered at module load time.

registerOryCMSDatabaseAdapter(OryCMSPostgreSQLAdapter);
registerOryCMSDatabaseAdapter(OryCMSMySQLAdapter);
registerOryCMSDatabaseAdapter(OryCMSMongoDBAdapter);
registerOryCMSDatabaseAdapter(OryCMSFirebaseAdapter);
registerOryCMSDatabaseAdapter(OryCMSOracleAdapter);
