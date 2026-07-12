import type { Pool } from "pg";
import type { OryCMSCollectionDefinition } from "@/schema";
import { getOryCMSCollection } from "@/schema";
import type { OryCMSContentData, OryCMSContentEntry, OryCMSContentStatus } from "@/types";
import type { OryCMSDatabaseQueryFilter, OryCMSDatabaseSortOptions } from "@/database";
import { getOryCMSPool } from "@/lib/db";
import { OryCMSContentError } from "./content.errors";
import { validateOryCMSContentData, stripOryCMSPrivateFields } from "./content.validator";
import { buildOryCMSHookContext, runOryCMSBeforeHooks, runOryCMSAfterHooks } from "@/hooks";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface OryCMSListOptions {
  filters?: OryCMSDatabaseQueryFilter[];
  sort?: OryCMSDatabaseSortOptions[];
  page?: number;
  limit?: number;
  includeDrafts?: boolean;
  locale?: string;
}

export interface OryCMSListResult {
  data: OryCMSContentEntry[];
  meta: { total: number; page: number; limit: number; hasMore: boolean };
}

export interface OryCMSCreateInput {
  data: OryCMSContentData;
  locale?: string;
  asDraft?: boolean;
}

export interface OryCMSUpdateInput {
  data: Partial<OryCMSContentData>;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function resolveCollection(slug: string): OryCMSCollectionDefinition {
  const col = getOryCMSCollection(slug);
  if (!col) {
    throw new OryCMSContentError(
      "COLLECTION_NOT_FOUND",
      `Collection "${slug}" is not registered.`,
      404,
    );
  }
  return col;
}

function deriveTable(col: OryCMSCollectionDefinition): string {
  return col.tableName ?? col.slug.replace(/-/g, "_");
}

/** Map adapter filter operator → SQL fragment. Returns [clause, value]. */
function filterToSQL(
  f: OryCMSDatabaseQueryFilter,
  idx: number,
): { clause: string; value: unknown } {
  const col = `"${f.field}"`;
  switch (f.operator) {
    case "eq":
      return { clause: `${col} = $${idx}`, value: f.value };
    case "ne":
      return { clause: `${col} != $${idx}`, value: f.value };
    case "gt":
      return { clause: `${col} > $${idx}`, value: f.value };
    case "gte":
      return { clause: `${col} >= $${idx}`, value: f.value };
    case "lt":
      return { clause: `${col} < $${idx}`, value: f.value };
    case "lte":
      return { clause: `${col} <= $${idx}`, value: f.value };
    case "in":
      return { clause: `${col} = ANY($${idx})`, value: f.value };
    case "nin":
      return { clause: `NOT (${col} = ANY($${idx}))`, value: f.value };
    case "contains":
      return { clause: `${col} ILIKE $${idx}`, value: `%${f.value}%` };
    case "startsWith":
      return { clause: `${col} ILIKE $${idx}`, value: `${f.value}%` };
    case "endsWith":
      return { clause: `${col} ILIKE $${idx}`, value: `%${f.value}` };
    default:
      return { clause: `${col} = $${idx}`, value: f.value };
  }
}

/**
 * Converts a raw DB row into OryCMSContentEntry, stripping private fields.
 */
function rowToEntry(
  col: OryCMSCollectionDefinition,
  row: Record<string, unknown>,
): OryCMSContentEntry {
  const { id, createdAt, updatedAt, _isDraft, _publishedAt, ...rest } = row;

  const rawData = stripOryCMSPrivateFields(col, rest as OryCMSContentData);

  const hasDraft = col.draft?.enabled;
  const status: OryCMSContentStatus = hasDraft ? (_isDraft ? "draft" : "published") : "published";

  return {
    id: String(id),
    collectionSlug: col.slug,
    status,
    locale: "default",
    data: rawData,
    publishedAt: _publishedAt ? String(_publishedAt) : undefined,
    timestamps: {
      createdAt: String(createdAt),
      updatedAt: String(updatedAt),
    },
  };
}

// ── Engine functions ───────────────────────────────────────────────────────────

export async function listOryCMSContentEntries(
  collectionSlug: string,
  options: OryCMSListOptions = {},
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSListResult> {
  const col = resolveCollection(collectionSlug);
  const table = deriveTable(col);
  const { filters = [], sort = [], page = 1, limit = 50, includeDrafts = false } = options;

  const values: unknown[] = [];
  const whereParts: string[] = [];
  let idx = 1;

  // Draft filter
  if (col.draft?.enabled && !includeDrafts) {
    whereParts.push(`"_isDraft" = $${idx++}`);
    values.push(false);
  }

  for (const f of filters) {
    const { clause, value } = filterToSQL(f, idx++);
    whereParts.push(clause);
    values.push(value);
  }

  const where = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

  const orderBy =
    sort.length > 0
      ? `ORDER BY ${sort.map((s) => `"${s.field}" ${s.direction.toUpperCase()}`).join(", ")}`
      : `ORDER BY "createdAt" DESC`;

  // COUNT
  const countRes = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM "${table}" ${where}`,
    values,
  );
  const total = parseInt(countRes.rows[0].count, 10);

  // DATA
  const offset = (page - 1) * limit;
  values.push(limit, offset);
  const dataRes = await pool.query(
    `SELECT * FROM "${table}" ${where} ${orderBy} LIMIT $${idx} OFFSET $${idx + 1}`,
    values,
  );

  return {
    data: dataRes.rows.map((r) => rowToEntry(col, r as Record<string, unknown>)),
    meta: { total, page, limit, hasMore: offset + dataRes.rows.length < total },
  };
}

export async function getOryCMSContentEntry(
  collectionSlug: string,
  id: string,
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSContentEntry> {
  const col = resolveCollection(collectionSlug);
  const table = deriveTable(col);

  const res = await pool.query(`SELECT * FROM "${table}" WHERE "id" = $1 LIMIT 1`, [id]);
  if (!res.rows[0]) {
    throw new OryCMSContentError("ENTRY_NOT_FOUND", `Entry "${id}" not found.`, 404);
  }
  return rowToEntry(col, res.rows[0] as Record<string, unknown>);
}

export async function createOryCMSContentEntry(
  collectionSlug: string,
  input: OryCMSCreateInput,
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSContentEntry> {
  const col = resolveCollection(collectionSlug);
  validateOryCMSContentData(col, input.data, true);

  const mutableData: Record<string, unknown> = { ...input.data };
  const beforeCtx = buildOryCMSHookContext("beforeCreate", collectionSlug, mutableData, null);
  await runOryCMSBeforeHooks("beforeCreate", beforeCtx);

  const table = deriveTable(col);
  const hasDraft = col.draft?.enabled;
  const isDraft = input.asDraft !== false || hasDraft;

  const fieldData = { ...beforeCtx.data };
  const cols: string[] = Object.keys(fieldData).map((k) => `"${k}"`);
  const placeholders: string[] = Object.keys(fieldData).map((_, i) => `$${i + 1}`);
  const vals: unknown[] = Object.values(fieldData);
  let i = vals.length + 1;

  if (hasDraft) {
    cols.push(`"_isDraft"`);
    placeholders.push(`$${i++}`);
    vals.push(isDraft);
  }

  const res = await pool.query(
    `INSERT INTO "${table}" (${cols.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
    vals,
  );
  const entry = rowToEntry(col, res.rows[0] as Record<string, unknown>);

  try {
    await runOryCMSAfterHooks(
      "afterCreate",
      buildOryCMSHookContext(
        "afterCreate",
        collectionSlug,
        entry as unknown as Record<string, unknown>,
        null,
      ),
    );
  } catch (err) {
    console.error("[OryCMS] afterCreate hook failed:", err);
  }
  return entry;
}

export async function updateOryCMSContentEntry(
  collectionSlug: string,
  id: string,
  input: OryCMSUpdateInput,
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSContentEntry> {
  const col = resolveCollection(collectionSlug);
  validateOryCMSContentData(col, input.data, false);

  const previous = await getOryCMSContentEntry(collectionSlug, id, pool);

  const mutableData: Record<string, unknown> = { ...input.data };
  const beforeCtx = buildOryCMSHookContext(
    "beforeUpdate",
    collectionSlug,
    mutableData,
    previous as unknown as Record<string, unknown>,
  );
  await runOryCMSBeforeHooks("beforeUpdate", beforeCtx);

  const table = deriveTable(col);
  const keys = Object.keys(beforeCtx.data);
  if (keys.length === 0) {
    throw new OryCMSContentError("FIELD_REQUIRED", "At least one field must be provided.", 422);
  }

  const sets = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
  const vals = [...Object.values(beforeCtx.data), id];
  const idIdx = vals.length;

  const res = await pool.query(
    `UPDATE "${table}" SET ${sets}, "updatedAt" = NOW() WHERE "id" = $${idIdx} RETURNING *`,
    vals,
  );
  const entry = rowToEntry(col, res.rows[0] as Record<string, unknown>);

  try {
    await runOryCMSAfterHooks(
      "afterUpdate",
      buildOryCMSHookContext(
        "afterUpdate",
        collectionSlug,
        entry as unknown as Record<string, unknown>,
        previous as unknown as Record<string, unknown>,
      ),
    );
  } catch (err) {
    console.error("[OryCMS] afterUpdate hook failed:", err);
  }
  return entry;
}

export async function deleteOryCMSContentEntry(
  collectionSlug: string,
  id: string,
  pool: Pool = getOryCMSPool(),
): Promise<void> {
  const col = resolveCollection(collectionSlug);
  const entry = await getOryCMSContentEntry(collectionSlug, id, pool);

  await runOryCMSBeforeHooks(
    "beforeDelete",
    buildOryCMSHookContext(
      "beforeDelete",
      collectionSlug,
      entry as unknown as Record<string, unknown>,
      null,
    ),
  );

  const table = deriveTable(col);
  await pool.query(`DELETE FROM "${table}" WHERE "id" = $1`, [id]);

  try {
    await runOryCMSAfterHooks(
      "afterDelete",
      buildOryCMSHookContext(
        "afterDelete",
        collectionSlug,
        entry as unknown as Record<string, unknown>,
        null,
      ),
    );
  } catch (err) {
    console.error("[OryCMS] afterDelete hook failed:", err);
  }
}

export async function publishOryCMSContentEntry(
  collectionSlug: string,
  id: string,
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSContentEntry> {
  const col = resolveCollection(collectionSlug);
  const entry = await getOryCMSContentEntry(collectionSlug, id, pool);

  if (entry.status === "published") {
    throw new OryCMSContentError("ALREADY_PUBLISHED", `Entry "${id}" is already published.`, 409);
  }

  if (!col.draft?.enabled) {
    throw new OryCMSContentError(
      "WRITE_FORBIDDEN",
      `Collection "${collectionSlug}" does not use draft/publish workflow.`,
      422,
    );
  }

  await runOryCMSBeforeHooks(
    "beforePublish",
    buildOryCMSHookContext(
      "beforePublish",
      collectionSlug,
      entry as unknown as Record<string, unknown>,
      null,
    ),
  );

  const table = deriveTable(col);
  const res = await pool.query(
    `UPDATE "${table}" SET "_isDraft" = false, "_publishedAt" = NOW(), "updatedAt" = NOW() WHERE "id" = $1 RETURNING *`,
    [id],
  );
  const published = rowToEntry(col, res.rows[0] as Record<string, unknown>);

  try {
    await runOryCMSAfterHooks(
      "afterPublish",
      buildOryCMSHookContext(
        "afterPublish",
        collectionSlug,
        published as unknown as Record<string, unknown>,
        entry as unknown as Record<string, unknown>,
      ),
    );
  } catch (err) {
    console.error("[OryCMS] afterPublish hook failed:", err);
  }
  return published;
}

export async function unpublishOryCMSContentEntry(
  collectionSlug: string,
  id: string,
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSContentEntry> {
  const col = resolveCollection(collectionSlug);
  const entry = await getOryCMSContentEntry(collectionSlug, id, pool);

  if (entry.status !== "published") {
    throw new OryCMSContentError("NOT_PUBLISHED", `Entry "${id}" is not published.`, 409);
  }

  if (!col.draft?.enabled) {
    throw new OryCMSContentError(
      "WRITE_FORBIDDEN",
      `Collection "${collectionSlug}" does not use draft/publish workflow.`,
      422,
    );
  }

  await runOryCMSBeforeHooks(
    "beforeUnpublish",
    buildOryCMSHookContext(
      "beforeUnpublish",
      collectionSlug,
      entry as unknown as Record<string, unknown>,
      null,
    ),
  );

  const table = deriveTable(col);
  const res = await pool.query(
    `UPDATE "${table}" SET "_isDraft" = true, "updatedAt" = NOW() WHERE "id" = $1 RETURNING *`,
    [id],
  );
  const unpublished = rowToEntry(col, res.rows[0] as Record<string, unknown>);

  try {
    await runOryCMSAfterHooks(
      "afterUnpublish",
      buildOryCMSHookContext(
        "afterUnpublish",
        collectionSlug,
        unpublished as unknown as Record<string, unknown>,
        entry as unknown as Record<string, unknown>,
      ),
    );
  } catch (err) {
    console.error("[OryCMS] afterUnpublish hook failed:", err);
  }
  return unpublished;
}
