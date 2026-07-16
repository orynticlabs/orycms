import type { HOOK_EVENTS } from "./hook.constants";

// ── Event names ───────────────────────────────────────────────────────────────

export type OryCMSHookEventName = (typeof HOOK_EVENTS)[keyof typeof HOOK_EVENTS];

// ── Hook context ──────────────────────────────────────────────────────────────

export interface OryCMSHookUser {
  readonly id?: string;
  readonly email?: string;
  readonly roleName?: string | null;
}

export interface OryCMSHookContext {
  /** Collection slug for content/collection hooks; null for auth/migration */
  readonly collection: string | null;
  /** The lifecycle event name */
  readonly operation: OryCMSHookEventName;
  /** Authenticated user, if available */
  readonly user: Readonly<OryCMSHookUser> | null;
  /** Primary data payload — hooks may mutate this before the engine persists it */
  readonly data: Record<string, unknown>;
  /** Previous state — populated for update/delete/publish operations */
  readonly previous: Record<string, unknown> | null;
  /** Raw HTTP request, when available */
  readonly request?: Readonly<unknown>;
  /** HTTP response context, when available */
  readonly response?: Readonly<unknown>;
  /** Shared DB transaction/client from the calling engine, when available */
  readonly transaction?: unknown;
  /** Arbitrary metadata for cross-hook communication */
  readonly meta: Record<string, unknown>;
}

// ── Hook return values ────────────────────────────────────────────────────────

export interface OryCMSHookCancelResult {
  cancel: true;
  reason: string;
}

export type OryCMSHookResult = void | OryCMSHookCancelResult;

// ── Hook function ─────────────────────────────────────────────────────────────

export type OryCMSHookFn = (
  ctx: Readonly<OryCMSHookContext>,
) => OryCMSHookResult | Promise<OryCMSHookResult>;

// ── Registration record ───────────────────────────────────────────────────────

export type OryCMSHookSource = "collection" | "global" | "plugin";

export interface OryCMSHookRegistration {
  /** Unique identifier — used for duplicate detection */
  readonly id: string;
  readonly event: OryCMSHookEventName;
  readonly fn: OryCMSHookFn;
  /** Higher = runs first. Default 0. */
  readonly priority: number;
  /** Per-hook timeout in ms. Falls back to HOOK_DEFAULT_TIMEOUT_MS. */
  readonly timeout: number;
  /**
   * Collection slug for scoped hooks, or "*" for global/plugin hooks
   * that run for every collection.
   */
  readonly scope: string;
  readonly source: OryCMSHookSource;
}

// ── Collection-level hooks DSL (in OryCMSCollectionDefinition) ───────────────

export interface OryCMSCollectionHooks {
  beforeCreate?: OryCMSHookFn[];
  afterCreate?: OryCMSHookFn[];
  beforeUpdate?: OryCMSHookFn[];
  afterUpdate?: OryCMSHookFn[];
  beforeDelete?: OryCMSHookFn[];
  afterDelete?: OryCMSHookFn[];
  beforePublish?: OryCMSHookFn[];
  afterPublish?: OryCMSHookFn[];
}
