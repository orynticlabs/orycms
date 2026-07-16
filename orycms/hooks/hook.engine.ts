import type { OryCMSHookContext, OryCMSHookEventName } from "./hook.types";
import { executeOryCMSBeforeHooks, executeOryCMSAfterHooks } from "./hook.executor";
import { hasOryCMSHooks } from "./hook.registry";

// ── Context builder ───────────────────────────────────────────────────────────

export function buildOryCMSHookContext(
  operation: OryCMSHookEventName,
  collection: string | null,
  data: Record<string, unknown>,
  previous: Record<string, unknown> | null,
  extra?: Partial<
    Pick<OryCMSHookContext, "user" | "transaction" | "meta" | "request" | "response">
  >,
): Readonly<OryCMSHookContext> {
  return {
    operation,
    collection,
    data,
    previous,
    user: extra?.user ?? null,
    transaction: extra?.transaction,
    meta: extra?.meta ?? {},
    request: extra?.request,
    response: extra?.response,
  };
}

// ── Public engine API ─────────────────────────────────────────────────────────

/**
 * Run before-phase hooks for an event.
 * Fast-path: returns immediately when no hooks are registered for this event.
 * Throws OryCMSHookError(HOOK_ABORTED) if a hook cancels the operation.
 */
export async function runOryCMSBeforeHooks(
  event: OryCMSHookEventName,
  ctx: Readonly<OryCMSHookContext>,
): Promise<void> {
  if (!hasOryCMSHooks(event, ctx.collection)) return;
  await executeOryCMSBeforeHooks(event, ctx);
}

/**
 * Run after-phase hooks for an event.
 * Fast-path: returns immediately when no hooks are registered for this event.
 */
export async function runOryCMSAfterHooks(
  event: OryCMSHookEventName,
  ctx: Readonly<OryCMSHookContext>,
): Promise<void> {
  if (!hasOryCMSHooks(event, ctx.collection)) return;
  await executeOryCMSAfterHooks(event, ctx);
}
