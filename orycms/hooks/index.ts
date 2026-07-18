// Types
export type {
  OryCMSHookEventName,
  OryCMSHookContext,
  OryCMSHookUser,
  OryCMSHookFn,
  OryCMSHookResult,
  OryCMSHookCancelResult,
  OryCMSHookRegistration,
  OryCMSHookSource,
  OryCMSCollectionHooks,
} from "./hook.types";

// Errors
export { OryCMSHookError } from "./hook.errors";
export type { OryCMSHookErrorCode } from "./hook.errors";

// Constants
export { HOOK_EVENTS, HOOK_DEFAULT_TIMEOUT_MS } from "./hook.constants";

// Registry
export {
  registerGlobalOryCMSHook,
  registerOryCMSPluginHook,
  registerOryCMSCollectionHooks,
  unregisterOryCMSCollectionHooks,
  unregisterOryCMSHookById,
  getOryCMSHooksForEvent,
  hasOryCMSHooks,
  clearOryCMSHookRegistry,
} from "./hook.registry";

// Public API (user-facing helpers)
export {
  defineOryCMSHook,
  registerOryCMSHook,
  unregisterOryCMSHook,
  getOryCMSHooks,
  clearOryCMSHooks,
} from "./hook.api";

// Engine (public run API)
export { buildOryCMSHookContext, runOryCMSBeforeHooks, runOryCMSAfterHooks } from "./hook.engine";

export { useIsMobile } from "./use-mobile";

// Client session/permission hooks (admin UI gating)
export {
  OryCMSSessionProvider,
  useOryCMSSession,
  useOryCMSPermission,
  hasOryCMSClientPermission,
  Can,
} from "./use-orycms-session";
export type { OryCMSSessionState, OryCMSSessionUser } from "./use-orycms-session";
