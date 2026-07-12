import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import type {
  DatabaseWizardResult,
  FirebaseWizardResult,
  MariadbWizardResult,
  MysqlWizardResult,
  SupabaseWizardResult,
} from "./wizard";

// ── Seed data constants ────────────────────────────────────────────────────────

const DEFAULT_ROLES: Array<{ name: string; description: string }> = [
  { name: "Owner", description: "Full access to all resources" },
  { name: "Admin", description: "Administrative access with user management" },
  { name: "Editor", description: "Content and media management" },
  { name: "Author", description: "Create and manage own content" },
  { name: "Viewer", description: "Read-only access" },
];

// Mirrors ORYCMS_DEFAULT_PERMISSIONS in src/rbac/rbac.engine.ts
// Inlined here so the CLI package has no runtime dependency on the main app.
const M = ["manage"] as const;
const CRUD = ["create", "read", "update", "delete"] as const;
const CRUDP = ["create", "read", "update", "delete", "publish"] as const;

type PermMatrix = Record<string, Record<string, readonly string[]>>;

const PERMISSION_MATRIX: PermMatrix = {
  Owner: {
    collections: M, content: M, media: M, users: M, roles: M,
    plugins: M, settings: M, migrations: M, seo: M,
  },
  Admin: {
    collections: M, content: M, media: M, users: CRUD, roles: ["read"],
    plugins: M, settings: M, migrations: M, seo: M,
  },
  Editor: {
    collections: ["read"], content: CRUDP, media: CRUD, users: ["read"], seo: CRUD,
  },
  Author: {
    collections: ["read"], content: ["create", "read", "update"], media: ["create", "read"],
  },
  Viewer: {
    collections: ["read"], content: ["read"], media: ["read"], seo: ["read"],
  },
};

// Deduplicated permission list derived from the matrix
const _permSet = new Map<string, { resource: string; action: string }>();
for (const resources of Object.values(PERMISSION_MATRIX)) {
  for (const [resource, actions] of Object.entries(resources)) {
    for (const action of actions) {
      _permSet.set(`${resource}:${action}`, { resource, action });
    }
  }
}
const ALL_PERMISSIONS = Array.from(_permSet.entries()).map(([name, p]) => ({
  name,
  resource: p.resource,
  action: p.action,
}));

const DEFAULT_SETTINGS: Array<{ key: string; value: unknown; description: string }> = [
  { key: "site_name", value: "OryCMS", description: "The site display name" },
  { key: "site_url", value: "http://localhost:3000", description: "The canonical site URL" },
  { key: "allow_registrations", value: false, description: "Allow public user sign-up" },
  { key: "maintenance_mode", value: false, description: "Take the site offline for maintenance" },
];

// All nine core system collections — mirrors src/core/core.collections.ts
const SYSTEM_COLLECTIONS: Array<{
  slug: string;
  name: string;
  tableName: string;
  description: string;
}> = [
  { slug: "orycms-migrations", name: "OryMigrations", tableName: "orycms_migrations", description: "Core schema migration tracking" },
  { slug: "orycms-roles", name: "OryRoles", tableName: "orycms_roles", description: "User roles for access control" },
  { slug: "orycms-permissions", name: "OryPermissions", tableName: "orycms_permissions", description: "Granular action permissions" },
  { slug: "orycms-settings", name: "OrySettings", tableName: "orycms_settings", description: "CMS-wide key/value configuration" },
  { slug: "orycms-collections", name: "OryCollections", tableName: "orycms_collections", description: "Content collection schema registry" },
  { slug: "orycms-users", name: "OryUsers", tableName: "orycms_users", description: "CMS user accounts" },
  { slug: "orycms-role-permissions", name: "OryRolePermissions", tableName: "orycms_role_permissions", description: "Role → permission junction" },
  { slug: "orycms-sessions", name: "OrySessions", tableName: "orycms_sessions", description: "Active user sessions" },
  { slug: "orycms-collection-fields", name: "OryCollectionFields", tableName: "orycms_collection_fields", description: "Collection field definitions" },
];

