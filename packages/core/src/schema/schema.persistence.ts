import type { Pool, PoolClient } from "pg";
import {
  getOryCMSCollection,
  listOryCMSCollections,
  removeOryCMSCollection,
  upsertOryCMSCollectionInRegistry,
} from "./schema.engine";
import { validateOryCMSCollectionSchema } from "./schema.validator";
import { getOryCMSPool } from "@/lib/db";
import type { OryCMSCollectionDefinition, OryCMSSchemaField } from "./collection.schema";
import { buildOryCMSHookContext, runOryCMSBeforeHooks, runOryCMSAfterHooks } from "@/hooks";

export class OryCMSCollectionPersistenceError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly issues?: unknown[];

  constructor(code: string, message: string, statusCode = 500, issues?: unknown[]) {
    super(message);
    this.name = "OryCMSCollectionPersistenceError";
    this.code = code;
    this.statusCode = statusCode;
    this.issues = issues;
  }
}

interface PersistedCollectionRow {
  id: string;
  name: string;
  collectionSlug: string;
  tableName: string | null;
  description: string | null;
  schemaJson: OryCMSCollectionDefinition | string | null;
  isSystem?: boolean | null;
}

interface PersistedFieldRow {
  name: string;
  fieldType: string;
  required: boolean | null;
  unique: boolean | null;
  config: OryCMSSchemaField | string | null;
  order: number | string | null;
}

function parseJson<T>(value: T | string | null | undefined): T | null {
  if (!value) return null;
  if (typeof value === "string") return JSON.parse(value) as T;
  return value;
}

function tableNameFor(definition: OryCMSCollectionDefinition): string {
  return definition.tableName ?? definition.slug.replace(/-/g, "_");
}

function fieldConfig(field: OryCMSSchemaField): Record<string, unknown> {
  return { ...field };
}

function assertValidForPersistence(
  definition: OryCMSCollectionDefinition,
  existingCollections: OryCMSCollectionDefinition[],
  originalSlug?: string,
): void {
  const registeredSlugs = new Set(
    existingCollections
      .map((collection) => collection.slug)
      .filter((slug) => slug !== originalSlug),
  );
  const relationTargets = new Set(existingCollections.map((collection) => collection.slug));
  relationTargets.add(definition.slug);

  const result = validateOryCMSCollectionSchema(definition, {
    registeredSlugs,
    registeredCollectionSlugs: relationTargets,
  });

  if (!result.valid) {
    throw new OryCMSCollectionPersistenceError(
      "SCHEMA_VALIDATION_ERROR",
      "Collection schema is invalid.",
      400,
      result.issues,
    );
  }
}

async function insertFieldRows(
  client: PoolClient,
  collectionId: string,
  fields: OryCMSSchemaField[],
): Promise<void> {
  for (let index = 0; index < fields.length; index++) {
    const field = fields[index];
    await client.query(
      `INSERT INTO orycms_collection_fields
        (id, "collectionId", name, "fieldType", required, "unique", config, "order")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)`,
      [
        collectionId,
        field.name,
        field.type,
        Boolean(field.required),
        Boolean(field.unique),
        fieldConfig(field),
        index,
      ],
    );
  }
}

function rowToCollectionDefinition(
  row: PersistedCollectionRow,
  fields: PersistedFieldRow[],
): OryCMSCollectionDefinition {
  const schemaJson = parseJson<OryCMSCollectionDefinition>(row.schemaJson);
  if (schemaJson) return schemaJson;

  return {
    name: row.name,
    slug: row.collectionSlug,
    labels: { singular: row.name, plural: row.name },
    ...(row.tableName ? { tableName: row.tableName } : {}),
    ...(row.description ? { description: row.description } : {}),
    fields: fields
      .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
      .map((field) => {
        const config = parseJson<OryCMSSchemaField>(field.config);
        if (config) return config;
        return {
          name: field.name,
          type: field.fieldType,
          ...(field.required ? { required: true } : {}),
          ...(field.unique ? { unique: true } : {}),
        } as OryCMSSchemaField;
      }),
  };
}

