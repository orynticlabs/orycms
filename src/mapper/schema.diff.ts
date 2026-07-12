import type { Pool } from "pg";
import type { OryCMSCollectionDefinition } from "@/schema";
import { getOryCMSPool } from "@/lib/db";
import { mapOryCMSCollectionToDatabaseSchema } from "./collection.mapper";
import { generateOryCMSCollectionMigrationPlan } from "./migration.planner";
import type {
  OryCMSMappedDatabaseField,
  OryCMSMappedDatabaseIndex,
  OryCMSMappedDatabaseSchema,
  OryCMSMappedFieldReference,
  OryCMSMigrationOperation,
} from "./mapper.types";

export type OryCMSSchemaDiffOperationType =
  | "CREATE_COLLECTION"
  | "CREATE_JUNCTION_TABLE"
  | "ADD_FIELD"
  | "REMOVE_FIELD"
  | "RENAME_FIELD"
  | "CHANGE_FIELD_TYPE"
  | "SET_FIELD_REQUIRED"
  | "SET_FIELD_OPTIONAL"
  | "ADD_UNIQUE_CONSTRAINT"
  | "DROP_UNIQUE_CONSTRAINT"
  | "ADD_INDEX"
  | "DROP_INDEX"
  | "ADD_FOREIGN_KEY"
  | "DROP_FOREIGN_KEY"
  | "CHANGE_FOREIGN_KEY"
  | "ENABLE_DRAFTS"
  | "DISABLE_DRAFTS"
  | "ENABLE_TIMESTAMPS"
  | "DISABLE_TIMESTAMPS"
  | "ENABLE_SEO"
  | "DISABLE_SEO";

export interface OryCMSSchemaDiffOperation {
  type: OryCMSSchemaDiffOperationType;
  target: string;
  fieldName?: string;
  from?: unknown;
  to?: unknown;
  upStatement?: string;
  downStatement?: string;
  destructive: boolean;
  unsafe: boolean;
  warnings: string[];
}

export interface OryCMSActualPostgreSQLField {
  name: string;
  nativeType: string;
  nullable: boolean;
  defaultValue?: string | null;
}

export interface OryCMSActualPostgreSQLIndex {
  name: string;
  fields: string[];
  unique: boolean;
}

export interface OryCMSActualPostgreSQLForeignKey {
  name: string;
  field: string;
  targetTable: string;
  targetColumn: string;
  onDelete?: string;
}

export interface OryCMSActualPostgreSQLSchema {
  tableName: string;
  exists: boolean;
  fields: OryCMSActualPostgreSQLField[];
  indexes: OryCMSActualPostgreSQLIndex[];
  foreignKeys: OryCMSActualPostgreSQLForeignKey[];
}

export interface OryCMSMigrationSafetyResult {
  safe: boolean;
  blocked: OryCMSSchemaDiffOperation[];
  warnings: string[];
}

export interface OryCMSMigrationPreview {
  collectionSlug: string;
  tableName: string;
  operations: OryCMSSchemaDiffOperation[];
  safety: OryCMSMigrationSafetyResult;
}