// ── Public types ───────────────────────────────────────────────────────────────

export type SeedItemStatus = "seeded" | "skipped" | "failed";

export interface SeedItemResult {
  name: string;
  status: SeedItemStatus;
  error?: string;
}

export interface SeedResult {
  roles: SeedItemResult[];
  permissions: SeedItemResult[];
  rolePermissions: { inserted: number; skipped: number };
  settings: SeedItemResult[];
  systemCollections: SeedItemResult[];
  adminUser: SeedItemResult & { email: string; generatedPassword?: string };
  seededAt: string;
  durationMs: number;
}

export interface SeedStatusResult {
  isSeeded: boolean;
  roleCount: number;
  settingCount: number;
  adminUserExists: boolean;
}

// ── SeedAdapter interface ──────────────────────────────────────────────────────

/**
 * All provider-specific database interactions go through this interface.
 * Tests inject a mock; production code uses createSeedAdapter().
 *
 * Every "insert if absent" method returns an object indicating whether a new
 * row was created and, when applicable, the resolved ID (needed for FK links).
 */
export interface SeedAdapter {
  insertRoleIfAbsent(
    name: string,
    description: string,
  ): Promise<{ inserted: boolean; id: string }>;

  insertPermissionIfAbsent(
    name: string,
    resource: string,
    action: string,
  ): Promise<{ inserted: boolean; id: string }>;

  /** Link a role to a permission. Returns true if the link was newly created. */
  linkRolePermissionIfAbsent(roleId: string, permissionId: string): Promise<boolean>;

  insertSettingIfAbsent(key: string, value: unknown, description?: string): Promise<boolean>;

  insertSystemCollectionIfAbsent(
    slug: string,
    name: string,
    tableName: string,
    description: string,
  ): Promise<boolean>;

  /** Returns true if the user was newly created. */
  insertAdminUserIfAbsent(
    email: string,
    passwordHash: string,
    ownerRoleId: string,
  ): Promise<boolean>;

  countRoles(): Promise<number>;
  countSettings(): Promise<number>;
  adminUserExists(email: string): Promise<boolean>;
  close(): Promise<void>;
}

// ── Admin options ─────────────────────────────────────────────────────────────

export interface AdminSeedOptions {
  /** Default: "admin@localhost" */
  email?: string;
  /** Pre-computed hash (e.g. bcrypt) — takes priority over password. */
  passwordHash?: string;
  /** Plaintext password — hashed with scrypt before storage. */
  password?: string;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

/** Hash a plaintext password with scrypt. NOT bcrypt-compatible. */
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `$orycms-scrypt$${salt}$${derived}`;
}

function pgConnectionString(c: {
  user: string;
  password: string;
  host: string;
  port: number;
  database: string;
  ssl: boolean;
}): string {
  const ssl = c.ssl ? "?sslmode=require" : "";
  return `postgresql://${encodeURIComponent(c.user)}:${encodeURIComponent(c.password)}@${c.host}:${c.port}/${c.database}${ssl}`;
}

function supabaseConnectionString(c: SupabaseWizardResult): string {
  const ref = new URL(c.url).hostname.replace(/\.supabase\.co$/, "");
  return `postgresql://postgres:${encodeURIComponent(c.serviceKey)}@db.${ref}.supabase.co:5432/postgres`;
}

// ── Provider-specific adapter factories (private) ─────────────────────────────

