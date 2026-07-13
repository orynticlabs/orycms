export { OryCMSAuthError } from "./auth.errors";
export type { OryCMSAuthErrorCode } from "./auth.errors";
export {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  hasOryCMSInitialUser,
  createOryCMSInitialOwner,
  authenticateOryCMSUser,
  createOryCMSUserSession,
  destroyOryCMSUserSession,
  getOryCMSCurrentSession,
  protectOryCMSAdminRoute,
} from "./auth";
export type { OryCMSSetupInput, OryCMSAuthUser, OryCMSSessionData } from "./auth";
