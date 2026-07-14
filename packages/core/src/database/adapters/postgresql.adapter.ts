import { Pool } from "pg";
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
import type { OryCMSCollectionMigrationPlan } from "@/mapper";

// Diagnostics only — never branches query logic on provider
function detectProvider(url: string): "neon" | "supabase" | "postgresql" {
  if (url.includes(".neon.tech")) return "neon";
  if (url.includes(".supabase.co")) return "supabase";
  return "postgresql";
}

function buildWhereClause(
  filters: NonNullable<OryCMSDatabaseFindOptions["filters"]>,
  startIdx: number,
): { clause: string; values: unknown[] } {
  const parts: string[] = [];
  const values: unknown[] = [];
  let i = startIdx;

  for (const f of filters) {
    const col = `"${f.field}"`;
    switch (f.operator) {
      case "eq":
        parts.push(`${col} = $${i++}`);
        values.push(f.value);
        break;
      case "ne":
        parts.push(`${col} != $${i++}`);
        values.push(f.value);
        break;
      case "gt":
        parts.push(`${col} > $${i++}`);
        values.push(f.value);
        break;
      case "gte":
        parts.push(`${col} >= $${i++}`);
        values.push(f.value);
        break;
      case "lt":
        parts.push(`${col} < $${i++}`);
        values.push(f.value);
        break;
      case "lte":
        parts.push(`${col} <= $${i++}`);
        values.push(f.value);
        break;
      case "in":
        parts.push(`${col} = ANY($${i++})`);
        values.push(f.value);
        break;
      case "nin":
        parts.push(`NOT (${col} = ANY($${i++}))`);
        values.push(f.value);
        break;
      case "contains":
        parts.push(`${col} ILIKE $${i++}`);
        values.push(`%${f.value}%`);
        break;
      case "startsWith":
        parts.push(`${col} ILIKE $${i++}`);
        values.push(`${f.value}%`);
        break;
      case "endsWith":
        parts.push(`${col} ILIKE $${i++}`);
        values.push(`%${f.value}`);
        break;
    }
  }

  return { clause: parts.length ? `WHERE ${parts.join(" AND ")}` : "", values };
}

function schemaToCreateSQL(name: string, schema: OryCMSDatabaseCollectionSchema): string {
  const cols = schema.fields
    .map((f) => {
      const parts = [`"${f.name}" ${f.type}`];
      if (f.required) parts.push("NOT NULL");
      if (f.unique) parts.push("UNIQUE");
      if (f.default !== undefined) parts.push(`DEFAULT ${JSON.stringify(f.default)}`);
      return `  ${parts.join(" ")}`;
    })
    .join(",\n");
  return (
    `CREATE TABLE IF NOT EXISTS "${name}" (\n` +
    `  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid()` +
    (cols ? `,\n${cols}` : "") +
    `\n);`
  );
}

const CAPABILITIES: OryCMSDatabaseAdapterCapabilities = {
  transactions: true,
  relations: true,
  fullTextSearch: true,
  geospatial: true,
  realtime: false,
  migrations: true,
  jsonFields: true,
};

