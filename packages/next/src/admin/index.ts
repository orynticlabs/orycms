// Stub: re-export admin utilities from @ory-cms/core so component imports resolve
// (adminCollectionsPath, ORYCMS_FIELD_TYPES, collection form helpers, etc.).
// The page/entry components (OryCMSAdmin, OryCMSLoginPage, OryCMSSetupPage) are
// exported from the package root to avoid a circular import through this barrel.
export * from "@ory-cms/core";
