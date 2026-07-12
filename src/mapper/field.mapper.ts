import type { OryCMSSchemaField } from "@/schema";
import type { OryCMSDatabaseAdapterType } from "@/database";
import type { OryCMSMappedDatabaseField, OryCMSMappedFieldReference } from "./mapper.types";

// ─────────────────────────────────────────────────────────────────────────────
// Internal resolution types
// ─────────────────────────────────────────────────────────────────────────────

interface FieldTypeResolution {
  nativeType: string;
  checkConstraint?: string;
  references?: OryCMSMappedFieldReference;
  unique?: boolean;
  comment?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-adapter type resolvers
// ─────────────────────────────────────────────────────────────────────────────

function resolvePostgreSQL(field: OryCMSSchemaField): FieldTypeResolution {
  switch (field.type) {
    case "text":
      return {
        nativeType:
          field.maxLength && field.maxLength > 255 ? "TEXT" : `VARCHAR(${field.maxLength ?? 255})`,
      };
    case "textarea":
      return { nativeType: "TEXT" };
    case "richText":
      return { nativeType: "TEXT" };
    case "number":
      return { nativeType: field.integer ? "BIGINT" : "NUMERIC(10,2)" };
    case "boolean":
      return { nativeType: "BOOLEAN" };
    case "date":
      return { nativeType: field.includeTime ? "TIMESTAMPTZ" : "DATE" };
    case "email":
      return { nativeType: "VARCHAR(255)" };
    case "password":
      return { nativeType: "VARCHAR(255)", comment: "stores hashed password only" };
    case "select": {
      if (field.multiple) return { nativeType: "TEXT[]" };
      const values = field.options.map((o) => `'${o.value}'`).join(", ");
      return { nativeType: "VARCHAR(255)", checkConstraint: `IN (${values})` };
    }
    case "relation":
      return {
        nativeType: "UUID",
        references:
          field.cardinality === "one"
            ? {
                table: field.target.replace(/-/g, "_"),
                column: "id",
                onDelete: field.cascadeDelete ? "CASCADE" : "SET NULL",
              }
            : undefined,
      };
    case "media":
      return { nativeType: field.multiple ? "UUID[]" : "UUID" };
    case "json":
      return { nativeType: "JSONB" };
    case "slug":
      return { nativeType: "VARCHAR(255)", unique: true };
  }
}

function resolveMySQL(field: OryCMSSchemaField): FieldTypeResolution {
  switch (field.type) {
    case "text":
      return {
        nativeType:
          field.maxLength && field.maxLength > 255 ? "TEXT" : `VARCHAR(${field.maxLength ?? 255})`,
      };
    case "textarea":
      return { nativeType: "TEXT" };
    case "richText":
      return { nativeType: "LONGTEXT" };
    case "number":
      return { nativeType: field.integer ? "BIGINT" : "DECIMAL(10,2)" };
    case "boolean":
      return { nativeType: "TINYINT(1)", comment: "0=false, 1=true" };
    case "date":
      return { nativeType: field.includeTime ? "DATETIME" : "DATE" };
    case "email":
      return { nativeType: "VARCHAR(255)" };
    case "password":
      return { nativeType: "VARCHAR(255)", comment: "stores hashed password only" };
    case "select": {
      if (field.multiple) return { nativeType: "JSON" };
      const values = field.options.map((o) => `'${o.value}'`).join(", ");
      return { nativeType: "VARCHAR(255)", checkConstraint: `IN (${values})` };
    }
    case "relation":
      return {
        nativeType: "BIGINT UNSIGNED",
        references:
          field.cardinality === "one"
            ? {
                table: field.target.replace(/-/g, "_"),
                column: "id",
                onDelete: field.cascadeDelete ? "CASCADE" : "SET NULL",
              }
            : undefined,
      };
    case "media":
      return { nativeType: field.multiple ? "JSON" : "BIGINT UNSIGNED" };
    case "json":
      return { nativeType: "JSON" };
    case "slug":
      return { nativeType: "VARCHAR(255)", unique: true };
  }
}

function resolveMongoDB(field: OryCMSSchemaField): FieldTypeResolution {
  switch (field.type) {
    case "text":
      return { nativeType: "String" };
    case "textarea":
      return { nativeType: "String" };
    case "richText":
      return { nativeType: "String" };
    case "number":
      return { nativeType: field.integer ? "Long" : "Double" };
    case "boolean":
      return { nativeType: "Boolean" };
    case "date":
      return { nativeType: "Date" };
    case "email":
      return { nativeType: "String" };
    case "password":
      return { nativeType: "String", comment: "stores hashed password only" };
    case "select":
      return { nativeType: field.multiple ? "Array<String>" : "String" };
    case "relation":
      return { nativeType: field.cardinality === "many" ? "Array<ObjectId>" : "ObjectId" };
    case "media":
      return { nativeType: field.multiple ? "Array<ObjectId>" : "ObjectId" };
    case "json":
      return { nativeType: "Object" };
    case "slug":
      return { nativeType: "String", unique: true };
  }
}

function resolveFirebase(field: OryCMSSchemaField): FieldTypeResolution {
  switch (field.type) {
    case "text":
      return { nativeType: "string" };
    case "textarea":
      return { nativeType: "string" };
    case "richText":
      return { nativeType: "string" };
    case "number":
      return { nativeType: field.integer ? "integer" : "number" };
    case "boolean":
      return { nativeType: "boolean" };
    case "date":
      return { nativeType: "timestamp" };
    case "email":
      return { nativeType: "string" };
    case "password":
      return { nativeType: "string", comment: "stores hashed password only" };
    case "select":
      return { nativeType: field.multiple ? "array" : "string" };
    case "relation":
      return { nativeType: field.cardinality === "many" ? "array<reference>" : "reference" };
    case "media":
      return { nativeType: field.multiple ? "array<string>" : "string" };
    case "json":
      return { nativeType: "map" };
    case "slug":
      return { nativeType: "string", unique: true };
  }
}

function resolveOracle(field: OryCMSSchemaField): FieldTypeResolution {
  switch (field.type) {
    case "text":
      return {
        nativeType:
          field.maxLength && field.maxLength > 1000
            ? "CLOB"
            : `VARCHAR2(${field.maxLength ?? 255})`,
      };
    case "textarea":
      return { nativeType: "CLOB" };
    case "richText":
      return { nativeType: "CLOB" };
    case "number":
      return { nativeType: field.integer ? "NUMBER(19)" : "NUMBER(10,2)" };
    case "boolean":
      return { nativeType: "NUMBER(1)", checkConstraint: "IN (0, 1)", comment: "0=false, 1=true" };
    case "date":
      return { nativeType: field.includeTime ? "TIMESTAMP WITH TIME ZONE" : "DATE" };
    case "email":
      return { nativeType: "VARCHAR2(255)" };
    case "password":
      return { nativeType: "VARCHAR2(255)", comment: "stores hashed password only" };
    case "select": {
      if (field.multiple) return { nativeType: "CLOB", checkConstraint: "IS JSON" };
      const values = field.options.map((o) => `'${o.value}'`).join(", ");
      return { nativeType: "VARCHAR2(255)", checkConstraint: `IN (${values})` };
    }
    case "relation":
      return {
        nativeType: "NUMBER(19)",
        references:
          field.cardinality === "one"
            ? {
                table: field.target.replace(/-/g, "_"),
                column: "id",
                onDelete: field.cascadeDelete ? "CASCADE" : "SET NULL",
              }
            : undefined,
      };
    case "media":
      return { nativeType: field.multiple ? "CLOB" : "NUMBER(19)" };
    case "json":
      return { nativeType: "CLOB", checkConstraint: "IS JSON" };
    case "slug":
      return { nativeType: "VARCHAR2(255)", unique: true };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolver dispatch table
// ─────────────────────────────────────────────────────────────────────────────

const RESOLVERS: Record<
  OryCMSDatabaseAdapterType,
  (field: OryCMSSchemaField) => FieldTypeResolution
> = {
  postgresql: resolvePostgreSQL,
  mysql: resolveMySQL,
  mongodb: resolveMongoDB,
  firebase: resolveFirebase,
  oracle: resolveOracle,
};

// ─────────────────────────────────────────────────────────────────────────────
// Default value serialiser
// ─────────────────────────────────────────────────────────────────────────────

function serialiseDefault(value: unknown, adapterType: OryCMSDatabaseAdapterType): string {
  if (adapterType === "mongodb" || adapterType === "firebase") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") return `'${value}'`;
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the native database type string for a given OryCMS field and adapter.
 */
export function getOryCMSDatabaseFieldType(
  field: OryCMSSchemaField,
  adapterType: OryCMSDatabaseAdapterType,
): string {
  return RESOLVERS[adapterType](field).nativeType;
}

/**
 * Maps a single OryCMS schema field to a concrete database field descriptor.
 */
export function mapOryCMSFieldToDatabaseField(
  field: OryCMSSchemaField,
  adapterType: OryCMSDatabaseAdapterType,
): OryCMSMappedDatabaseField {
  const resolution = RESOLVERS[adapterType](field);

  return {
    name: field.name,
    nativeType: resolution.nativeType,
    nullable: !(field.required ?? false),
    unique: resolution.unique ?? field.unique ?? false,
    primaryKey: false,
    defaultValue:
      field.defaultValue !== undefined
        ? serialiseDefault(field.defaultValue, adapterType)
        : undefined,
    checkConstraint: resolution.checkConstraint,
    references: resolution.references,
    comment: resolution.comment,
  };
}