export function createOryCMSPostgreSQLAdapter(
  defaults?: Partial<OryCMSDatabaseConnectionConfig>,
): OryCMSDatabaseAdapter {
  // ponytail: single Pool for both pooled and direct modes; direct == poolSize:1
  let pool: Pool | null = null;

  function getPool(): Pool {
    if (!pool) throw new Error("OryCMS PostgreSQL: call connect() first");
    return pool;
  }

  return {
    type: "postgresql" satisfies OryCMSDatabaseAdapterType,
    capabilities: CAPABILITIES,

    async connect(cfg: OryCMSDatabaseConnectionConfig): Promise<void> {
      const merged = { ...defaults, ...cfg };
      const url = merged.url ?? process.env.ORYCMS_DATABASE_URL;
      const provider = url ? detectProvider(url) : "postgresql";
      // Auto-enable SSL for cloud providers; pg also parses sslmode from the URL
      const autoSsl = provider === "neon" || provider === "supabase";
      const ssl = merged.ssl ?? autoSsl;

      pool = new Pool({
        connectionString: url,
        ...(url
          ? {}
          : {
              host: merged.host,
              port: merged.port,
              database: merged.database,
              user: merged.username,
              password: merged.password,
            }),
        ssl,
        max: merged.poolSize ?? 10,
        connectionTimeoutMillis: merged.timeoutMs,
      });

      await pool.query("SELECT 1");
    },

    async disconnect(): Promise<void> {
      await pool?.end();
      pool = null;
    },

    async testConnection(): Promise<OryCMSDatabaseHealth> {
      const start = Date.now();
      try {
        await getPool().query("SELECT 1");
        return {
          status: "healthy",
          latencyMs: Date.now() - start,
          checkedAt: new Date().toISOString(),
        };
      } catch (err) {
        return {
          status: "unreachable",
          message: String(err),
          checkedAt: new Date().toISOString(),
        };
      }
    },

    async createCollection(name: string, schema?: OryCMSDatabaseCollectionSchema): Promise<void> {
      const sql = schema
        ? schemaToCreateSQL(name, schema)
        : `CREATE TABLE IF NOT EXISTS "${name}" ("id" UUID PRIMARY KEY DEFAULT gen_random_uuid());`;
      await getPool().query(sql);
    },

    async updateCollection(
      name: string,
      schema: Partial<OryCMSDatabaseCollectionSchema>,
    ): Promise<void> {
      for (const field of schema.fields ?? []) {
        await getPool().query(
          `ALTER TABLE "${name}" ADD COLUMN IF NOT EXISTS "${field.name}" ${field.type}`,
        );
      }
    },

    async deleteCollection(name: string): Promise<void> {
      await getPool().query(`DROP TABLE IF EXISTS "${name}"`);
    },

    async createRecord(
      collection: string,
      data: OryCMSDatabaseRecord,
    ): Promise<OryCMSDatabaseRecord> {
      const keys = Object.keys(data);
      if (!keys.length)
        throw new Error("OryCMS PostgreSQL: createRecord requires at least one field");
      const cols = keys.map((k) => `"${k}"`).join(", ");
      const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(", ");
      const result = await getPool().query(
        `INSERT INTO "${collection}" (${cols}) VALUES (${placeholders}) RETURNING *`,
        keys.map((k) => data[k]),
      );
      return result.rows[0];
    },

    async findRecords(
      collection: string,
      options?: OryCMSDatabaseFindOptions,
    ): Promise<OryCMSDatabaseRecord[]> {
      const values: unknown[] = [];
      let sql = `SELECT * FROM "${collection}"`;

      if (options?.filters?.length) {
        const { clause, values: fv } = buildWhereClause(options.filters, 1);
        if (clause) {
          sql += ` ${clause}`;
          values.push(...fv);
        }
      }

      if (options?.sort?.length) {
        sql += ` ORDER BY ${options.sort.map((s) => `"${s.field}" ${s.direction.toUpperCase()}`).join(", ")}`;
      }

      if (options?.pagination) {
        const { limit = 100, page = 1 } = options.pagination;
        sql += ` LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
        values.push(limit, (page - 1) * limit);
      }

      const result = await getPool().query(sql, values);
      return result.rows;
    },

    async findRecordById(collection: string, id: string): Promise<OryCMSDatabaseRecord | null> {
      const result = await getPool().query(`SELECT * FROM "${collection}" WHERE "id" = $1`, [id]);
      return result.rows[0] ?? null;
    },

    async updateRecord(
      collection: string,
      id: string,
      data: Partial<OryCMSDatabaseRecord>,
    ): Promise<OryCMSDatabaseRecord> {
      const keys = Object.keys(data);
      if (!keys.length)
        throw new Error("OryCMS PostgreSQL: updateRecord requires at least one field");
      const sets = keys.map((k, idx) => `"${k}" = $${idx + 1}`).join(", ");
      const result = await getPool().query(
        `UPDATE "${collection}" SET ${sets} WHERE "id" = $${keys.length + 1} RETURNING *`,
        [...keys.map((k) => data[k]), id],
      );
      if (!result.rows[0])
        throw new Error(`OryCMS PostgreSQL: record "${id}" not found in "${collection}"`);
      return result.rows[0];
    },

    async deleteRecord(collection: string, id: string): Promise<void> {
      await getPool().query(`DELETE FROM "${collection}" WHERE "id" = $1`, [id]);
    },

    async runMigration(migration: OryCMSAdapterMigration): Promise<OryCMSMigrationResult> {
      const start = Date.now();
      try {
        await getPool().query(migration.up);
        return {
          migrationId: migration.id,
          name: migration.name,
          success: true,
          appliedAt: new Date().toISOString(),
          durationMs: Date.now() - start,
        };
      } catch (err) {
        return {
          migrationId: migration.id,
          name: migration.name,
          success: false,
          durationMs: Date.now() - start,
          error: String(err),
        };
      }
    },
  };
}

/** Converts a generateOryCMSCollectionMigrationPlan output into runMigration input. */
export function createMigrationFromCollectionPlan(
  plan: OryCMSCollectionMigrationPlan,
): OryCMSAdapterMigration {
  return {
    id: plan.migrationId,
    name: `${plan.collectionName} (${plan.collectionSlug})`,
    up: plan.operations
      .map((op) => op.upStatement)
      .filter((s): s is string => !!s)
      .join("\n"),
    down: plan.operations
      .filter((op) => op.reversible)
      .map((op) => op.downStatement)
      .filter((s): s is string => !!s)
      .reverse()
      .join("\n"),
  };
}

// Backward-compatible singleton for the registry
export const OryCMSPostgreSQLAdapter: OryCMSDatabaseAdapter = createOryCMSPostgreSQLAdapter();
