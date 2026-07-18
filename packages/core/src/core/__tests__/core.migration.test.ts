import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateOryCMSCoreMigrationPlan, installOryCMSCoreSchema } from "../core.migration";
import { getOryCMSCoreCollections } from "../core.collections";
import type { OryCMSDatabaseAdapter, OryCMSMigrationResult } from "@/database";

// ── generateOryCMSCoreMigrationPlan ───────────────────────────────────────────

describe("generateOryCMSCoreMigrationPlan", () => {
  it("returns exactly 11 migration plans", () => {
    expect(generateOryCMSCoreMigrationPlan()).toHaveLength(11);
  });

  it("migration IDs are stable across multiple calls", () => {
    const a = generateOryCMSCoreMigrationPlan().map((p) => p.migrationId);
    const b = generateOryCMSCoreMigrationPlan().map((p) => p.migrationId);
    expect(a).toEqual(b);
  });

  it("migration IDs follow the orycms_core_ prefix pattern", () => {
    for (const plan of generateOryCMSCoreMigrationPlan()) {
      expect(plan.migrationId).toMatch(/^orycms_core_orycms_/);
    }
  });

  it("plans are in FK-dependency order (migrations first, users before sessions)", () => {
    const plans = generateOryCMSCoreMigrationPlan();
    const idxOf = (slug: string) => plans.findIndex((p) => p.collectionSlug === slug);

    expect(idxOf("orycms-migrations")).toBeLessThan(idxOf("orycms-users"));
    expect(idxOf("orycms-roles")).toBeLessThan(idxOf("orycms-users"));
    expect(idxOf("orycms-roles")).toBeLessThan(idxOf("orycms-role-permissions"));
    expect(idxOf("orycms-permissions")).toBeLessThan(idxOf("orycms-role-permissions"));
    expect(idxOf("orycms-users")).toBeLessThan(idxOf("orycms-sessions"));
    expect(idxOf("orycms-collections")).toBeLessThan(idxOf("orycms-collection-fields"));
  });

  it("each plan targets the postgresql adapter", () => {
    for (const plan of generateOryCMSCoreMigrationPlan()) {
      expect(plan.adapterType).toBe("postgresql");
    }
  });

  it("first plan is orycms-migrations", () => {
    const plans = generateOryCMSCoreMigrationPlan();
    expect(plans[0].collectionSlug).toBe("orycms-migrations");
    expect(plans[0].migrationId).toBe("orycms_core_orycms_migrations");
  });

  it("orycms-migrations plan generates a CREATE TABLE statement", () => {
    const plan = generateOryCMSCoreMigrationPlan().find(
      (p) => p.collectionSlug === "orycms-migrations",
    )!;
    const createOp = plan.operations.find((op) => op.type === "CREATE_COLLECTION");
    expect(createOp?.upStatement).toContain('CREATE TABLE IF NOT EXISTS "orycms_migrations"');
  });

  it("orycms-users plan includes a FK operation for roleId", () => {
    const plan = generateOryCMSCoreMigrationPlan().find(
      (p) => p.collectionSlug === "orycms-users",
    )!;
    const fkOp = plan.operations.find((op) => op.type === "ADD_FOREIGN_KEY");
    expect(fkOp).toBeDefined();
    expect(fkOp?.upStatement).toContain('"orycms_roles"');
  });

  it("orycms-role-permissions plan has two FK operations", () => {
    const plan = generateOryCMSCoreMigrationPlan().find(
      (p) => p.collectionSlug === "orycms-role-permissions",
    )!;
    const fkOps = plan.operations.filter((op) => op.type === "ADD_FOREIGN_KEY");
    expect(fkOps).toHaveLength(2);
    const targets = fkOps.map((op) => op.upStatement ?? "");
    expect(targets.some((s) => s.includes('"orycms_roles"'))).toBe(true);
    expect(targets.some((s) => s.includes('"orycms_permissions"'))).toBe(true);
  });

  it("orycms-sessions plan FK references orycms_users with CASCADE", () => {
    const plan = generateOryCMSCoreMigrationPlan().find(
      (p) => p.collectionSlug === "orycms-sessions",
    )!;
    const fkOp = plan.operations.find((op) => op.type === "ADD_FOREIGN_KEY");
    expect(fkOp?.upStatement).toContain('"orycms_users"');
    expect(fkOp?.upStatement).toContain("CASCADE");
  });

  it("orycms-users table has createdAt and updatedAt system fields", () => {
    const plan = generateOryCMSCoreMigrationPlan().find(
      (p) => p.collectionSlug === "orycms-users",
    )!;
    const fieldNames = plan.schema.fields.map((f) => f.name);
    expect(fieldNames).toContain("createdAt");
    expect(fieldNames).toContain("updatedAt");
  });

  it("plan count matches collection count", () => {
    expect(generateOryCMSCoreMigrationPlan()).toHaveLength(getOryCMSCoreCollections().length);
  });

  it("orycms-users status field generates a CHECK constraint in SQL", () => {
    const plan = generateOryCMSCoreMigrationPlan().find(
      (p) => p.collectionSlug === "orycms-users",
    )!;
    const createOp = plan.operations.find((op) => op.type === "CREATE_COLLECTION");
    expect(createOp?.upStatement).toContain("CHECK");
    expect(createOp?.upStatement).toContain("'active'");
    expect(createOp?.upStatement).toContain("'pending'");
  });
});

