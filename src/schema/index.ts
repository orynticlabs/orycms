// Types
export type * from "./collection.schema";

// Validator (pure, no-throw)
export { validateOryCMSCollectionSchema } from "./schema.validator";
export type { OryCMSValidatorOptions } from "./schema.validator";

// Engine
export {
  OryCMSSchemaError,
  defineOryCMSCollection,
  registerOryCMSCollection,
  getOryCMSCollection,
  listOryCMSCollections,
  updateOryCMSCollectionSchema,
  removeOryCMSCollection,
  validateOryCMSCollectionSchemaPure,
  clearOryCMSRegistry,
} from "./schema.engine";
