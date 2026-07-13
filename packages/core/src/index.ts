// Namespaced exports (backward-compatible with OryCMSCore.xxx usage)
export * as OryCMSAdmin from "./admin";
export * as OryCMSAuth from "./auth";
export * as OryCMSConfig from "./config";
export * as OryCMSContent from "./content";
export * as OryCMSCore from "./core";
export * as OryCMSDatabase from "./database";
export * as OryCMSHooks from "./hooks";
export * as OryCMSMapper from "./mapper";
export * as OryCMSMedia from "./media";
export * as OryCMSMigrations from "./migrations";
export * as OryCMSPlugins from "./plugins";
export * as OryCMSSchema from "./schema";

// Flat re-exports — required by @ory-cms/next component stubs
export * from "./admin";
export * from "./schema";
export type * from "./types";

// Convenience exports for user orycms.config.ts files
export { defineOryCMSConfig } from "./config";
export { installOryCMSCoreSchema } from "./core";