// ── installOryCMSCoreSchema ───────────────────────────────────────────────────

function makeMockAdapter(
  findRecordsResult: Record<string, unknown>[] = [],
  runMigrationSuccess = true,
): OryCMSDatabaseAdapter {
  const successResult: OryCMSMigrationResult = {
    migrationId: "x",
    name: "x",
    success: true,
    appliedAt: "2024-01-01T00:00:00Z",
    durationMs: 1,
  };
  const failResult: OryCMSMigrationResult = {
    migrationId: "x",
    name: "x",
    success: false,
    error: "simulated failure",
  };

  return {
    type: "postgresql",
    capabilities: {
      transactions: true,
      relations: true,
      fullTextSearch: true,
      geospatial: true,
      realtime: false,
      migrations: true,
      jsonFields: true,
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
    testConnection: vi.fn(),
    createCollection: vi.fn(),
    updateCollection: vi.fn(),
    deleteCollection: vi.fn(),
    createRecord: vi.fn().mockResolvedValue({ id: "uuid-1" }),
    findRecords: vi.fn().mockResolvedValue(findRecordsResult),
    findRecordById: vi.fn().mockResolvedValue(null),
    updateRecord: vi.fn(),
    deleteRecord: vi.fn(),
    runMigration: vi.fn().mockResolvedValue(runMigrationSuccess ? successResult : failResult),
  };
}

describe("installOryCMSCoreSchema", () => {
  describe("first install (empty database)", () => {
    let adapter: OryCMSDatabaseAdapter;

    beforeEach(() => {
      adapter = makeMockAdapter([]);
    });

    it("returns success: true", async () => {
      const result = await installOryCMSCoreSchema(adapter);
      expect(result.success).toBe(true);
    });

    it("applies all 11 migrations", async () => {
      const result = await installOryCMSCoreSchema(adapter);
      expect(result.applied).toHaveLength(11);
      expect(result.skipped).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
    });

    it("runs runMigration exactly 11 times", async () => {
      await installOryCMSCoreSchema(adapter);
      expect(adapter.runMigration).toHaveBeenCalledTimes(11);
    });

    it("records each migration in orycms_migrations via createRecord", async () => {
      await installOryCMSCoreSchema(adapter);
      expect(adapter.createRecord).toHaveBeenCalledTimes(11);
      expect(adapter.createRecord).toHaveBeenCalledWith(
        "orycms_migrations",
        expect.objectContaining({ migrationId: "orycms_core_orycms_migrations" }),
      );
    });

    it("applied IDs use the stable orycms_core_ prefix", async () => {
      const result = await installOryCMSCoreSchema(adapter);
      for (const id of result.applied) {
        expect(id).toMatch(/^orycms_core_/);
      }
    });
  });

  describe("second install (all already applied)", () => {
    it("skips all 11 migrations and runs nothing", async () => {
      const plans = generateOryCMSCoreMigrationPlan();
      const alreadyApplied = plans.map((p) => ({ migrationId: p.migrationId }));
      const adapter = makeMockAdapter(alreadyApplied);

      const result = await installOryCMSCoreSchema(adapter);

      expect(result.success).toBe(true);
      expect(result.applied).toHaveLength(0);
      expect(result.skipped).toHaveLength(11);
      expect(result.failed).toHaveLength(0);
      expect(adapter.runMigration).not.toHaveBeenCalled();
    });
  });

  describe("partial install (some already applied)", () => {
    it("applies only the pending migrations", async () => {
      const plans = generateOryCMSCoreMigrationPlan();
      // First 5 are already applied
      const alreadyApplied = plans.slice(0, 5).map((p) => ({ migrationId: p.migrationId }));
      const adapter = makeMockAdapter(alreadyApplied);

      const result = await installOryCMSCoreSchema(adapter);

      expect(result.success).toBe(true);
      expect(result.skipped).toHaveLength(5);
      expect(result.applied).toHaveLength(6);
      expect(adapter.runMigration).toHaveBeenCalledTimes(6);
    });
  });

  describe("failed migration", () => {
    it("records the failure and still returns success: false", async () => {
      const adapter = makeMockAdapter([], false);
      const result = await installOryCMSCoreSchema(adapter);

      expect(result.success).toBe(false);
      expect(result.failed).toHaveLength(11);
      expect(result.failed[0].error).toBe("simulated failure");
    });
  });

  describe("orycms_migrations table does not exist (first run)", () => {
    it("handles findRecords throwing and proceeds with installation", async () => {
      const adapter = makeMockAdapter();
      (adapter.findRecords as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("relation does not exist"),
      );

      const result = await installOryCMSCoreSchema(adapter);

      expect(result.success).toBe(true);
      expect(result.applied).toHaveLength(11);
    });
  });
});
