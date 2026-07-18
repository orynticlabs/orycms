import { generateOryCMSCollectionMigrationPlan } from "@/mapper";
import { createMigrationFromCollectionPlan } from "@/database";
import type { OryCMSDatabaseAdapter, OryCMSDatabaseRecord } from "@/database";
import type { OryCMSCollectionMigrationPlan } from "@/mapper";
import { getOryCMSCoreCollections } from "./core.collections";

export interface OryCMSCoreInstallResult {
  success: boolean;
  /** Migration IDs applied during this run. */
  applied: string[];
  /** Migration IDs already recorded in orycms_migrations — skipped. */
  skipped: string[];
  failed: Array<{ migrationId: string; name: string; error: string }>;
}

/**
 * Generates PostgreSQL migration plans for all core system tables.
 * Migration IDs are stable (not timestamp-based) for idempotent tracking.
 * Plans are returned in FK-dependency order.
 */
export function generateOryCMSCoreMigrationPlan(): OryCMSCollectionMigrationPlan[] {
  return getOryCMSCoreCollections().map((collection) => {
    const plan = generateOryCMSCollectionMigrationPlan(collection, "postgresql");
    // Stable ID — overrides the timestamp-based default so orycms_migrations tracking works
    return { ...plan, migrationId: `orycms_core_${collection.slug.replace(/-/g, "_")}` };
  });
}

/**
 * Installs the OryCMS core schema through a connected PostgreSQL adapter.
 * Idempotent: checks orycms_migrations before running each migration and
 * skips any already recorded there.
 */
export async function installOryCMSCoreSchema(
  adapter: OryCMSDatabaseAdapter,
): Promise<OryCMSCoreInstallResult> {
  const plans = generateOryCMSCoreMigrationPlan();
  const applied: string[] = [];
  const skipped: string[] = [];
  const failed: Array<{ migrationId: string; name: string; error: string }> = [];

  // On first install orycms_migrations does not exist yet — that is expected
  let existingRecords: OryCMSDatabaseRecord[] = [];
  try {
    existingRecords = await adapter.findRecords("orycms_migrations", {});
  } catch {
    // Table will be created by the first migration below
  }
  const appliedIds = new Set(existingRecords.map((r) => String(r["migrationId"])));

  for (const plan of plans) {
    const migration = createMigrationFromCollectionPlan(plan);

    if (appliedIds.has(migration.id)) {
      skipped.push(migration.id);
      continue;
    }

    const result = await adapter.runMigration(migration);

    if (result.success) {
      applied.push(migration.id);
      appliedIds.add(migration.id);
      try {
        await adapter.createRecord("orycms_migrations", {
          migrationId: migration.id,
          name: migration.name,
          appliedAt: result.appliedAt ?? new Date().toISOString(),
          durationMs: result.durationMs ?? 0,
        });
      } catch {
        // Best-effort — don't abort the whole install if recording fails
      }
    } else {
      failed.push({
        migrationId: migration.id,
        name: migration.name,
        error: result.error ?? "unknown error",
      });
    }
  }

  return { success: failed.length === 0, applied, skipped, failed };
}
