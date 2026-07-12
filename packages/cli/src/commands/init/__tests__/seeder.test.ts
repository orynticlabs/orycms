/**
 * Seeder tests.
 *
 * Logic tests (idempotency, partial seeding, admin user, status) use an
 * in-memory mock adapter — no module mocking required.
 *
 * Provider-specific tests (SQL dialect) use vi.hoisted + vi.mock on pg,
 * mysql2/promise, and better-sqlite3 — same pattern as migrations.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  seedDatabase,
  seedDatabaseIfNeeded,
  getDatabaseSeedStatus,
  createSeedAdapter,
} from "../database/seeder";
import type { SeedAdapter } from "../database/seeder";
import type {
  PostgresqlWizardResult,
  MysqlWizardResult,
  SqliteWizardResult,
} from "../database/wizard";

// ── In-memory mock adapter ─────────────────────────────────────────────────────

interface MockSeedState {
  roles: Map<string, string>;             // name → id
  permissions: Map<string, string>;       // name → id
  rolePermissions: Set<string>;           // "roleId:permId"
  settings: Map<string, unknown>;         // key → value
  collections: Set<string>;              // slugs
  users: Map<string, { passwordHash: string; roleId: string }>; // email → data
}

function makeSeedAdapter(opts?: {
  existingRoles?: string[];
  existingSettings?: string[];
  existingUsers?: string[];
  insertRoleError?: Error;
  insertPermissionError?: Error;
  insertSettingError?: Error;
}): SeedAdapter & { state: MockSeedState } {
  const roles = new Map<string, string>();
  const permissions = new Map<string, string>();
  const rolePermissions = new Set<string>();
  const settings = new Map<string, unknown>();
  const collections = new Set<string>();
  const users = new Map<string, { passwordHash: string; roleId: string }>();

  for (const name of opts?.existingRoles ?? []) roles.set(name, `id-${name}`);
  for (const key of opts?.existingSettings ?? []) settings.set(key, "existing");
  for (const email of opts?.existingUsers ?? []) users.set(email, { passwordHash: "x", roleId: "y" });

  const state: MockSeedState = { roles, permissions, rolePermissions, settings, collections, users };

  return {
    state,

    async insertRoleIfAbsent(name, description) {
      if (opts?.insertRoleError) throw opts.insertRoleError;
      if (roles.has(name)) return { inserted: false, id: roles.get(name)! };
      const id = `id-${name}`;
      roles.set(name, id);
      void description;
      return { inserted: true, id };
    },

    async insertPermissionIfAbsent(name, resource, action) {
      if (opts?.insertPermissionError) throw opts.insertPermissionError;
      if (permissions.has(name)) return { inserted: false, id: permissions.get(name)! };
      const id = `id-perm-${name}`;
      permissions.set(name, id);
      void resource; void action;
      return { inserted: true, id };
    },

    async linkRolePermissionIfAbsent(roleId, permId) {
      const key = `${roleId}:${permId}`;
      if (rolePermissions.has(key)) return false;
      rolePermissions.add(key);
      return true;
    },

    async insertSettingIfAbsent(key, value, _description) {
      if (opts?.insertSettingError) throw opts.insertSettingError;
      if (settings.has(key)) return false;
      settings.set(key, value);
      return true;
    },

    async insertSystemCollectionIfAbsent(slug, _name, _tableName, _desc) {
      if (collections.has(slug)) return false;
      collections.add(slug);
      return true;
    },

    async insertAdminUserIfAbsent(email, passwordHash, roleId) {
      if (users.has(email)) return false;
      users.set(email, { passwordHash, roleId });
      return true;
    },

    async countRoles() { return roles.size; },
    async countSettings() { return settings.size; },
    async adminUserExists(email) { return users.has(email); },
    async close() {},
  };
}

// ── Fixtures ───────────────────────────────────────────────────────────────────

const CFG: SqliteWizardResult = { provider: "sqlite", filePath: ":memory:" };

// ── seedDatabase — roles ───────────────────────────────────────────────────────

describe("seedDatabase — roles", () => {
  it("seeds all five default roles", async () => {
    const adapter = makeSeedAdapter();
    const result = await seedDatabase(CFG, { adapter });

    expect(result.roles).toHaveLength(5);
    const names = result.roles.map((r) => r.name);
    expect(names).toContain("Owner");
    expect(names).toContain("Admin");
    expect(names).toContain("Editor");
    expect(names).toContain("Author");
    expect(names).toContain("Viewer");
  });

  it("marks all roles as seeded on first run", async () => {
    const adapter = makeSeedAdapter();
    const result = await seedDatabase(CFG, { adapter });
    expect(result.roles.every((r) => r.status === "seeded")).toBe(true);
  });

  it("marks already-existing roles as skipped (idempotent)", async () => {
    const adapter = makeSeedAdapter({ existingRoles: ["Owner", "Admin", "Editor", "Author", "Viewer"] });
    const result = await seedDatabase(CFG, { adapter });
    expect(result.roles.every((r) => r.status === "skipped")).toBe(true);
  });

  it("partially seeds when some roles exist", async () => {
    const adapter = makeSeedAdapter({ existingRoles: ["Owner"] });
    const result = await seedDatabase(CFG, { adapter });

    expect(result.roles.find((r) => r.name === "Owner")?.status).toBe("skipped");
    expect(result.roles.filter((r) => r.status === "seeded")).toHaveLength(4);
  });

  it("marks role as failed and continues when insert throws", async () => {
    const adapter = makeSeedAdapter({ insertRoleError: new Error("DB error") });
    const result = await seedDatabase(CFG, { adapter });
    expect(result.roles.every((r) => r.status === "failed")).toBe(true);
    // Seeding continues past the role failure
    expect(result.settings).toHaveLength(4);
  });

  it("running twice is fully idempotent — all skipped on second run", async () => {
    const adapter = makeSeedAdapter();
    await seedDatabase(CFG, { adapter });
    const second = await seedDatabase(CFG, { adapter });
    expect(second.roles.every((r) => r.status === "skipped")).toBe(true);
  });
});

// ── seedDatabase — permissions ─────────────────────────────────────────────────

describe("seedDatabase — permissions", () => {
  it("seeds at least 25 unique permissions", async () => {
    const adapter = makeSeedAdapter();
    const result = await seedDatabase(CFG, { adapter });
    expect(result.permissions.length).toBeGreaterThanOrEqual(25);
  });

  it("all permissions have resource:action name format", async () => {
    const adapter = makeSeedAdapter();
    const result = await seedDatabase(CFG, { adapter });
    for (const p of result.permissions) {
      expect(p.name).toMatch(/^[a-z]+:[a-z]+$/);
    }
  });

  it("includes collections:manage permission", async () => {
    const adapter = makeSeedAdapter();
    const result = await seedDatabase(CFG, { adapter });
    expect(result.permissions.some((p) => p.name === "collections:manage")).toBe(true);
  });

  it("includes content:publish permission", async () => {
    const adapter = makeSeedAdapter();
    const result = await seedDatabase(CFG, { adapter });
    expect(result.permissions.some((p) => p.name === "content:publish")).toBe(true);
  });

  it("no duplicate permission names", async () => {
    const adapter = makeSeedAdapter();
    const result = await seedDatabase(CFG, { adapter });
    const names = result.permissions.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

// ── seedDatabase — role-permission links ───────────────────────────────────────

describe("seedDatabase — role-permission links", () => {
  it("inserts role-permission links", async () => {
    const adapter = makeSeedAdapter();
    const result = await seedDatabase(CFG, { adapter });
    expect(result.rolePermissions.inserted).toBeGreaterThan(0);
    expect(adapter.state.rolePermissions.size).toBeGreaterThan(0);
  });

  it("skips links on second run (idempotent)", async () => {
    const adapter = makeSeedAdapter();
    await seedDatabase(CFG, { adapter });
    const second = await seedDatabase(CFG, { adapter });
    expect(second.rolePermissions.inserted).toBe(0);
    expect(second.rolePermissions.skipped).toBeGreaterThan(0);
  });

  it("Owner role gets all manage permissions", async () => {
    const adapter = makeSeedAdapter();
    await seedDatabase(CFG, { adapter });

    const ownerRoleId = adapter.state.roles.get("Owner")!;
    const managePermIds = Array.from(adapter.state.permissions.entries())
      .filter(([name]) => name.endsWith(":manage"))
      .map(([, id]) => id);

    for (const permId of managePermIds) {
      expect(adapter.state.rolePermissions.has(`${ownerRoleId}:${permId}`)).toBe(true);
    }
  });
});

// ── seedDatabase — settings ────────────────────────────────────────────────────

describe("seedDatabase — settings", () => {
  it("seeds the four default settings", async () => {
    const adapter = makeSeedAdapter();
    const result = await seedDatabase(CFG, { adapter });
    expect(result.settings).toHaveLength(4);
    const keys = result.settings.map((s) => s.name);
    expect(keys).toContain("site_name");
    expect(keys).toContain("site_url");
    expect(keys).toContain("allow_registrations");
    expect(keys).toContain("maintenance_mode");
  });

  it("persists the correct default values", async () => {
    const adapter = makeSeedAdapter();
    await seedDatabase(CFG, { adapter });
    expect(adapter.state.settings.get("site_name")).toBe("OryCMS");
    expect(adapter.state.settings.get("allow_registrations")).toBe(false);
    expect(adapter.state.settings.get("maintenance_mode")).toBe(false);
  });

  it("skips existing settings (idempotent)", async () => {
    const adapter = makeSeedAdapter({ existingSettings: ["site_name", "site_url", "allow_registrations", "maintenance_mode"] });
    const result = await seedDatabase(CFG, { adapter });
    expect(result.settings.every((s) => s.status === "skipped")).toBe(true);
  });
});

// ── seedDatabase — system collections ─────────────────────────────────────────

describe("seedDatabase — system collections", () => {
  it("seeds all nine system collections", async () => {
    const adapter = makeSeedAdapter();
    const result = await seedDatabase(CFG, { adapter });
    expect(result.systemCollections).toHaveLength(9);
    expect(adapter.state.collections.size).toBe(9);
  });

  it("includes orycms-users collection", async () => {
    const adapter = makeSeedAdapter();
    const result = await seedDatabase(CFG, { adapter });
    expect(result.systemCollections.some((c) => c.name === "orycms-users")).toBe(true);
  });

  it("skips existing collections (idempotent)", async () => {
    const adapter = makeSeedAdapter();
    await seedDatabase(CFG, { adapter });
    const second = await seedDatabase(CFG, { adapter });
    expect(second.systemCollections.every((c) => c.status === "skipped")).toBe(true);
  });
});

// ── seedDatabase — admin user ──────────────────────────────────────────────────

describe("seedDatabase — admin user", () => {
  it("skips admin user when no admin options provided", async () => {
    const adapter = makeSeedAdapter();
    const result = await seedDatabase(CFG, { adapter });
    expect(result.adminUser.status).toBe("skipped");
    expect(adapter.state.users.size).toBe(0);
  });

  it("seeds admin user with provided email and password", async () => {
    const adapter = makeSeedAdapter();
    const result = await seedDatabase(CFG, {
      adapter,
      admin: { email: "owner@example.com", password: "MySecret123" },
    });
    expect(result.adminUser.status).toBe("seeded");
    expect(result.adminUser.email).toBe("owner@example.com");
    expect(adapter.state.users.has("owner@example.com")).toBe(true);
  });

  it("uses provided passwordHash directly without re-hashing", async () => {
    const adapter = makeSeedAdapter();
    await seedDatabase(CFG, {
      adapter,
      admin: { email: "admin@localhost", passwordHash: "$2b$10$myhashvalue" },
    });
    expect(adapter.state.users.get("admin@localhost")?.passwordHash).toBe("$2b$10$myhashvalue");
  });

  it("auto-generates a password when none is provided and includes it in result", async () => {
    const adapter = makeSeedAdapter();
    const result = await seedDatabase(CFG, { admin: { email: "admin@localhost" }, adapter });
    expect(result.adminUser.status).toBe("seeded");
    expect(result.adminUser.generatedPassword).toBeTruthy();
    expect(result.adminUser.generatedPassword).toHaveLength(24); // 12 random bytes = 24 hex chars
  });

  it("does not expose generatedPassword when password was explicitly provided", async () => {
    const adapter = makeSeedAdapter();
    const result = await seedDatabase(CFG, {
      adapter,
      admin: { email: "admin@localhost", password: "explicit123" },
    });
    expect(result.adminUser.generatedPassword).toBeUndefined();
  });

  it("defaults email to admin@localhost when only password is given", async () => {
    const adapter = makeSeedAdapter();
    const result = await seedDatabase(CFG, {
      adapter,
      admin: { password: "pass123" },
    });
    expect(result.adminUser.email).toBe("admin@localhost");
  });

  it("skips admin user when email already exists (idempotent)", async () => {
    const adapter = makeSeedAdapter({ existingUsers: ["admin@localhost"] });
    const result = await seedDatabase(CFG, {
      adapter,
      admin: { email: "admin@localhost", password: "pass" },
    });
    expect(result.adminUser.status).toBe("skipped");
    // Existing passwordHash is not overwritten
    expect(adapter.state.users.get("admin@localhost")?.passwordHash).toBe("x");
  });

  it("assigns the Owner role to the admin user", async () => {
    const adapter = makeSeedAdapter();
    await seedDatabase(CFG, { adapter, admin: { email: "admin@localhost", password: "pw" } });
    const ownerRoleId = adapter.state.roles.get("Owner")!;
    expect(adapter.state.users.get("admin@localhost")?.roleId).toBe(ownerRoleId);
  });

  it("hashes the password with scrypt (not plaintext)", async () => {
    const adapter = makeSeedAdapter();
    await seedDatabase(CFG, {
      adapter,
      admin: { email: "a@b.com", password: "plaintext-pw" },
    });
    const stored = adapter.state.users.get("a@b.com")?.passwordHash ?? "";
    expect(stored).toContain("$orycms-scrypt$");
    expect(stored).not.toContain("plaintext-pw");
  });
});

// ── seedDatabase — result shape ────────────────────────────────────────────────

describe("seedDatabase — result shape", () => {
  it("includes seededAt ISO timestamp", async () => {
    const adapter = makeSeedAdapter();
    const result = await seedDatabase(CFG, { adapter });
    expect(new Date(result.seededAt).toISOString()).toBe(result.seededAt);
  });

  it("includes a non-negative durationMs", async () => {
    const adapter = makeSeedAdapter();
    const result = await seedDatabase(CFG, { adapter });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ── seedDatabaseIfNeeded ───────────────────────────────────────────────────────

describe("seedDatabaseIfNeeded", () => {
  it("seeds when roles table is empty", async () => {
    const adapter = makeSeedAdapter();
    const outcome = await seedDatabaseIfNeeded(CFG, { adapter });
    expect(outcome.seeded).toBe(true);
    expect(outcome.result).toBeDefined();
  });

  it("skips when roles already exist", async () => {
    const adapter = makeSeedAdapter({
      existingRoles: ["Owner"],
      existingSettings: ["site_name"],
    });
    const outcome = await seedDatabaseIfNeeded(CFG, { adapter });
    expect(outcome.seeded).toBe(false);
    expect(outcome.result).toBeUndefined();
  });

  it("skips when fully seeded (second call is a no-op)", async () => {
    const adapter = makeSeedAdapter();
    await seedDatabaseIfNeeded(CFG, { adapter });
    const second = await seedDatabaseIfNeeded(CFG, { adapter });
    expect(second.seeded).toBe(false);
  });

  it("passes admin options through to seedDatabase", async () => {
    const adapter = makeSeedAdapter();
    await seedDatabaseIfNeeded(CFG, {
      adapter,
      admin: { email: "owner@test.com", password: "pass123" },
    });
    expect(adapter.state.users.has("owner@test.com")).toBe(true);
  });
});

// ── getDatabaseSeedStatus ──────────────────────────────────────────────────────

describe("getDatabaseSeedStatus", () => {
  it("isSeeded:false when database is empty", async () => {
    const adapter = makeSeedAdapter();
    const status = await getDatabaseSeedStatus(CFG, { adapter });
    expect(status.isSeeded).toBe(false);
    expect(status.roleCount).toBe(0);
    expect(status.settingCount).toBe(0);
  });

  it("isSeeded:true after seeding", async () => {
    const adapter = makeSeedAdapter();
    await seedDatabase(CFG, { adapter });
    const status = await getDatabaseSeedStatus(CFG, { adapter });
    expect(status.isSeeded).toBe(true);
  });

  it("returns correct roleCount", async () => {
    const adapter = makeSeedAdapter({ existingRoles: ["Owner", "Admin"] });
    const status = await getDatabaseSeedStatus(CFG, { adapter });
    expect(status.roleCount).toBe(2);
  });

  it("returns correct settingCount", async () => {
    const adapter = makeSeedAdapter({ existingSettings: ["site_name"] });
    const status = await getDatabaseSeedStatus(CFG, { adapter });
    expect(status.settingCount).toBe(1);
  });

  it("adminUserExists:false when no admin seeded", async () => {
    const adapter = makeSeedAdapter();
    const status = await getDatabaseSeedStatus(CFG, { adapter });
    expect(status.adminUserExists).toBe(false);
  });

  it("adminUserExists:true after admin is seeded", async () => {
    const adapter = makeSeedAdapter();
    await seedDatabase(CFG, { adapter, admin: { email: "admin@localhost", password: "pw" } });
    const status = await getDatabaseSeedStatus(CFG, { adapter });
    expect(status.adminUserExists).toBe(true);
  });

  it("uses custom adminEmail option for existence check", async () => {
    const adapter = makeSeedAdapter();
    await seedDatabase(CFG, { adapter, admin: { email: "custom@org.com", password: "pw" } });
    const status = await getDatabaseSeedStatus(CFG, { adapter, adminEmail: "custom@org.com" });
    expect(status.adminUserExists).toBe(true);
  });

  it("isSeeded requires both roles AND settings to be present", async () => {
    // Only roles, no settings
    const adapter = makeSeedAdapter({ existingRoles: ["Owner"] });
    const status = await getDatabaseSeedStatus(CFG, { adapter });
    expect(status.isSeeded).toBe(false);
  });
});

// ── Provider-specific adapter tests ───────────────────────────────────────────
//
// Verify that each adapter uses the correct SQL dialect for its provider.
// Module-level mocks via vi.hoisted + vi.mock — same pattern as migrations.test.ts.

const {
  pgQ, pgConnect, pgEnd, PgClient,
  mysqlExec, mysqlEnd, mysqlConn,
  sqliteExec2, sqlitePrepRun, sqlitePrepGet, SqliteDb,
} = vi.hoisted(() => {
  // pg ─────────────────────────────────────────────────────────────────────────
  const pgQ = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
  const pgConnect = vi.fn().mockResolvedValue(undefined);
  const pgEnd = vi.fn().mockResolvedValue(undefined);
  const PgClient = vi.fn(function (this: Record<string, unknown>) {
    this["connect"] = pgConnect;
    this["query"] = pgQ;
    this["end"] = pgEnd;
  });

  // mysql2/promise ─────────────────────────────────────────────────────────────
  const mysqlExec = vi.fn().mockResolvedValue([[{ affectedRows: 1 }], []]);
  const mysqlEnd = vi.fn().mockResolvedValue(undefined);
  const mysqlConn = { execute: mysqlExec, end: mysqlEnd };

  // better-sqlite3 ─────────────────────────────────────────────────────────────
  const sqliteExec2 = vi.fn();
  const sqlitePrepRun = vi.fn().mockReturnValue({ changes: 1 });
  const sqlitePrepGet = vi.fn().mockReturnValue({ count: 0 });
  const SqliteDb = vi.fn(function (this: Record<string, unknown>) {
    this["exec"] = sqliteExec2;
    this["prepare"] = vi.fn().mockReturnValue({ run: sqlitePrepRun, get: sqlitePrepGet, all: vi.fn().mockReturnValue([]) });
    this["close"] = vi.fn();
  });

  return { pgQ, pgConnect, pgEnd, PgClient, mysqlExec, mysqlEnd, mysqlConn, sqliteExec2, sqlitePrepRun, sqlitePrepGet, SqliteDb };
});

vi.mock("pg", () => ({ Client: PgClient }));
vi.mock("mysql2/promise", () => ({ createConnection: vi.fn().mockResolvedValue(mysqlConn) }));
vi.mock("better-sqlite3", () => ({ default: SqliteDb }));

beforeEach(() => {
  vi.clearAllMocks();
  pgQ.mockResolvedValue({ rows: [], rowCount: 0 });
  pgConnect.mockResolvedValue(undefined);
  pgEnd.mockResolvedValue(undefined);
  mysqlExec.mockResolvedValue([[{ affectedRows: 1 }], []]);
  mysqlEnd.mockResolvedValue(undefined);
  sqliteExec2.mockReset();
  sqlitePrepRun.mockReturnValue({ changes: 1 });
  sqlitePrepGet.mockReturnValue({ count: 0 });
});

afterEach(() => vi.restoreAllMocks());

const PG_CFG: PostgresqlWizardResult = {
  provider: "postgresql",
  host: "localhost", port: 5432,
  user: "admin", password: "pass",
  database: "mydb", ssl: false,
};

const MYSQL_CFG: MysqlWizardResult = {
  provider: "mysql",
  host: "localhost", port: 3306,
  user: "root", password: "pass",
  database: "mydb",
};

const SQLITE_CFG: SqliteWizardResult = {
  provider: "sqlite",
  filePath: "./seed-test.sqlite",
};

describe("provider adapters — PostgreSQL", () => {
  it("insertRoleIfAbsent uses ON CONFLICT (name) DO NOTHING", async () => {
    // Simulate insert returning a new row, then no fallback SELECT needed
    pgQ.mockResolvedValueOnce({ rows: [{ id: "new-uuid" }], rowCount: 1 });
    const adapter = await createSeedAdapter(PG_CFG);
    await adapter.insertRoleIfAbsent("Owner", "desc");
    expect(pgQ).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT (name) DO NOTHING"),
      expect.any(Array),
    );
    await adapter.close();
  });

  it("insertPermissionIfAbsent uses ON CONFLICT (name) DO NOTHING", async () => {
    pgQ.mockResolvedValueOnce({ rows: [{ id: "perm-uuid" }], rowCount: 1 });
    const adapter = await createSeedAdapter(PG_CFG);
    await adapter.insertPermissionIfAbsent("collections:manage", "collections", "manage");
    expect(pgQ).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT (name) DO NOTHING"),
      expect.any(Array),
    );
    await adapter.close();
  });

  it("linkRolePermissionIfAbsent uses NOT EXISTS guard", async () => {
    pgQ.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const adapter = await createSeedAdapter(PG_CFG);
    await adapter.linkRolePermissionIfAbsent("role-id", "perm-id");
    expect(pgQ).toHaveBeenCalledWith(
      expect.stringContaining("NOT EXISTS"),
      expect.arrayContaining(["role-id", "perm-id"]),
    );
    await adapter.close();
  });

  it("insertSettingIfAbsent casts value as jsonb", async () => {
    pgQ.mockResolvedValueOnce({ rows: [{ id: "setting-uuid" }], rowCount: 1 });
    const adapter = await createSeedAdapter(PG_CFG);
    await adapter.insertSettingIfAbsent("site_name", "OryCMS");
    expect(pgQ).toHaveBeenCalledWith(
      expect.stringContaining("::jsonb"),
      expect.any(Array),
    );
    await adapter.close();
  });

  it("insertAdminUserIfAbsent uses quoted camelCase columns", async () => {
    pgQ.mockResolvedValueOnce({ rows: [{ id: "user-uuid" }], rowCount: 1 });
    const adapter = await createSeedAdapter(PG_CFG);
    await adapter.insertAdminUserIfAbsent("admin@localhost", "hash", "role-id");
    expect(pgQ).toHaveBeenCalledWith(
      expect.stringContaining('"passwordHash"'),
      expect.any(Array),
    );
    await adapter.close();
  });

  it("countRoles queries orycms_roles", async () => {
    pgQ.mockResolvedValueOnce({ rows: [{ count: "5" }], rowCount: 1 });
    const adapter = await createSeedAdapter(PG_CFG);
    const count = await adapter.countRoles();
    expect(count).toBe(5);
    const allCalls: string[] = pgQ.mock.calls.map((c) => String(c[0]));
    expect(allCalls.some((sql) => sql.includes("orycms_roles"))).toBe(true);
    await adapter.close();
  });
});

describe("provider adapters — MySQL", () => {
  it("insertRoleIfAbsent uses INSERT IGNORE", async () => {
    const adapter = await createSeedAdapter(MYSQL_CFG);
    await adapter.insertRoleIfAbsent("Owner", "desc");
    expect(mysqlExec).toHaveBeenCalledWith(
      expect.stringContaining("INSERT IGNORE"),
      expect.any(Array),
    );
    await adapter.close();
  });

  it("linkRolePermissionIfAbsent uses INSERT IGNORE", async () => {
    const adapter = await createSeedAdapter(MYSQL_CFG);
    await adapter.linkRolePermissionIfAbsent("r1", "p1");
    expect(mysqlExec).toHaveBeenCalledWith(
      expect.stringContaining("INSERT IGNORE"),
      expect.arrayContaining(["r1", "p1"]),
    );
    await adapter.close();
  });

  it("countRoles returns numeric count from mysql result", async () => {
    mysqlExec.mockResolvedValueOnce([[{ count: 3 }], []]);
    const adapter = await createSeedAdapter(MYSQL_CFG);
    const count = await adapter.countRoles();
    expect(count).toBe(3);
    await adapter.close();
  });

  it("insertSettingIfAbsent backtick-quotes the key column", async () => {
    const adapter = await createSeedAdapter(MYSQL_CFG);
    await adapter.insertSettingIfAbsent("site_name", "OryCMS");
    expect(mysqlExec).toHaveBeenCalledWith(
      expect.stringContaining("`key`"),
      expect.any(Array),
    );
    await adapter.close();
  });
});

describe("provider adapters — SQLite", () => {
  it("insertRoleIfAbsent uses INSERT OR IGNORE", async () => {
    const adapter = await createSeedAdapter(SQLITE_CFG);
    await adapter.insertRoleIfAbsent("Owner", "desc");
    expect(sqlitePrepRun).toHaveBeenCalled();
    // The prepare call should contain INSERT OR IGNORE
    const SqliteDbInstance = SqliteDb.mock.instances[0] as { prepare: ReturnType<typeof vi.fn> };
    const prepCalls: string[] = SqliteDbInstance.prepare.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(prepCalls.some((sql) => sql.includes("INSERT OR IGNORE"))).toBe(true);
    await adapter.close();
  });

  it("insertSettingIfAbsent uses INSERT OR IGNORE", async () => {
    const adapter = await createSeedAdapter(SQLITE_CFG);
    await adapter.insertSettingIfAbsent("site_name", "OryCMS");
    const SqliteDbInstance = SqliteDb.mock.instances[0] as { prepare: ReturnType<typeof vi.fn> };
    const prepCalls: string[] = SqliteDbInstance.prepare.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(prepCalls.some((sql) => sql.includes("INSERT OR IGNORE") && sql.includes("orycms_settings"))).toBe(true);
    await adapter.close();
  });

  it("countRoles queries orycms_roles via prepare().get()", async () => {
    sqlitePrepGet.mockReturnValueOnce({ count: 7 });
    const adapter = await createSeedAdapter(SQLITE_CFG);
    const count = await adapter.countRoles();
    expect(count).toBe(7);
    await adapter.close();
  });

  it("adminUserExists returns false when get() returns undefined", async () => {
    sqlitePrepGet.mockReturnValueOnce(undefined);
    const adapter = await createSeedAdapter(SQLITE_CFG);
    const exists = await adapter.adminUserExists("nobody@localhost");
    expect(exists).toBe(false);
    await adapter.close();
  });
});
