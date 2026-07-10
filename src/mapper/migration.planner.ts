import type {
  OryCMSCollectionDefinition,
  OryCMSSchemaRelationField,
} from "@/schema/collection.schema";
import type {
  OryCMSDatabaseAdapterType,
  OryCMSDatabaseAdapterCapabilities,
} from "@/database/adapter.types";
import type {
  OryCMSCollectionMigrationPlan,
  OryCMSMappedDatabaseField,
  OryCMSMappedDatabaseIndex,
  OryCMSMappedDatabaseSchema,
  OryCMSMigrationOperation,
  OryCMSJunctionTableSpec,
} from "./mapper.types";
import { ORYCMS_DEFAULT_ADAPTER_CAPABILITIES } from "./mapper.types";
import { mapOryCMSCollectionToDatabaseSchema } from "./collection.mapper";
import { validateOryCMSAdapterCapabilities } from "./capabilities.validator";

// ─────────────────────────────────────────────────────────────────────────────
// SQL statement generators
// ─────────────────────────────────────────────────────────────────────────────

function q(name: string, adapter: OryCMSDatabaseAdapterType): string {
  return adapter === "mysql" ? `\`${name}\`` : `"${name}"`;
}

function renderColumnSQL(
  field: OryCMSMappedDatabaseField,
  adapter: OryCMSDatabaseAdapterType,
): string {
  const parts: string[] = [`  ${q(field.name, adapter)} ${field.nativeType}`];
  if (!field.nullable) parts.push("NOT NULL");
  if (field.primaryKey) {
    if (field.defaultValue) parts.push(`DEFAULT ${field.defaultValue}`);
  } else {
    if (field.unique) parts.push("UNIQUE");
    if (field.defaultValue) parts.push(`DEFAULT ${field.defaultValue}`);
    if (field.checkConstraint)
      parts.push(`CHECK (${q(field.name, adapter)} ${field.checkConstraint})`);
  }
  return parts.join(" ");
}

function renderPKConstraint(tableName: string, adapter: OryCMSDatabaseAdapterType): string {
  if (adapter === "oracle") {
    return `  CONSTRAINT ${q(`pk_${tableName}`, adapter)} PRIMARY KEY (${q("id", adapter)})`;
  }
  return `  PRIMARY KEY (${q("id", adapter)})`;
}

function renderCreateTableSQL(schema: OryCMSMappedDatabaseSchema): string {
  const { tableName, fields, adapter } = { ...schema, adapter: schema.adapterType };
  const tbl = q(tableName, adapter);

  const colDefs = fields.map((f) => renderColumnSQL(f, adapter));
  const pkConstraint = renderPKConstraint(tableName, adapter);

  const ifNotExists = adapter === "oracle" ? "" : "IF NOT EXISTS ";
  const suffix =
    adapter === "mysql"
      ? "\nENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"
      : ";";

  return `CREATE TABLE ${ifNotExists}${tbl} (\n${[...colDefs, pkConstraint].join(",\n")}\n)${suffix}`;
}

function renderDropTableSQL(tableName: string, adapter: OryCMSDatabaseAdapterType): string {
  if (adapter === "oracle") return `DROP TABLE ${q(tableName, adapter)} CASCADE CONSTRAINTS;`;
  return `DROP TABLE IF EXISTS ${q(tableName, adapter)};`;
}

function renderCreateIndexSQL(
  tableName: string,
  index: OryCMSMappedDatabaseIndex,
  adapter: OryCMSDatabaseAdapterType,
): string {
  const uniquePart = index.unique ? "UNIQUE " : "";
  const cols = index.fields.map((f) => q(f, adapter)).join(", ");
  if (adapter === "oracle") {
    return `CREATE ${uniquePart}INDEX ${q(index.name, adapter)} ON ${q(tableName, adapter)} (${cols});`;
  }
  return `CREATE ${uniquePart}INDEX IF NOT EXISTS ${q(index.name, adapter)} ON ${q(tableName, adapter)} (${cols});`;
}

function renderDropIndexSQL(
  index: OryCMSMappedDatabaseIndex,
  tableName: string,
  adapter: OryCMSDatabaseAdapterType,
): string {
  if (adapter === "mysql")
    return `DROP INDEX ${q(index.name, adapter)} ON ${q(tableName, adapter)};`;
  if (adapter === "oracle") return `DROP INDEX ${q(index.name, adapter)};`;
  return `DROP INDEX IF EXISTS ${q(index.name, adapter)};`;
}

