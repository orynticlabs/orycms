// Types + constants
export type * from "./mapper.types";
export { ORYCMS_DEFAULT_ADAPTER_CAPABILITIES } from "./mapper.types";

// Field mapper
export { getOryCMSDatabaseFieldType, mapOryCMSFieldToDatabaseField } from "./field.mapper";

// Collection mapper
export { mapOryCMSCollectionToDatabaseSchema } from "./collection.mapper";

// Capabilities validator
export { validateOryCMSAdapterCapabilities } from "./capabilities.validator";

// Migration planner
export { generateOryCMSCollectionMigrationPlan } from "./migration.planner";

export {
  compareOryCMSCollectionSchema,
  generateOryCMSSchemaDiff,
  generateOryCMSMigrationPreview,
  validateOryCMSMigrationSafety,
  introspectOryCMSPostgreSQLTable,
} from "./schema.diff";
export type {
  OryCMSActualPostgreSQLField,
  OryCMSActualPostgreSQLForeignKey,
  OryCMSActualPostgreSQLIndex,
  OryCMSActualPostgreSQLSchema,
  OryCMSMigrationPreview,
  OryCMSMigrationSafetyResult,
  OryCMSSchemaDiffOperation,
  OryCMSSchemaDiffOperationType,
} from "./schema.diff";
