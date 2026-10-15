import type { Pool } from "pg";
import type { OryCMSCollectionDefinition } from "@/schema";
import { getOryCMSCollection } from "@/schema";
import type { OryCMSContentData, OryCMSContentEntry, OryCMSContentStatus } from "@/types";
import type { OryCMSDatabaseQueryFilter, OryCMSDatabaseSortOptions } from "@/database";
import { getOryCMSPool } from "@/lib/db";
import { quoteSqlIdentifier } from "@/lib/sql-identifier";
import { OryCMSContentError } from "./content.errors";
import {
  validateOryCMSContentData,
  stripOryCMSPrivateFields,
  validateOryCMSQueryFilter,
  validateOryCMSSortField,
} from "./content.validator";
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

/** Shorthand for quoting a Postgres identifier — this engine only ever targets Postgres. */
function q(name: string): string {
  return quoteSqlIdentifier(name, "postgresql");
}

/**
 * Maps a write failure to a clean, stable error code with no driver detail. A
 * unique-constraint violation (23505) becomes a 409; a foreign-key violation
 * (23503) becomes a 422. Anything else is rethrown as-is, for the caller's own
 * generic-error handling to redact and log.
 */
function mapWriteError(err: unknown): never {
  const code = (err as { code?: string } | null)?.code;
  if (code === "23505") {
    throw new OryCMSContentError(
      "DUPLICATE_VALUE",
      "A value in this entry conflicts with an existing one.",
      409,
    );
  }
  if (code === "23503") {
    throw new OryCMSContentError(
      "INVALID_REFERENCE",
      "This entry references something that does not exist.",
      422,
    );
  }
  throw err;
}

/** Map adapter filter operator → SQL fragment. Returns [clause, value]. */
function filterToSQL(
  f: OryCMSDatabaseQueryFilter,
  idx: number,
): { clause: string; value: unknown } {
  const col = q(f.field);
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
      // Unreachable once callers validate against VALID_QUERY_OPERATORS first —
      // fail loudly instead of silently treating an unknown operator as "eq".
      throw new OryCMSContentError(
        "OPERATOR_INVALID",
        `Unsupported filter operator "${f.operator}".`,
        400,
        f.field,
      );
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

  // Reject any filter/sort field that isn't a real column on this collection,
  // and any operator/direction outside the fixed allowlist, before building SQL.
  for (const f of filters) validateOryCMSQueryFilter(col, f);
  for (const s of sort) validateOryCMSSortField(col, s);

  const values: unknown[] = [];
  const whereParts: string[] = [];
  let idx = 1;

  // Draft filter
  if (col.draft?.enabled && !includeDrafts) {
    whereParts.push(`${q("_isDraft")} = $${idx++}`);
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
      ? `ORDER BY ${sort.map((s) => `${q(s.field)} ${s.direction.toUpperCase()}`).join(", ")}`
      : `ORDER BY ${q("createdAt")} DESC`;

  // COUNT
  const countRes = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM ${q(table)} ${where}`,
    values,
  );
  const total = parseInt(countRes.rows[0].count, 10);

  // DATA
  const offset = (page - 1) * limit;
  values.push(limit, offset);
  const dataRes = await pool.query(
    `SELECT * FROM ${q(table)} ${where} ${orderBy} LIMIT $${idx} OFFSET $${idx + 1}`,
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

  const res = await pool.query(`SELECT * FROM ${q(table)} WHERE ${q("id")} = $1 LIMIT 1`, [id]);
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
  const cols: string[] = Object.keys(fieldData).map((k) => q(k));
  const placeholders: string[] = Object.keys(fieldData).map((_, i) => `$${i + 1}`);
  const vals: unknown[] = Object.values(fieldData);
  let i = vals.length + 1;

  if (hasDraft) {
    cols.push(q("_isDraft"));
    placeholders.push(`$${i++}`);
    vals.push(isDraft);
  }

  let res;
  try {
    res = await pool.query(
      `INSERT INTO ${q(table)} (${cols.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
      vals,
    );
  } catch (err) {
    mapWriteError(err);
  }
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

  const sets = keys.map((k, i) => `${q(k)} = $${i + 1}`).join(", ");
  const vals = [...Object.values(beforeCtx.data), id];
  const idIdx = vals.length;

  let res;
  try {
    res = await pool.query(
      `UPDATE ${q(table)} SET ${sets}, ${q("updatedAt")} = NOW() WHERE ${q("id")} = $${idIdx} RETURNING *`,
      vals,
    );
  } catch (err) {
    mapWriteError(err);
  }
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
  await pool.query(`DELETE FROM ${q(table)} WHERE ${q("id")} = $1`, [id]);

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
  // The WHERE clause repeats the draft check so the transition itself is atomic —
  // two concurrent publish calls can't both see "not yet published" and both write;
  // only one UPDATE can match a row still in draft state.
  const res = await pool.query(
    `UPDATE ${q(table)} SET ${q("_isDraft")} = false, ${q("_publishedAt")} = NOW(), ${q("updatedAt")} = NOW() WHERE ${q("id")} = $1 AND ${q("_isDraft")} = true RETURNING *`,
    [id],
  );
  if (!res.rows[0]) {
    // Lost the race, or the entry was deleted between the read above and this write.
    const recheck = await pool.query(`SELECT ${q("id")} FROM ${q(table)} WHERE ${q("id")} = $1`, [
      id,
    ]);
    if (!recheck.rows[0]) {
      throw new OryCMSContentError("ENTRY_NOT_FOUND", `Entry "${id}" not found.`, 404);
    }
    throw new OryCMSContentError("ALREADY_PUBLISHED", `Entry "${id}" is already published.`, 409);
  }
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
  // Same atomic guard as publish: the WHERE clause repeats the published check so a
  // concurrent unpublish can't race past it.
  const res = await pool.query(
    `UPDATE ${q(table)} SET ${q("_isDraft")} = true, ${q("updatedAt")} = NOW() WHERE ${q("id")} = $1 AND ${q("_isDraft")} = false RETURNING *`,
    [id],
  );
  if (!res.rows[0]) {
    const recheck = await pool.query(`SELECT ${q("id")} FROM ${q(table)} WHERE ${q("id")} = $1`, [
      id,
    ]);
    if (!recheck.rows[0]) {
      throw new OryCMSContentError("ENTRY_NOT_FOUND", `Entry "${id}" not found.`, 404);
    }
    throw new OryCMSContentError("NOT_PUBLISHED", `Entry "${id}" is not published.`, 409);
  }
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