function renderAddFKSQL(
  tableName: string,
  field: OryCMSMappedDatabaseField,
  adapter: OryCMSDatabaseAdapterType,
): string {
  const ref = field.references!;
  const constraintName = `fk_${tableName}_${field.name}`;
  return (
    `ALTER TABLE ${q(tableName, adapter)} ` +
    `ADD CONSTRAINT ${q(constraintName, adapter)} ` +
    `FOREIGN KEY (${q(field.name, adapter)}) ` +
    `REFERENCES ${q(ref.table, adapter)} (${q(ref.column, adapter)}) ` +
    `ON DELETE ${ref.onDelete ?? "SET NULL"};`
  );
}

function renderDropFKSQL(
  tableName: string,
  field: OryCMSMappedDatabaseField,
  adapter: OryCMSDatabaseAdapterType,
): string {
  const constraintName = `fk_${tableName}_${field.name}`;
  if (adapter === "mysql")
    return `ALTER TABLE ${q(tableName, adapter)} DROP FOREIGN KEY ${q(constraintName, adapter)};`;
  return `ALTER TABLE ${q(tableName, adapter)} DROP CONSTRAINT ${q(constraintName, adapter)};`;
}

function renderJunctionTableSQL(
  j: OryCMSJunctionTableSpec,
  adapter: OryCMSDatabaseAdapterType,
): string {
  const tbl = q(j.name, adapter);
  const srcCol = q(j.sourceColumn, adapter);
  const tgtCol = q(j.targetColumn, adapter);
  const srcTbl = q(j.sourceTable, adapter);
  const tgtTbl = q(j.targetTable, adapter);

  // Use the appropriate ID type per adapter
  const idType =
    adapter === "mysql" ? "BIGINT UNSIGNED" : adapter === "oracle" ? "NUMBER(19)" : "UUID";

  const ifNotExists = adapter === "oracle" ? "" : "IF NOT EXISTS ";
  const suffix = adapter === "mysql" ? "\nENGINE=InnoDB DEFAULT CHARSET=utf8mb4;" : ";";

  return (
    `CREATE TABLE ${ifNotExists}${tbl} (\n` +
    `  ${srcCol} ${idType} NOT NULL REFERENCES ${srcTbl}(${q("id", adapter)}) ON DELETE CASCADE,\n` +
    `  ${tgtCol} ${idType} NOT NULL REFERENCES ${tgtTbl}(${q("id", adapter)}) ON DELETE CASCADE,\n` +
    `  PRIMARY KEY (${srcCol}, ${tgtCol})\n` +
    `)${suffix}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NoSQL operation string generators
// ─────────────────────────────────────────────────────────────────────────────

function renderMongoCreateCollection(schema: OryCMSMappedDatabaseSchema): string {
  const required = schema.fields.filter((f) => !f.nullable && !f.primaryKey).map((f) => f.name);
  const properties: Record<string, { bsonType: string }> = {};
  for (const f of schema.fields) {
    properties[f.name] = {
      bsonType: f.nativeType.toLowerCase().replace("<", "_").replace(">", ""),
    };
  }
  return (
    `db.createCollection("${schema.tableName}", {\n` +
    `  validator: { $jsonSchema: {\n` +
    `    bsonType: "object",\n` +
    `    required: ${JSON.stringify(required)},\n` +
    `    properties: ${JSON.stringify(properties, null, 4)}\n` +
    `  }}\n` +
    `});`
  );
}

function renderMongoCreateIndex(tableName: string, index: OryCMSMappedDatabaseIndex): string {
  const keys = index.fields.reduce<Record<string, number>>((acc, f) => ({ ...acc, [f]: 1 }), {});
  return `db["${tableName}"].createIndex(${JSON.stringify(keys)}, { unique: ${index.unique}, name: "${index.name}" });`;
}

function renderFirebaseSchema(schema: OryCMSMappedDatabaseSchema): string {
  const structure = schema.fields.reduce<Record<string, string>>((acc, f) => {
    acc[f.name] = f.nativeType;
    return acc;
  }, {});
  return (
    `// Firestore collection: "${schema.tableName}"\n` +
    `// Document structure (Firestore is schemaless — this is guidance only):\n` +
    JSON.stringify(structure, null, 2)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Operation builders
// ─────────────────────────────────────────────────────────────────────────────

const SQL_ADAPTERS = new Set<OryCMSDatabaseAdapterType>(["postgresql", "mysql", "oracle"]);

function buildOperations(
  collection: OryCMSCollectionDefinition,
  schema: OryCMSMappedDatabaseSchema,
): OryCMSMigrationOperation[] {
  const ops: OryCMSMigrationOperation[] = [];
  const { tableName, adapterType: adapter } = schema;
  const isSql = SQL_ADAPTERS.has(adapter);

  // ── CREATE COLLECTION / TABLE ─────────────────────────────────────

  if (isSql) {
    ops.push({
      type: "CREATE_COLLECTION",
      target: tableName,
      upStatement: renderCreateTableSQL(schema),
      downStatement: renderDropTableSQL(tableName, adapter),
      reversible: true,
    });
  } else if (adapter === "mongodb") {
    ops.push({
      type: "CREATE_COLLECTION",
      target: tableName,
      upStatement: renderMongoCreateCollection(schema),
      downStatement: `db["${tableName}"].drop();`,
      reversible: true,
    });
  } else {
    // Firebase: schemaless, no creation needed
    ops.push({
      type: "CREATE_COLLECTION",
      target: tableName,
      upStatement: renderFirebaseSchema(schema),
      downStatement: `// Delete all documents in the "${tableName}" Firestore collection`,
      reversible: false,
    });
  }

  // ── INDEXES ───────────────────────────────────────────────────────

  for (const index of schema.indexes) {
    if (isSql) {
      ops.push({
        type: "ADD_INDEX",
        target: tableName,
        index,
        upStatement: renderCreateIndexSQL(tableName, index, adapter),
        downStatement: renderDropIndexSQL(index, tableName, adapter),
        reversible: true,
      });
    } else if (adapter === "mongodb") {
      ops.push({
        type: "ADD_INDEX",
        target: tableName,
        index,
        upStatement: renderMongoCreateIndex(tableName, index),
        downStatement: `db["${tableName}"].dropIndex("${index.name}");`,
        reversible: true,
      });
    }
    // Firebase has no native index management via SDK schema
  }

  // ── FOREIGN KEYS (SQL only) ───────────────────────────────────────

  if (isSql) {
    for (const field of schema.fields) {
      if (field.references) {
        ops.push({
          type: "ADD_FOREIGN_KEY",
          target: tableName,
          field,
          upStatement: renderAddFKSQL(tableName, field, adapter),
          downStatement: renderDropFKSQL(tableName, field, adapter),
          reversible: true,
        });
      }
    }

    // ── JUNCTION TABLES for many-to-many (SQL only) ─────────────────

    for (const schemaField of collection.fields) {
      if (schemaField.type === "relation" && schemaField.cardinality === "many") {
        const rf = schemaField as OryCMSSchemaRelationField;
        const targetTable = rf.target.replace(/-/g, "_");
        const junctionName = `${tableName}_${targetTable}`;

        const junction: OryCMSJunctionTableSpec = {
          name: junctionName,
          sourceTable: tableName,
          sourceColumn: `${tableName}_id`,
          targetTable,
          targetColumn: `${targetTable}_id`,
        };

        ops.push({
          type: "CREATE_JUNCTION_TABLE",
          target: junctionName,
          junction,
          upStatement: renderJunctionTableSQL(junction, adapter),
          downStatement: renderDropTableSQL(junctionName, adapter),
          reversible: true,
        });
      }
    }
  }

  return ops;
}

// ─────────────────────────────────────────────────────────────────────────────
// Migration ID
// ─────────────────────────────────────────────────────────────────────────────

function buildMigrationId(slug: string): string {
  const ts = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);
  return `orycms_${slug.replace(/-/g, "_")}_${ts}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Produces a complete migration plan for an OryCMS collection targeting a
 * specific database adapter. Does NOT execute or persist anything.
 *
 * If unsupported adapter capabilities are detected as errors, the function
 * throws. Warnings are collected in the returned plan's `warnings` array.
 */
export function generateOryCMSCollectionMigrationPlan(
  collection: OryCMSCollectionDefinition,
  adapterType: OryCMSDatabaseAdapterType,
  capabilities: OryCMSDatabaseAdapterCapabilities = ORYCMS_DEFAULT_ADAPTER_CAPABILITIES[
    adapterType
  ],
): OryCMSCollectionMigrationPlan {
  // 1. Validate capabilities — throw on blocking errors
  const capResult = validateOryCMSAdapterCapabilities(collection, adapterType, capabilities);
  if (!capResult.valid) {
    const errors = capResult.issues.filter((i) => i.severity === "error");
    throw new Error(
      `generateOryCMSCollectionMigrationPlan: adapter "${adapterType}" cannot support ` +
        `collection "${collection.slug}".\n` +
        errors.map((e) => `  [${e.code}] ${e.message}`).join("\n"),
    );
  }

  // 2. Map collection to database schema
  const schema = mapOryCMSCollectionToDatabaseSchema(collection, adapterType);

  // 3. Build operations
  const operations = buildOperations(collection, schema);

  // 4. Collect warnings from capability check
  const warnings = capResult.issues
    .filter((i) => i.severity === "warning")
    .map((i) => `[${i.code}] ${i.message}`);

  return {
    migrationId: buildMigrationId(collection.slug),
    generatedAt: new Date().toISOString(),
    collectionSlug: collection.slug,
    collectionName: collection.name,
    tableName: schema.tableName,
    adapterType,
    schema,
    operations,
    warnings,
  };
}