function q(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function normaliseType(type: string): string {
  return type
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace("timestamp with time zone", "timestamptz")
    .replace("timestamp without time zone", "timestamp")
    .replace("character varying", "varchar")
    .replace("boolean", "bool")
    .replace("numeric", "decimal")
    .trim();
}

function typeMatches(expected: string, actual: string): boolean {
  const left = normaliseType(expected);
  const right = normaliseType(actual);
  if (left === right) return true;
  if (left.startsWith("varchar") && right.startsWith("varchar")) return true;
  if (left === "uuid" && right === "uuid") return true;
  if (left === "jsonb" && right === "jsonb") return true;
  if (left === "bool" && right === "bool") return true;
  return false;
}

function fieldMap<T extends { name: string }>(fields: T[]): Map<string, T> {
  return new Map(fields.map((field) => [field.name, field]));
}

function indexKey(index: Pick<OryCMSMappedDatabaseIndex, "fields" | "unique">): string {
  return `${index.unique ? "unique" : "index"}:${index.fields.join(",")}`;
}

function actualIndexKey(index: OryCMSActualPostgreSQLIndex): string {
  return `${index.unique ? "unique" : "index"}:${index.fields.join(",")}`;
}

function referenceKey(reference?: OryCMSMappedFieldReference): string {
  if (!reference) return "";
  return `${reference.table}.${reference.column}.${reference.onDelete ?? "SET NULL"}`;
}

function systemFieldGroup(name: string): "draft" | "timestamps" | "seo" | null {
  if (name === "_isDraft" || name === "_publishedAt") return "draft";
  if (name === "createdAt" || name === "updatedAt") return "timestamps";
  if (name === "_seoTitle" || name === "_seoDescription" || name === "_seoImage") return "seo";
  return null;
}

function addFieldOperation(
  tableName: string,
  field: OryCMSMappedDatabaseField,
): OryCMSSchemaDiffOperation {
  const nullable = field.nullable ? "" : " NOT NULL";
  const defaultValue = field.defaultValue ? ` DEFAULT ${field.defaultValue}` : "";
  return {
    type: "ADD_FIELD",
    target: tableName,
    fieldName: field.name,
    to: field,
    upStatement: `ALTER TABLE ${q(tableName)} ADD COLUMN ${q(field.name)} ${field.nativeType}${nullable}${defaultValue};`,
    downStatement: `ALTER TABLE ${q(tableName)} DROP COLUMN ${q(field.name)};`,
    destructive: false,
    unsafe: false,
    warnings: [],
  };
}

function removeFieldOperation(
  tableName: string,
  field: OryCMSActualPostgreSQLField,
): OryCMSSchemaDiffOperation {
  return {
    type: "REMOVE_FIELD",
    target: tableName,
    fieldName: field.name,
    from: field,
    upStatement: `ALTER TABLE ${q(tableName)} DROP COLUMN ${q(field.name)};`,
    destructive: true,
    unsafe: false,
    warnings: [`Dropping "${field.name}" removes stored data.`],
  };
}

function createSystemOperation(
  type: OryCMSSchemaDiffOperationType,
  tableName: string,
  fieldName: string,
  destructive: boolean,
): OryCMSSchemaDiffOperation {
  return {
    type,
    target: tableName,
    fieldName,
    destructive,
    unsafe: false,
    warnings: destructive ? [`${type} may remove existing system metadata.`] : [],
  };
}

function mappedForeignKeys(
  schema: OryCMSMappedDatabaseSchema,
): Map<string, OryCMSMappedFieldReference> {
  const refs = new Map<string, OryCMSMappedFieldReference>();
  for (const field of schema.fields) {
    if (field.references) refs.set(field.name, field.references);
  }
  return refs;
}

export async function introspectOryCMSPostgreSQLTable(
  tableName: string,
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSActualPostgreSQLSchema> {
  const table = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = current_schema() AND table_name = $1
     ) AS exists`,
    [tableName],
  );
  const exists = Boolean(table.rows[0]?.exists);
  if (!exists) return { tableName, exists: false, fields: [], indexes: [], foreignKeys: [] };

  const fields = await pool.query<OryCMSActualPostgreSQLField>(
    `SELECT
       a.attname AS name,
       pg_catalog.format_type(a.atttypid, a.atttypmod) AS "nativeType",
       NOT a.attnotnull AS nullable,
       pg_get_expr(d.adbin, d.adrelid) AS "defaultValue"
     FROM pg_attribute a
     JOIN pg_class c ON c.oid = a.attrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
     WHERE n.nspname = current_schema()
       AND c.relname = $1
       AND a.attnum > 0
       AND NOT a.attisdropped
     ORDER BY a.attnum`,
    [tableName],
  );

  const indexes = await pool.query<OryCMSActualPostgreSQLIndex>(
    `SELECT
       i.relname AS name,
       ix.indisunique AS unique,
       array_agg(a.attname ORDER BY array_position(ix.indkey::int[], a.attnum)) AS fields
     FROM pg_index ix
     JOIN pg_class t ON t.oid = ix.indrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     JOIN pg_class i ON i.oid = ix.indexrelid
     JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
     WHERE n.nspname = current_schema()
       AND t.relname = $1
       AND NOT ix.indisprimary
     GROUP BY i.relname, ix.indisunique`,
    [tableName],
  );

  const foreignKeys = await pool.query<OryCMSActualPostgreSQLForeignKey>(
    `SELECT
       tc.constraint_name AS name,
       kcu.column_name AS field,
       ccu.table_name AS "targetTable",
       ccu.column_name AS "targetColumn",
       rc.delete_rule AS "onDelete"
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
     JOIN information_schema.referential_constraints rc
       ON rc.constraint_name = tc.constraint_name
      AND rc.constraint_schema = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema = current_schema()
       AND tc.table_name = $1`,
    [tableName],
  );

  return {
    tableName,
    exists,
    fields: fields.rows,
    indexes: indexes.rows,
    foreignKeys: foreignKeys.rows,
  };
}

export function compareOryCMSCollectionSchema(
  expectedSchema: OryCMSMappedDatabaseSchema,
  actualSchema: OryCMSActualPostgreSQLSchema,
): OryCMSSchemaDiffOperation[] {
  if (!actualSchema.exists) {
    return [
      {
        type: "CREATE_COLLECTION",
        target: expectedSchema.tableName,
        to: expectedSchema,
        destructive: false,
        unsafe: false,
        warnings: [],
      },
    ];
  }

  const operations: OryCMSSchemaDiffOperation[] = [];
  const actualFields = fieldMap(actualSchema.fields);
  const expectedFields = fieldMap(expectedSchema.fields);

  const missingExpected = expectedSchema.fields.filter((field) => !actualFields.has(field.name));
  const extraActual = actualSchema.fields.filter((field) => !expectedFields.has(field.name));
  const renameCandidates = new Set<string>();

  for (const expected of missingExpected) {
    const candidate = extraActual.find(
      (actual) =>
        !renameCandidates.has(actual.name) && typeMatches(expected.nativeType, actual.nativeType),
    );
    const group = systemFieldGroup(expected.name);
    if (candidate && !group) {
      renameCandidates.add(candidate.name);
      operations.push({
        type: "RENAME_FIELD",
        target: expectedSchema.tableName,
        fieldName: expected.name,
        from: candidate.name,
        to: expected.name,
        upStatement: `ALTER TABLE ${q(expectedSchema.tableName)} RENAME COLUMN ${q(candidate.name)} TO ${q(expected.name)};`,
        downStatement: `ALTER TABLE ${q(expectedSchema.tableName)} RENAME COLUMN ${q(expected.name)} TO ${q(candidate.name)};`,
        destructive: false,
        unsafe: false,
        warnings: [
          `Review detected rename "${candidate.name}" -> "${expected.name}" before applying.`,
        ],
      });
      continue;
    }

    operations.push(addFieldOperation(expectedSchema.tableName, expected));
    if (group === "draft")
      operations.push(
        createSystemOperation("ENABLE_DRAFTS", expectedSchema.tableName, expected.name, false),
      );
    if (group === "timestamps")
      operations.push(
        createSystemOperation("ENABLE_TIMESTAMPS", expectedSchema.tableName, expected.name, false),
      );
    if (group === "seo")
      operations.push(
        createSystemOperation("ENABLE_SEO", expectedSchema.tableName, expected.name, false),
      );
  }

  for (const actual of extraActual) {
    if (renameCandidates.has(actual.name)) continue;
    operations.push(removeFieldOperation(expectedSchema.tableName, actual));
    const group = systemFieldGroup(actual.name);
    if (group === "draft")
      operations.push(
        createSystemOperation("DISABLE_DRAFTS", expectedSchema.tableName, actual.name, true),
      );
    if (group === "timestamps")
      operations.push(
        createSystemOperation("DISABLE_TIMESTAMPS", expectedSchema.tableName, actual.name, true),
      );
    if (group === "seo")
      operations.push(
        createSystemOperation("DISABLE_SEO", expectedSchema.tableName, actual.name, true),
      );
  }

  for (const expected of expectedSchema.fields) {
    const actual = actualFields.get(expected.name);
    if (!actual) continue;

    if (!typeMatches(expected.nativeType, actual.nativeType)) {
      operations.push({
        type: "CHANGE_FIELD_TYPE",
        target: expectedSchema.tableName,
        fieldName: expected.name,
        from: actual.nativeType,
        to: expected.nativeType,
        upStatement: `ALTER TABLE ${q(expectedSchema.tableName)} ALTER COLUMN ${q(expected.name)} TYPE ${expected.nativeType};`,
        destructive: true,
        unsafe: true,
        warnings: [`Unsafe type change for "${expected.name}" is blocked.`],
      });
    }

    if (!expected.nullable && actual.nullable) {
      operations.push({
        type: "SET_FIELD_REQUIRED",
        target: expectedSchema.tableName,
        fieldName: expected.name,
        from: "nullable",
        to: "not null",
        upStatement: `ALTER TABLE ${q(expectedSchema.tableName)} ALTER COLUMN ${q(expected.name)} SET NOT NULL;`,
        downStatement: `ALTER TABLE ${q(expectedSchema.tableName)} ALTER COLUMN ${q(expected.name)} DROP NOT NULL;`,
        destructive: false,
        unsafe: false,
        warnings: [`Ensure "${expected.name}" has no NULL values before setting required.`],
      });
    }

    if (expected.nullable && !actual.nullable && !expected.primaryKey) {
      operations.push({
        type: "SET_FIELD_OPTIONAL",
        target: expectedSchema.tableName,
        fieldName: expected.name,
        from: "not null",
        to: "nullable",
        upStatement: `ALTER TABLE ${q(expectedSchema.tableName)} ALTER COLUMN ${q(expected.name)} DROP NOT NULL;`,
        downStatement: `ALTER TABLE ${q(expectedSchema.tableName)} ALTER COLUMN ${q(expected.name)} SET NOT NULL;`,
        destructive: false,
        unsafe: false,
        warnings: [],
      });
    }
  }

  const expectedIndexKeys = new Map(
    expectedSchema.indexes.map((index) => [indexKey(index), index]),
  );
  const actualIndexKeys = new Map(
    actualSchema.indexes.map((index) => [actualIndexKey(index), index]),
  );

  for (const [key, index] of expectedIndexKeys) {
    if (actualIndexKeys.has(key)) continue;
    operations.push({
      type: index.unique ? "ADD_UNIQUE_CONSTRAINT" : "ADD_INDEX",
      target: expectedSchema.tableName,
      to: index,
      upStatement: `CREATE ${index.unique ? "UNIQUE " : ""}INDEX IF NOT EXISTS ${q(index.name)} ON ${q(expectedSchema.tableName)} (${index.fields.map(q).join(", ")});`,
      downStatement: `DROP INDEX IF EXISTS ${q(index.name)};`,
      destructive: false,
      unsafe: false,
      warnings: [],
    });
  }

  for (const [key, index] of actualIndexKeys) {
    if (expectedIndexKeys.has(key)) continue;
    operations.push({
      type: index.unique ? "DROP_UNIQUE_CONSTRAINT" : "DROP_INDEX",
      target: expectedSchema.tableName,
      from: index,
      upStatement: `DROP INDEX IF EXISTS ${q(index.name)};`,
      destructive: index.unique,
      unsafe: false,
      warnings: index.unique
        ? [`Dropping unique index "${index.name}" can allow duplicate data.`]
        : [],
    });
  }

  const expectedRefs = mappedForeignKeys(expectedSchema);
  const actualRefs = new Map(actualSchema.foreignKeys.map((fk) => [fk.field, fk]));

  for (const [field, ref] of expectedRefs) {
    const actual = actualRefs.get(field);
    if (!actual) {
      operations.push({
        type: "ADD_FOREIGN_KEY",
        target: expectedSchema.tableName,
        fieldName: field,
        to: ref,
        destructive: false,
        unsafe: false,
        warnings: [],
      });
    } else if (
      referenceKey(ref) !==
      referenceKey({
        table: actual.targetTable,
        column: actual.targetColumn,
        onDelete: actual.onDelete as OryCMSMappedFieldReference["onDelete"],
      })
    ) {
      operations.push({
        type: "CHANGE_FOREIGN_KEY",
        target: expectedSchema.tableName,
        fieldName: field,
        from: actual,
        to: ref,
        destructive: true,
        unsafe: false,
        warnings: [`Changing relation "${field}" drops and recreates a foreign key.`],
      });
    }
  }

  for (const [field, actual] of actualRefs) {
    if (expectedRefs.has(field)) continue;
    operations.push({
      type: "DROP_FOREIGN_KEY",
      target: expectedSchema.tableName,
      fieldName: field,
      from: actual,
      destructive: true,
      unsafe: false,
      warnings: [`Dropping relation "${field}" removes referential protection.`],
    });
  }

  return operations;
}

export async function generateOryCMSSchemaDiff(
  collection: OryCMSCollectionDefinition,
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSSchemaDiffOperation[]> {
  const expectedSchema = mapOryCMSCollectionToDatabaseSchema(collection, "postgresql");
  const actualSchema = await introspectOryCMSPostgreSQLTable(expectedSchema.tableName, pool);
  if (!actualSchema.exists) {
    return generateOryCMSCollectionMigrationPlan(collection, "postgresql").operations.map(
      (operation: OryCMSMigrationOperation) => ({
        type: operation.type as OryCMSSchemaDiffOperationType,
        target: operation.target,
        fieldName: operation.field?.name,
        to: operation.field ?? operation.index ?? operation.junction,
        upStatement: operation.upStatement,
        downStatement: operation.downStatement,
        destructive: false,
        unsafe: false,
        warnings: [],
      }),
    );
  }
  return compareOryCMSCollectionSchema(expectedSchema, actualSchema);
}

export function validateOryCMSMigrationSafety(
  operations: OryCMSSchemaDiffOperation[],
): OryCMSMigrationSafetyResult {
  return {
    safe: operations.every((operation) => !operation.unsafe),
    blocked: operations.filter((operation) => operation.unsafe),
    warnings: operations.flatMap((operation) => operation.warnings),
  };
}

export async function generateOryCMSMigrationPreview(
  collection: OryCMSCollectionDefinition,
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSMigrationPreview> {
  const expectedSchema = mapOryCMSCollectionToDatabaseSchema(collection, "postgresql");
  const operations = await generateOryCMSSchemaDiff(collection, pool);
  return {
    collectionSlug: collection.slug,
    tableName: expectedSchema.tableName,
    operations,
    safety: validateOryCMSMigrationSafety(operations),
  };
}
