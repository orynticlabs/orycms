/** @ory-cms/next MVP: setup, login, session provider, and dashboard shell. */
export { OryCMSAdmin } from "./admin/OryCMSAdmin";
export type { OryCMSAdminProps } from "./admin/OryCMSAdmin";
export { OryCMSLoginPage } from "./admin/OryCMSLoginPage";
export { OryCMSSetupPage } from "./admin/OryCMSSetupPage";
export { AppShell } from "./components/dashboard/AppShell";
export { AppSidebar } from "./components/dashboard/AppSidebar";
export { Dashboard } from "./components/dashboard/Dashboard";
export {
  OryCMSSessionProvider,
  useOryCMSSession,
  useOryCMSPermission,
  hasOryCMSClientPermission,
  Can,
} from "./hooks/use-orycms-session";
export type { OryCMSSessionState, OryCMSSessionUser } from "./hooks/use-orycms-session";
