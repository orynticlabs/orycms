/** @ory-cms/core MVP: setup, authentication, and session runtime only. */
export {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  OryCMSAuthError,
  installOryCMSAuthSchema,
  hasOryCMSInitialUser,
  createOryCMSInitialOwner,
  authenticateOryCMSUser,
  createOryCMSUserSession,
  destroyOryCMSUserSession,
  destroyOryCMSUserSessions,
  getOryCMSCurrentSession,
  protectOryCMSAdminRoute,
} from "./auth";
export type {
  OryCMSAuthErrorCode,
  OryCMSSetupInput,
  OryCMSAuthUser,
  OryCMSSessionData,
} from "./auth";
export { getOryCMSPool } from "./lib/db";
