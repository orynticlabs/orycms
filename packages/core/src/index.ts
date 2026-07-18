// Namespaced exports (backward-compatible with OryCMSCore.xxx usage)
export * as OryCMSAdmin from "./admin";
export * as OryCMSAuth from "./auth";
export * as OryCMSAudit from "./audit";
export * as OryCMSConfig from "./config";
export * as OryCMSContent from "./content";
export * as OryCMSCore from "./core";
export * as OryCMSDatabase from "./database";
export * as OryCMSEmail from "./email";
export * as OryCMSHooks from "./hooks";
export * as OryCMSMapper from "./mapper";
export * as OryCMSMedia from "./media";
export * as OryCMSMigrations from "./migrations";
export * as OryCMSPlugins from "./plugins";
export * as OryCMSRbac from "./rbac";
export * as OryCMSRoles from "./roles";
export * as OryCMSSchema from "./schema";
export * as OryCMSSettings from "./settings";
export * as OryCMSTokens from "./tokens";
export * as OryCMSUsers from "./users";

// Flat re-exports — required by @ory-cms/next component stubs
export * from "./admin";
export * from "./schema";
export type * from "./types";

// Convenience exports for user orycms.config.ts files
export { defineOryCMSConfig } from "./config";

// ── Runtime surface consumed by apps + the (future) route-handler factory ──────

// Auth + session
export {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  OryCMSAuthError,
  hasOryCMSInitialUser,
  createOryCMSInitialOwner,
  authenticateOryCMSUser,
  createOryCMSUserSession,
  destroyOryCMSUserSession,
  destroyOryCMSUserSessions,
  getOryCMSCurrentSession,
  protectOryCMSAdminRoute,
  oryAppOrigin,
  buildOryCMSTokenLink,
  dispatchOryCMSTokenLink,
} from "./auth";
export type {
  OryCMSAuthErrorCode,
  OryCMSSetupInput,
  OryCMSAuthUser,
  OryCMSSessionData,
  OryCMSTokenDispatchResult,
} from "./auth";

// RBAC
export {
  ORYCMS_DEFAULT_PERMISSIONS,
  clearOryCMSPermissionCache,
  syncOryCMSDefaultRoles,
  syncOryCMSDefaultPermissions,
  getOryCMSUserPermissions,
  hasOryCMSPermission,
  requireOryCMSPermission,
} from "./rbac";
export type { OryCMSResource, OryCMSAction } from "./rbac";

// Core install + bootstrap
export { installOryCMSCoreSchema, getOryCMSCoreCollections, bootstrapOryCMS } from "./core";
export type { OryCMSCoreInstallResult, OryCMSBootstrapResult } from "./core";

// DB pool + route guards
export { getOryCMSPool } from "./lib/db";
export { guardOryCMS, toErrorResponse, oryJsonOk, oryJsonError } from "./lib/route-guards";

// Data repos
export {
  listOryCMSUsers,
  getOryCMSUser,
  findOryCMSUserByEmail,
  createOryCMSUser,
  updateOryCMSUser,
  deleteOryCMSUser,
  setOryCMSUserRole,
  setOryCMSUserStatus,
} from "./users";
export type {
  OryCMSUserRecord,
  OryCMSUserStatus,
  OryCMSCreateUserInput,
  OryCMSUpdateUserInput,
} from "./users";
export {
  listOryCMSRoles,
  getOryCMSRole,
  createOryCMSRole,
  updateOryCMSRole,
  deleteOryCMSRole,
  getOryCMSRolePermissions,
  setOryCMSRolePermissions,
  listOryCMSPermissions,
} from "./roles";
export type { OryCMSRoleRecord, OryCMSPermissionRecord } from "./roles";
export { getAllOryCMSSettings, getOryCMSSetting, setOryCMSSetting } from "./settings";
export type { OryCMSSettingRecord } from "./settings";
export { recordOryCMSAuditLog, listOryCMSAuditLogs } from "./audit";
export type { OryCMSAuditEntry, OryCMSAuditLog, OryCMSAuditFilter } from "./audit";
export { createOryCMSToken, consumeOryCMSToken } from "./tokens";
export type {
  OryCMSTokenType,
  OryCMSCreateTokenInput,
  OryCMSConsumedToken,
} from "./tokens";

// Email
export {
  getOryCMSEmailProvider,
  resolveOryCMSEmailConfig,
  sendOryCMSEmail,
  isOryCMSEmailConfigured,
} from "./email";
export type {
  OryCMSEmailMessage,
  OryCMSEmailProvider,
  OryCMSResolvedEmailConfig,
  OryCMSSendResult,
} from "./email";
