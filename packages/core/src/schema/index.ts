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
  upsertOryCMSCollectionInRegistry,
  getOryCMSCollection,
  listOryCMSCollections,
  updateOryCMSCollectionSchema,
  removeOryCMSCollection,
  validateOryCMSCollectionSchemaPure,
  clearOryCMSRegistry,
} from "./schema.engine";

export {
  OryCMSCollectionPersistenceError,
  saveOryCMSCollectionSchema,
  updateOryCMSPersistedCollection,
  deleteOryCMSPersistedCollection,
  getOryCMSPersistedCollection,
  listOryCMSPersistedCollections,
  loadOryCMSCollectionsIntoRegistry,
} from "./schema.persistence";

export {
  loadOryCMSPersistedCollectionsOnStartup,
  resetOryCMSStartupLoaderForTests,
} from "./schema.startup";
