import type { OryCMSCollectionDefinition } from "@/schema/collection.schema";
import type { OryCMSDatabaseAdapterType } from "@/database/adapter.types";
import type {
  OryCMSMappedDatabaseField,
  OryCMSMappedDatabaseIndex,
  OryCMSMappedDatabaseSchema,
} from "./mapper.types";
import { mapOryCMSFieldToDatabaseField } from "./field.mapper";

// ─────────────────────────────────────────────────────────────────────────────
// System field builders
// ─────────────────────────────────────────────────────────────────────────────

function makePrimaryKeyField(adapterType: OryCMSDatabaseAdapterType): OryCMSMappedDatabaseField {
  const typeMap: Record<OryCMSDatabaseAdapterType, string> = {
    postgresql: "UUID",
    mysql: "CHAR(36)",
    mongodb: "ObjectId",
    firebase: "string",
    oracle: "VARCHAR2(36)",
  };

  const defaultMap: Record<OryCMSDatabaseAdapterType, string | undefined> = {
    postgresql: "gen_random_uuid()",
    mysql: "(UUID())",
    mongodb: undefined,
    firebase: undefined,
    oracle: "SYS_GUID()",
  };

  return {
    name: "id",
    nativeType: typeMap[adapterType],
    nullable: false,
    unique: true,
    primaryKey: true,
    defaultValue: defaultMap[adapterType],
  };
}

function makeTimestampField(
  name: string,
  adapterType: OryCMSDatabaseAdapterType,
  kind: "created" | "updated",
): OryCMSMappedDatabaseField {
  const typeMap: Record<OryCMSDatabaseAdapterType, string> = {
    postgresql: "TIMESTAMPTZ",
    mysql: "DATETIME",
    mongodb: "Date",
    firebase: "timestamp",
    oracle: "TIMESTAMP WITH TIME ZONE",
  };

  return {
    name,
    nativeType: typeMap[adapterType],
    nullable: false,
    unique: false,
    primaryKey: false,
    defaultValue: kind === "created" ? "NOW()" : "NOW()",
    comment: kind === "created" ? "auto-set on insert" : "auto-updated on change",
  };
}

function makeDraftField(adapterType: OryCMSDatabaseAdapterType): OryCMSMappedDatabaseField {
  const typeMap: Record<OryCMSDatabaseAdapterType, string> = {
    postgresql: "BOOLEAN",
    mysql: "TINYINT(1)",
    mongodb: "Boolean",
    firebase: "boolean",
    oracle: "NUMBER(1)",
  };

  return {
    name: "_isDraft",
    nativeType: typeMap[adapterType],
    nullable: false,
    unique: false,
    primaryKey: false,
    defaultValue: adapterType === "mysql" || adapterType === "oracle" ? "1" : "TRUE",
    comment: "draft/publish workflow flag",
  };
}

function makePublishedAtField(adapterType: OryCMSDatabaseAdapterType): OryCMSMappedDatabaseField {
  const typeMap: Record<OryCMSDatabaseAdapterType, string> = {
    postgresql: "TIMESTAMPTZ",
    mysql: "DATETIME",
    mongodb: "Date",
    firebase: "timestamp",
    oracle: "TIMESTAMP WITH TIME ZONE",
  };

  return {
    name: "_publishedAt",
    nativeType: typeMap[adapterType],
    nullable: true,
    unique: false,
    primaryKey: false,
    comment: "null until first publish",
  };
}

function makeSeoTextField(
  name: string,
  adapterType: OryCMSDatabaseAdapterType,
  long = false,
): OryCMSMappedDatabaseField {
  const typeMap: Record<OryCMSDatabaseAdapterType, string> = {
    postgresql: long ? "TEXT" : "VARCHAR(255)",
    mysql: long ? "TEXT" : "VARCHAR(255)",
    mongodb: "String",
    firebase: "string",
    oracle: long ? "CLOB" : "VARCHAR2(255)",
  };

  return {
    name,
    nativeType: typeMap[adapterType],
    nullable: true,
    unique: false,
    primaryKey: false,
    comment: "SEO metadata",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Table name helper
// ─────────────────────────────────────────────────────────────────────────────

function deriveTableName(collection: OryCMSCollectionDefinition): string {
  return collection.tableName ?? collection.slug.replace(/-/g, "_");
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts an OryCMS collection definition into a concrete database schema
 * descriptor for the specified adapter. Includes system fields (id, timestamps,
 * draft, SEO) and auto-indexes for slug and unique fields.
 */
export function mapOryCMSCollectionToDatabaseSchema(
  collection: OryCMSCollectionDefinition,
  adapterType: OryCMSDatabaseAdapterType,
): OryCMSMappedDatabaseSchema {
  const tableName = deriveTableName(collection);

  const fields: OryCMSMappedDatabaseField[] = [];
  const indexes: OryCMSMappedDatabaseIndex[] = [];

  // ── Primary key ───────────────────────────────────────────────────
  fields.push(makePrimaryKeyField(adapterType));

  // ── User-defined fields ───────────────────────────────────────────
  for (const schemaField of collection.fields) {
    const mapped = mapOryCMSFieldToDatabaseField(schemaField, adapterType);
    fields.push(mapped);

    // Auto-index slug fields (always unique)
    if (schemaField.type === "slug") {
      indexes.push({
        name: `idx_${tableName}_${schemaField.name}`,
        fields: [schemaField.name],
        unique: true,
        type: "btree",
      });
    }

    // Index unique fields that aren't already primary or slug
    if (schemaField.unique && schemaField.type !== "slug") {
      indexes.push({
        name: `idx_${tableName}_${schemaField.name}_unique`,
        fields: [schemaField.name],
        unique: true,
        type: "btree",
      });
    }

    // Index relation FK columns
    if (schemaField.type === "relation" && schemaField.cardinality === "one") {
      indexes.push({
        name: `idx_${tableName}_${schemaField.name}`,
        fields: [schemaField.name],
        unique: false,
        type: "btree",
      });
    }
  }

  // ── System: timestamps ────────────────────────────────────────────
  if (collection.timestamps?.enabled !== false) {
    const createdAtName = collection.timestamps?.createdAtField ?? "createdAt";
    const updatedAtName = collection.timestamps?.updatedAtField ?? "updatedAt";
    fields.push(makeTimestampField(createdAtName, adapterType, "created"));
    fields.push(makeTimestampField(updatedAtName, adapterType, "updated"));
  }

  // ── System: draft/publish workflow ───────────────────────────────
  if (collection.draft?.enabled) {
    fields.push(makeDraftField(adapterType));
    fields.push(makePublishedAtField(adapterType));
    indexes.push({
      name: `idx_${tableName}_is_draft`,
      fields: ["_isDraft"],
      unique: false,
      type: "btree",
    });
  }

  // ── System: SEO metadata fields ───────────────────────────────────
  if (collection.seo?.enabled) {
    fields.push(makeSeoTextField("_seoTitle", adapterType, false));
    fields.push(makeSeoTextField("_seoDescription", adapterType, true));
    fields.push(makeSeoTextField("_seoImage", adapterType, false));
  }

  return { collectionSlug: collection.slug, tableName, adapterType, fields, indexes };
}