async function getExistingPersistedCollections(pool: Pool): Promise<OryCMSCollectionDefinition[]> {
  return listOryCMSPersistedCollections(pool);
}

export async function saveOryCMSCollectionSchema(
  definition: OryCMSCollectionDefinition,
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSCollectionDefinition> {
  await runOryCMSBeforeHooks(
    "beforeCollectionCreate",
    buildOryCMSHookContext(
      "beforeCollectionCreate",
      definition.slug,
      definition as unknown as Record<string, unknown>,
      null,
    ),
  );

  const client = await pool.connect();
  let result: OryCMSCollectionDefinition;
  try {
    await client.query("BEGIN");
    const existingCollections = await getExistingPersistedCollections(pool);
    assertValidForPersistence(definition, existingCollections);

    const duplicate = await client.query<{ id: string }>(
      `SELECT id FROM orycms_collections WHERE "collectionSlug" = $1 LIMIT 1`,
      [definition.slug],
    );
    if (duplicate.rows[0]) {
      throw new OryCMSCollectionPersistenceError(
        "DUPLICATE_SLUG",
        `A collection with slug "${definition.slug}" already exists.`,
        409,
      );
    }

    const collectionResult = await client.query<{ id: string }>(
      `INSERT INTO orycms_collections
        (id, name, "collectionSlug", "tableName", description, "schemaJson", "isSystem")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, false)
       RETURNING id`,
      [
        definition.name,
        definition.slug,
        tableNameFor(definition),
        definition.description ?? null,
        definition,
      ],
    );

    await insertFieldRows(client, collectionResult.rows[0].id, definition.fields);
    await client.query("COMMIT");
    upsertOryCMSCollectionInRegistry(
      definition,
      new Set([...listOryCMSCollections().map((collection) => collection.slug), definition.slug]),
    );
    result = definition;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  await runOryCMSAfterHooks(
    "afterCollectionCreate",
    buildOryCMSHookContext(
      "afterCollectionCreate",
      result.slug,
      result as unknown as Record<string, unknown>,
      null,
    ),
  );
  return result;
}

export async function updateOryCMSPersistedCollection(
  slug: string,
  definition: OryCMSCollectionDefinition,
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSCollectionDefinition> {
  const nextDefinition = { ...definition, slug };
  const previous = getOryCMSCollection(slug);

  await runOryCMSBeforeHooks(
    "beforeCollectionUpdate",
    buildOryCMSHookContext(
      "beforeCollectionUpdate",
      slug,
      nextDefinition as unknown as Record<string, unknown>,
      previous as unknown as Record<string, unknown> | null,
    ),
  );

  const client = await pool.connect();
  let result: OryCMSCollectionDefinition;
  try {
    await client.query("BEGIN");
    const existingCollections = await getExistingPersistedCollections(pool);
    assertValidForPersistence(nextDefinition, existingCollections, slug);

    const existing = await client.query<{ id: string }>(
      `SELECT id FROM orycms_collections WHERE "collectionSlug" = $1 LIMIT 1`,
      [slug],
    );
    const collectionId = existing.rows[0]?.id;
    if (!collectionId) {
      throw new OryCMSCollectionPersistenceError(
        "COLLECTION_NOT_FOUND",
        `Collection "${slug}" not found.`,
        404,
      );
    }

    await client.query(
      `UPDATE orycms_collections
       SET name = $1, "tableName" = $2, description = $3, "schemaJson" = $4
       WHERE id = $5`,
      [
        nextDefinition.name,
        tableNameFor(nextDefinition),
        nextDefinition.description ?? null,
        nextDefinition,
        collectionId,
      ],
    );
    await client.query(`DELETE FROM orycms_collection_fields WHERE "collectionId" = $1`, [
      collectionId,
    ]);
    await insertFieldRows(client, collectionId, nextDefinition.fields);
    await client.query("COMMIT");
    upsertOryCMSCollectionInRegistry(
      nextDefinition,
      new Set([...listOryCMSCollections().map((collection) => collection.slug), slug]),
    );
    result = nextDefinition;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  await runOryCMSAfterHooks(
    "afterCollectionUpdate",
    buildOryCMSHookContext(
      "afterCollectionUpdate",
      result.slug,
      result as unknown as Record<string, unknown>,
      previous as unknown as Record<string, unknown> | null,
    ),
  );
  return result;
}

export async function deleteOryCMSPersistedCollection(
  slug: string,
  pool: Pool = getOryCMSPool(),
): Promise<void> {
  const previous = getOryCMSCollection(slug);

  await runOryCMSBeforeHooks(
    "beforeCollectionDelete",
    buildOryCMSHookContext(
      "beforeCollectionDelete",
      slug,
      (previous as unknown as Record<string, unknown>) ?? {},
      null,
    ),
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM orycms_collections WHERE "collectionSlug" = $1 LIMIT 1`,
      [slug],
    );
    const collectionId = existing.rows[0]?.id;
    if (!collectionId) {
      throw new OryCMSCollectionPersistenceError(
        "COLLECTION_NOT_FOUND",
        `Collection "${slug}" not found.`,
        404,
      );
    }

    await client.query(`DELETE FROM orycms_collection_fields WHERE "collectionId" = $1`, [
      collectionId,
    ]);
    await client.query(`DELETE FROM orycms_collections WHERE id = $1`, [collectionId]);
    await client.query("COMMIT");
    if (getOryCMSCollection(slug)) removeOryCMSCollection(slug);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  await runOryCMSAfterHooks(
    "afterCollectionDelete",
    buildOryCMSHookContext(
      "afterCollectionDelete",
      slug,
      (previous as unknown as Record<string, unknown>) ?? {},
      null,
    ),
  );
}

export async function getOryCMSPersistedCollection(
  slug: string,
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSCollectionDefinition | null> {
  const collectionResult = await pool.query<PersistedCollectionRow>(
    `SELECT id, name, "collectionSlug", "tableName", description, "schemaJson", "isSystem"
     FROM orycms_collections
     WHERE "collectionSlug" = $1
     LIMIT 1`,
    [slug],
  );
  const row = collectionResult.rows[0];
  if (!row) return null;

  const fieldsResult = await pool.query<PersistedFieldRow>(
    `SELECT name, "fieldType", required, "unique", config, "order"
     FROM orycms_collection_fields
     WHERE "collectionId" = $1
     ORDER BY "order" ASC`,
    [row.id],
  );

  return rowToCollectionDefinition(row, fieldsResult.rows);
}

export async function listOryCMSPersistedCollections(
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSCollectionDefinition[]> {
  let collectionResult: { rows: PersistedCollectionRow[] };
  try {
    collectionResult = await pool.query<PersistedCollectionRow>(
      `SELECT id, name, "collectionSlug", "tableName", description, "schemaJson", "isSystem"
       FROM orycms_collections
       ORDER BY name ASC`,
    );
  } catch (err: unknown) {
    // 42P01 = undefined_table — schema not yet installed, treat as empty
    if ((err as { code?: string }).code === "42P01") return [];
    throw err;
  }

  const collections: OryCMSCollectionDefinition[] = [];
  for (const row of collectionResult.rows) {
    const fieldsResult = await pool.query<PersistedFieldRow>(
      `SELECT name, "fieldType", required, "unique", config, "order"
       FROM orycms_collection_fields
       WHERE "collectionId" = $1
       ORDER BY "order" ASC`,
      [row.id],
    );
    collections.push(rowToCollectionDefinition(row, fieldsResult.rows));
  }

  return collections;
}

export async function loadOryCMSCollectionsIntoRegistry(
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSCollectionDefinition[]> {
  const persistedCollections = await listOryCMSPersistedCollections(pool);
  const knownSlugs = new Set([
    ...listOryCMSCollections().map((collection) => collection.slug),
    ...persistedCollections.map((collection) => collection.slug),
  ]);

  for (const collection of persistedCollections) {
    upsertOryCMSCollectionInRegistry(collection, knownSlugs);
  }

  return persistedCollections;
}
