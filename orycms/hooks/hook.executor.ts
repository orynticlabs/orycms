import { OryCMSHookError } from "./hook.errors";
import { getOryCMSHooksForEvent } from "./hook.registry";
import type {
  OryCMSHookCancelResult,
  OryCMSHookContext,
  OryCMSHookEventName,
  OryCMSHookRegistration,
  OryCMSHookResult,
} from "./hook.types";

// ── Timeout wrapper ───────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, hookId: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new OryCMSHookError("HOOK_TIMEOUT", `Hook "${hookId}" timed out after ${ms}ms.`, 408),
          ),
        ms,
      ),
    ),
  ]);
}

// ── Single hook execution ─────────────────────────────────────────────────────

async function executeHook(
  reg: OryCMSHookRegistration,
  ctx: Readonly<OryCMSHookContext>,
): Promise<OryCMSHookResult> {
  try {
    return await withTimeout(Promise.resolve(reg.fn(ctx)), reg.timeout, reg.id);
  } catch (err) {
    if (err instanceof OryCMSHookError) throw err;
    throw new OryCMSHookError(
      "HOOK_FAILED",
      `Hook "${reg.id}" failed: ${err instanceof Error ? err.message : String(err)}`,
      500,
    );
  }
}

function isCancelResult(r: OryCMSHookResult): r is OryCMSHookCancelResult {
  return (
    !!r && typeof r === "object" && "cancel" in r && (r as OryCMSHookCancelResult).cancel === true
  );
}

// ── Before hook runner ────────────────────────────────────────────────────────

export async function executeOryCMSBeforeHooks(
  event: OryCMSHookEventName,
  ctx: Readonly<OryCMSHookContext>,
): Promise<void> {
  const hooks = getOryCMSHooksForEvent(event, ctx.collection);
  if (hooks.length === 0) return;

  for (const hook of hooks) {
    const result = await executeHook(hook, ctx);
    if (isCancelResult(result)) {
      throw new OryCMSHookError("HOOK_ABORTED", result.reason, 422);
    }
  }
}

// ── After hook runner ─────────────────────────────────────────────────────────

export async function executeOryCMSAfterHooks(
  event: OryCMSHookEventName,
  ctx: Readonly<OryCMSHookContext>,
): Promise<void> {
  const hooks = getOryCMSHooksForEvent(event, ctx.collection);
  if (hooks.length === 0) return;

  for (const hook of hooks) {
    await executeHook(hook, ctx);
  }
}
