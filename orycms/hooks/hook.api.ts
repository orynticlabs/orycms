import type { OryCMSHookEventName, OryCMSHookFn, OryCMSHookRegistration } from "./hook.types";
import {
  registerGlobalOryCMSHook,
  unregisterOryCMSHookById,
  getOryCMSHooksForEvent,
  clearOryCMSHookRegistry,
} from "./hook.registry";

type HookOptions = { id?: string; priority?: number; timeout?: number };

/** Type-safe hook definition helper — returns the args as a typed record. */
export function defineOryCMSHook(
  event: OryCMSHookEventName,
  fn: OryCMSHookFn,
  options?: HookOptions,
): { event: OryCMSHookEventName; fn: OryCMSHookFn; options?: HookOptions } {
  return { event, fn, options };
}

/** Register a global hook and return its id. */
export function registerOryCMSHook(
  event: OryCMSHookEventName,
  fn: OryCMSHookFn,
  options?: HookOptions,
): string {
  return registerGlobalOryCMSHook(event, fn, options);
}

/** Remove a hook by its registration id. Returns true if found and removed. */
export function unregisterOryCMSHook(id: string): boolean {
  return unregisterOryCMSHookById(id);
}

/** Return all registered hooks for an event, optionally scoped to a collection. */
export function getOryCMSHooks(
  event: OryCMSHookEventName,
  collectionSlug?: string | null,
): OryCMSHookRegistration[] {
  return getOryCMSHooksForEvent(event, collectionSlug);
}

/** Clear the entire hook registry. */
export function clearOryCMSHooks(): void {
  clearOryCMSHookRegistry();
}