async function createPgSeedAdapter(connectionString: string): Promise<SeedAdapter> {
  const { Client } = await import("pg");
  const client = new Client({ connectionString });
  await client.connect();

  async function upsertById(
    table: string,
    conflictCol: string,
    cols: string[],
    vals: unknown[],
  ): Promise<{ inserted: boolean; id: string }> {
    const id = randomUUID();
    const colList = `id, ${cols.join(", ")}`;
    const placeholders = Array.from({ length: cols.length + 1 }, (_, i) => `$${i + 1}`).join(", ");
    const res = await client.query<{ id: string }>(
      `INSERT INTO ${table} (${colList}) VALUES (${placeholders})
       ON CONFLICT (${conflictCol}) DO NOTHING RETURNING id`,
      [id, ...vals],
    );
    if (res.rows.length > 0) return { inserted: true, id: res.rows[0].id };
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM ${table} WHERE ${conflictCol} = $1`,
      [vals[cols.indexOf(conflictCol)]],
    );
    return { inserted: false, id: existing.rows[0].id };
  }

  return {
    async insertRoleIfAbsent(name, description) {
      return upsertById("orycms_roles", "name", ["name", "description"], [name, description]);
    },

    async insertPermissionIfAbsent(name, resource, action) {
      return upsertById(
        "orycms_permissions",
        "name",
        ["name", "resource", "action"],
        [name, resource, action],
      );
    },

    async linkRolePermissionIfAbsent(roleId, permId) {
      const res = await client.query(
        `INSERT INTO orycms_role_permissions ("roleId", "permissionId")
         SELECT $1, $2 WHERE NOT EXISTS (
           SELECT 1 FROM orycms_role_permissions WHERE "roleId" = $1 AND "permissionId" = $2
         )`,
        [roleId, permId],
      );
      return (res.rowCount ?? 0) > 0;
    },

    async insertSettingIfAbsent(key, value, description) {
      const id = randomUUID();
      const res = await client.query<{ id: string }>(
        `INSERT INTO orycms_settings (id, key, value, description)
         VALUES ($1, $2, $3::jsonb, $4)
         ON CONFLICT (key) DO NOTHING RETURNING id`,
        [id, key, JSON.stringify(value), description ?? null],
      );
      return res.rows.length > 0;
    },

    async insertSystemCollectionIfAbsent(slug, name, tableName, description) {
      const id = randomUUID();
      const res = await client.query<{ id: string }>(
        `INSERT INTO orycms_collections (id, "collectionSlug", name, "tableName", description, "isSystem")
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT ("collectionSlug") DO NOTHING RETURNING id`,
        [id, slug, name, tableName, description],
      );
      return res.rows.length > 0;
    },

    async insertAdminUserIfAbsent(email, passwordHash, roleId) {
      const id = randomUUID();
      const res = await client.query<{ id: string }>(
        `INSERT INTO orycms_users (id, email, "passwordHash", status, "roleId")
         VALUES ($1, $2, $3, 'active', $4)
         ON CONFLICT (email) DO NOTHING RETURNING id`,
        [id, email, passwordHash, roleId],
      );
      return res.rows.length > 0;
    },

    async countRoles() {
      const res = await client.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM orycms_roles",
      );
      return Number(res.rows[0].count);
    },

    async countSettings() {
      const res = await client.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM orycms_settings",
      );
      return Number(res.rows[0].count);
    },

    async adminUserExists(email) {
      const res = await client.query(
        "SELECT 1 FROM orycms_users WHERE email = $1",
        [email],
      );
      return res.rows.length > 0;
    },

    async close() { await client.end(); },
  };
}

async function createMysqlSeedAdapter(
  c: MysqlWizardResult | MariadbWizardResult,
): Promise<SeedAdapter> {
  const { createConnection } = await import("mysql2/promise");
  const conn = await createConnection({
    host: c.host, port: c.port, user: c.user, password: c.password, database: c.database,
  });

  async function upsertIgnore(
    table: string,
    keyCol: string,
    cols: string[],
    vals: unknown[],
  ): Promise<{ inserted: boolean; id: string }> {
    const id = randomUUID();
    const colList = `id, ${cols.join(", ")}`;
    const placeholders = Array(cols.length + 1).fill("?").join(", ");
    const raw = await conn.execute(`INSERT IGNORE INTO ${table} (${colList}) VALUES (${placeholders})`, [id, ...vals]);
    const [res] = raw as [{ affectedRows: number }[], unknown[]];
    if (res[0].affectedRows > 0) return { inserted: true, id };
    const selectRaw = await conn.execute(`SELECT id FROM ${table} WHERE \`${keyCol}\` = ?`, [vals[cols.indexOf(keyCol)]]);
    const rows = (selectRaw as [unknown[], unknown[]])[0] as [{ id: string }];
    return { inserted: false, id: rows[0].id };
  }

  return {
    async insertRoleIfAbsent(name, description) {
      return upsertIgnore("orycms_roles", "name", ["name", "description"], [name, description]);
    },

    async insertPermissionIfAbsent(name, resource, action) {
      return upsertIgnore("orycms_permissions", "name", ["name", "resource", "action"], [name, resource, action]);
    },

    async linkRolePermissionIfAbsent(roleId, permId) {
      const raw = await conn.execute(
        `INSERT IGNORE INTO orycms_role_permissions (roleId, permissionId) VALUES (?, ?)`,
        [roleId, permId],
      );
      const [res] = raw as [{ affectedRows: number }[], unknown[]];
      return res[0].affectedRows > 0;
    },

    async insertSettingIfAbsent(key, value, description) {
      const raw = await conn.execute(
        `INSERT IGNORE INTO orycms_settings (id, \`key\`, value, description) VALUES (?, ?, ?, ?)`,
        [randomUUID(), key, JSON.stringify(value), description ?? null],
      );
      const [res] = raw as [{ affectedRows: number }[], unknown[]];
      return res[0].affectedRows > 0;
    },

    async insertSystemCollectionIfAbsent(slug, name, tableName, description) {
      const raw = await conn.execute(
        `INSERT IGNORE INTO orycms_collections (id, collectionSlug, name, tableName, description, isSystem)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [randomUUID(), slug, name, tableName, description],
      );
      const [res] = raw as [{ affectedRows: number }[], unknown[]];
      return res[0].affectedRows > 0;
    },

    async insertAdminUserIfAbsent(email, passwordHash, roleId) {
      const raw = await conn.execute(
        `INSERT IGNORE INTO orycms_users (id, email, passwordHash, status, roleId)
         VALUES (?, ?, ?, 'active', ?)`,
        [randomUUID(), email, passwordHash, roleId],
      );
      const [res] = raw as [{ affectedRows: number }[], unknown[]];
      return res[0].affectedRows > 0;
    },

    async countRoles() {
      const raw = await conn.execute("SELECT COUNT(*) AS count FROM orycms_roles");
      const rows = (raw as [unknown[], unknown[]])[0] as [{ count: number }];
      return Number(rows[0].count);
    },

    async countSettings() {
      const raw = await conn.execute("SELECT COUNT(*) AS count FROM orycms_settings");
      const rows = (raw as [unknown[], unknown[]])[0] as [{ count: number }];
      return Number(rows[0].count);
    },

    async adminUserExists(email) {
      const raw = await conn.execute("SELECT 1 FROM orycms_users WHERE email = ?", [email]);
      const rows = (raw as [unknown[], unknown[]])[0] as unknown[];
      return rows.length > 0;
    },

    async close() { await conn.end(); },
  };
}

async function createSqliteSeedAdapter(filePath: string): Promise<SeedAdapter> {
  const { default: Database } = await import("better-sqlite3");
  const db = new Database(filePath);

  function upsertOrIgnore(
    table: string,
    keyCol: string,
    cols: string[],
    vals: unknown[],
  ): { inserted: boolean; id: string } {
    const id = randomUUID();
    const colList = `id, ${cols.join(", ")}`;
    const placeholders = Array(cols.length + 1).fill("?").join(", ");
    const res = db.prepare(`INSERT OR IGNORE INTO ${table} (${colList}) VALUES (${placeholders})`).run(id, ...vals);
    if (res.changes > 0) return { inserted: true, id };
    const row = db.prepare(`SELECT id FROM ${table} WHERE ${keyCol} = ?`).get(vals[cols.indexOf(keyCol)]) as { id: string };
    return { inserted: false, id: row.id };
  }

  return {
    async insertRoleIfAbsent(name, description) {
      return upsertOrIgnore("orycms_roles", "name", ["name", "description"], [name, description]);
    },

    async insertPermissionIfAbsent(name, resource, action) {
      return upsertOrIgnore("orycms_permissions", "name", ["name", "resource", "action"], [name, resource, action]);
    },

    async linkRolePermissionIfAbsent(roleId, permId) {
      const res = db.prepare(
        `INSERT OR IGNORE INTO orycms_role_permissions (roleId, permissionId) VALUES (?, ?)`,
      ).run(roleId, permId);
      return res.changes > 0;
    },

    async insertSettingIfAbsent(key, value, description) {
      const res = db.prepare(
        `INSERT OR IGNORE INTO orycms_settings (id, key, value, description) VALUES (?, ?, ?, ?)`,
      ).run(randomUUID(), key, JSON.stringify(value), description ?? null);
      return res.changes > 0;
    },

    async insertSystemCollectionIfAbsent(slug, name, tableName, description) {
      const res = db.prepare(
        `INSERT OR IGNORE INTO orycms_collections (id, collectionSlug, name, tableName, description, isSystem)
         VALUES (?, ?, ?, ?, ?, 1)`,
      ).run(randomUUID(), slug, name, tableName, description);
      return res.changes > 0;
    },

    async insertAdminUserIfAbsent(email, passwordHash, roleId) {
      const res = db.prepare(
        `INSERT OR IGNORE INTO orycms_users (id, email, passwordHash, status, roleId)
         VALUES (?, ?, ?, 'active', ?)`,
      ).run(randomUUID(), email, passwordHash, roleId);
      return res.changes > 0;
    },

    async countRoles() {
      const row = db.prepare("SELECT COUNT(*) AS count FROM orycms_roles").get() as { count: number };
      return Number(row.count);
    },

    async countSettings() {
      const row = db.prepare("SELECT COUNT(*) AS count FROM orycms_settings").get() as { count: number };
      return Number(row.count);
    },

    async adminUserExists(email) {
      const row = db.prepare("SELECT 1 FROM orycms_users WHERE email = ?").get(email);
      return row !== undefined;
    },

    async close() { db.close(); },
  };
}

async function createMongoSeedAdapter(uri: string): Promise<SeedAdapter> {
  const { default: mongoose } = await import("mongoose");
  const conn = await mongoose.createConnection(uri).asPromise();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = conn.db as any;

  async function findOrInsert(
    colName: string,
    filter: Record<string, unknown>,
    doc: Record<string, unknown>,
  ): Promise<{ inserted: boolean; id: string }> {
    const existing = await db.collection(colName).findOne(filter);
    if (existing) return { inserted: false, id: existing.id as string };
    const id = randomUUID();
    await db.collection(colName).insertOne({ id, ...doc });
    return { inserted: true, id };
  }

  return {
    async insertRoleIfAbsent(name, description) {
      return findOrInsert("orycms_roles", { name }, { name, description });
    },

    async insertPermissionIfAbsent(name, resource, action) {
      return findOrInsert("orycms_permissions", { name }, { name, resource, action });
    },

    async linkRolePermissionIfAbsent(roleId, permId) {
      const existing = await db.collection("orycms_role_permissions").findOne({ roleId, permissionId: permId });
      if (existing) return false;
      await db.collection("orycms_role_permissions").insertOne({ id: randomUUID(), roleId, permissionId: permId });
      return true;
    },

    async insertSettingIfAbsent(key, value) {
      const existing = await db.collection("orycms_settings").findOne({ key });
      if (existing) return false;
      await db.collection("orycms_settings").insertOne({ id: randomUUID(), key, value: JSON.stringify(value) });
      return true;
    },

    async insertSystemCollectionIfAbsent(slug, name, tableName, description) {
      const existing = await db.collection("orycms_collections").findOne({ collectionSlug: slug });
      if (existing) return false;
      await db.collection("orycms_collections").insertOne({ id: randomUUID(), collectionSlug: slug, name, tableName, description, isSystem: true });
      return true;
    },

    async insertAdminUserIfAbsent(email, passwordHash, roleId) {
      const existing = await db.collection("orycms_users").findOne({ email });
      if (existing) return false;
      await db.collection("orycms_users").insertOne({ id: randomUUID(), email, passwordHash, status: "active", roleId });
      return true;
    },

    async countRoles() {
      return db.collection("orycms_roles").countDocuments();
    },

    async countSettings() {
      return db.collection("orycms_settings").countDocuments();
    },

    async adminUserExists(email) {
      const doc = await db.collection("orycms_users").findOne({ email });
      return doc !== null;
    },

    async close() { await conn.close(); },
  };
}

let _fbSeedSeq = 0;

async function createFirebaseSeedAdapter(c: FirebaseWizardResult): Promise<SeedAdapter> {
  const { initializeApp, cert, deleteApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");

  const app = initializeApp(
    { credential: cert({ projectId: c.projectId, privateKey: c.privateKey, clientEmail: c.clientEmail }) },
    `orycms-seed-${++_fbSeedSeq}`,
  );
  const db = getFirestore(app);

  async function docSetIfAbsent(
    collection: string,
    docId: string,
    data: Record<string, unknown>,
  ): Promise<{ inserted: boolean; id: string }> {
    const snap = await db.collection(collection).doc(docId).get();
    if (snap.data()) return { inserted: false, id: docId };
    await db.collection(collection).doc(docId).set({ id: docId, ...data });
    return { inserted: true, id: docId };
  }

  return {
    async insertRoleIfAbsent(name, description) {
      return docSetIfAbsent("orycms_roles", name, { name, description });
    },

    async insertPermissionIfAbsent(name, resource, action) {
      return docSetIfAbsent("orycms_permissions", name, { name, resource, action });
    },

    async linkRolePermissionIfAbsent(roleId, permId) {
      const key = `${roleId}__${permId}`;
      const snap = await db.collection("orycms_role_permissions").doc(key).get();
      if (snap.data()) return false;
      await db.collection("orycms_role_permissions").doc(key).set({ id: key, roleId, permissionId: permId });
      return true;
    },

    async insertSettingIfAbsent(key, value) {
      const snap = await db.collection("orycms_settings").doc(key).get();
      if (snap.data()) return false;
      await db.collection("orycms_settings").doc(key).set({ id: key, key, value: JSON.stringify(value) });
      return true;
    },

    async insertSystemCollectionIfAbsent(slug, name, tableName, description) {
      const snap = await db.collection("orycms_collections").doc(slug).get();
      if (snap.data()) return false;
      await db.collection("orycms_collections").doc(slug).set({ id: slug, collectionSlug: slug, name, tableName, description, isSystem: true });
      return true;
    },

    async insertAdminUserIfAbsent(email, passwordHash, roleId) {
      const docId = email.replace(/[@.]/g, "_");
      const snap = await db.collection("orycms_users").doc(docId).get();
      if (snap.data()) return false;
      await db.collection("orycms_users").doc(docId).set({ id: docId, email, passwordHash, status: "active", roleId });
      return true;
    },

    async countRoles() {
      const snap = await db.collection("orycms_roles").orderBy("id", "asc").get();
      return snap.docs.length;
    },

    async countSettings() {
      const snap = await db.collection("orycms_settings").orderBy("id", "asc").get();
      return snap.docs.length;
    },

    async adminUserExists(email) {
      const docId = email.replace(/[@.]/g, "_");
      const snap = await db.collection("orycms_users").doc(docId).get();
      return snap.data() !== undefined;
    },

    async close() { await deleteApp(app); },
  };
}

// ── Adapter factory ───────────────────────────────────────────────────────────

export async function createSeedAdapter(config: DatabaseWizardResult): Promise<SeedAdapter> {
  switch (config.provider) {
    case "postgresql":
      return createPgSeedAdapter(pgConnectionString(config));
    case "neon":
      return createPgSeedAdapter(config.databaseUrl);
    case "supabase":
      return createPgSeedAdapter(supabaseConnectionString(config));
    case "mysql":
    case "mariadb":
      return createMysqlSeedAdapter(config);
    case "sqlite":
      return createSqliteSeedAdapter(config.filePath);
    case "mongodb":
      return createMongoSeedAdapter(config.uri);
    case "firebase":
      return createFirebaseSeedAdapter(config);
  }
}

// ── Core seeding logic (private) ──────────────────────────────────────────────

async function runSeed(adapter: SeedAdapter, admin?: AdminSeedOptions): Promise<SeedResult> {
  const start = Date.now();
  const seededAt = new Date().toISOString();

  // ── Roles ──────────────────────────────────────────────────────────────────
  const roleIds = new Map<string, string>();
  const roles: SeedItemResult[] = [];
  for (const role of DEFAULT_ROLES) {
    try {
      const { inserted, id } = await adapter.insertRoleIfAbsent(role.name, role.description);
      roleIds.set(role.name, id);
      roles.push({ name: role.name, status: inserted ? "seeded" : "skipped" });
    } catch (e) {
      roles.push({ name: role.name, status: "failed", error: String(e) });
    }
  }

  // ── Permissions ────────────────────────────────────────────────────────────
  const permIds = new Map<string, string>();
  const permissions: SeedItemResult[] = [];
  for (const perm of ALL_PERMISSIONS) {
    try {
      const { inserted, id } = await adapter.insertPermissionIfAbsent(perm.name, perm.resource, perm.action);
      permIds.set(perm.name, id);
      permissions.push({ name: perm.name, status: inserted ? "seeded" : "skipped" });
    } catch (e) {
      permissions.push({ name: perm.name, status: "failed", error: String(e) });
    }
  }

  // ── Role ↔ Permission links ────────────────────────────────────────────────
  let rpInserted = 0;
  let rpSkipped = 0;
  for (const [roleName, resources] of Object.entries(PERMISSION_MATRIX)) {
    const roleId = roleIds.get(roleName);
    if (!roleId) continue;
    for (const [resource, actions] of Object.entries(resources)) {
      for (const action of actions) {
        const permId = permIds.get(`${resource}:${action}`);
        if (!permId) continue;
        try {
          const inserted = await adapter.linkRolePermissionIfAbsent(roleId, permId);
          if (inserted) rpInserted++; else rpSkipped++;
        } catch {
          // non-fatal — continue seeding other links
        }
      }
    }
  }

  // ── Settings ───────────────────────────────────────────────────────────────
  const settings: SeedItemResult[] = [];
  for (const s of DEFAULT_SETTINGS) {
    try {
      const inserted = await adapter.insertSettingIfAbsent(s.key, s.value, s.description);
      settings.push({ name: s.key, status: inserted ? "seeded" : "skipped" });
    } catch (e) {
      settings.push({ name: s.key, status: "failed", error: String(e) });
    }
  }

  // ── System collections ─────────────────────────────────────────────────────
  const systemCollections: SeedItemResult[] = [];
  for (const col of SYSTEM_COLLECTIONS) {
    try {
      const inserted = await adapter.insertSystemCollectionIfAbsent(col.slug, col.name, col.tableName, col.description);
      systemCollections.push({ name: col.slug, status: inserted ? "seeded" : "skipped" });
    } catch (e) {
      systemCollections.push({ name: col.slug, status: "failed", error: String(e) });
    }
  }

  // ── Admin user ─────────────────────────────────────────────────────────────
  let adminUser: SeedResult["adminUser"];

  if (admin !== undefined) {
    const email = admin.email ?? "admin@localhost";
    let passwordHash: string;
    let generatedPassword: string | undefined;

    if (admin.passwordHash) {
      passwordHash = admin.passwordHash;
    } else if (admin.password) {
      passwordHash = hashPassword(admin.password);
    } else {
      generatedPassword = randomBytes(12).toString("hex");
      passwordHash = hashPassword(generatedPassword);
    }

    const ownerRoleId = roleIds.get("Owner") ?? "";
    try {
      const inserted = await adapter.insertAdminUserIfAbsent(email, passwordHash, ownerRoleId);
      adminUser = {
        name: email,
        email,
        status: inserted ? "seeded" : "skipped",
        ...(generatedPassword !== undefined ? { generatedPassword } : {}),
      };
    } catch (e) {
      adminUser = { name: email, email, status: "failed", error: String(e) };
    }
  } else {
    adminUser = { name: "admin", email: "", status: "skipped" };
  }

  return {
    roles,
    permissions,
    rolePermissions: { inserted: rpInserted, skipped: rpSkipped },
    settings,
    systemCollections,
    adminUser,
    seededAt,
    durationMs: Date.now() - start,
  };
}

async function computeStatus(adapter: SeedAdapter, adminEmail: string): Promise<SeedStatusResult> {
  const [roleCount, settingCount, adminExists] = await Promise.all([
    adapter.countRoles(),
    adapter.countSettings(),
    adapter.adminUserExists(adminEmail),
  ]);
  return {
    isSeeded: roleCount > 0 && settingCount > 0,
    roleCount,
    settingCount,
    adminUserExists: adminExists,
  };
}

// ── run helper ─────────────────────────────────────────────────────────────────

async function withAdapter<T>(
  config: DatabaseWizardResult,
  options: { adapter?: SeedAdapter } | undefined,
  fn: (a: SeedAdapter) => Promise<T>,
): Promise<T> {
  const own = options?.adapter === undefined;
  const adapter = options?.adapter ?? (await createSeedAdapter(config));
  try {
    return await fn(adapter);
  } finally {
    if (own) await adapter.close();
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Seed all default system data.
 * Every operation is idempotent — safe to call multiple times.
 */
export async function seedDatabase(
  config: DatabaseWizardResult,
  options?: { adapter?: SeedAdapter; admin?: AdminSeedOptions },
): Promise<SeedResult> {
  return withAdapter(config, options, (adapter) => runSeed(adapter, options?.admin));
}

/**
 * Seed only if the database has not been seeded yet (no roles found).
 * Returns `{ seeded: false }` when skipped, `{ seeded: true, result }` otherwise.
 */
export async function seedDatabaseIfNeeded(
  config: DatabaseWizardResult,
  options?: { adapter?: SeedAdapter; admin?: AdminSeedOptions },
): Promise<{ seeded: boolean; result?: SeedResult }> {
  return withAdapter(config, options, async (adapter) => {
    const status = await computeStatus(adapter, options?.admin?.email ?? "admin@localhost");
    if (status.isSeeded) return { seeded: false };
    const result = await runSeed(adapter, options?.admin);
    return { seeded: true, result };
  });
}

/**
 * Return the current seed status without modifying any data.
 */
export async function getDatabaseSeedStatus(
  config: DatabaseWizardResult,
  options?: { adapter?: SeedAdapter; adminEmail?: string },
): Promise<SeedStatusResult> {
  return withAdapter(config, options, (adapter) =>
    computeStatus(adapter, options?.adminEmail ?? "admin@localhost"),
  );
}
