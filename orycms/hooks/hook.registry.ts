import { HOOK_DEFAULT_TIMEOUT_MS } from "./hook.constants";
import { OryCMSHookError } from "./hook.errors";
import type {
  OryCMSHookEventName,
  OryCMSHookFn,
  OryCMSHookRegistration,
  OryCMSCollectionHooks,
} from "./hook.types";

// ── Internal registry storage ─────────────────────────────────────────────────
//
// Key schema:
//   global/plugin hooks → event name only     e.g. "beforeCreate"
//   collection hooks    → "slug:eventName"    e.g. "blog-posts:beforeCreate"
//
// Buckets are kept sorted descending by priority (maintained on insert).

const _buckets = new Map<string, OryCMSHookRegistration[]>();
const _ids = new Set<string>();

// ── Private helpers ───────────────────────────────────────────────────────────

function scopedKey(event: string, scope: string): string {
  return scope === "*" ? event : `${scope}:${event}`;
}

function insertSorted(bucket: OryCMSHookRegistration[], reg: OryCMSHookRegistration): void {
  const idx = bucket.findIndex((h) => h.priority < reg.priority);
  if (idx === -1) bucket.push(reg);
  else bucket.splice(idx, 0, reg);
}

function mergeSorted(
  a: OryCMSHookRegistration[],
  b: OryCMSHookRegistration[],
): OryCMSHookRegistration[] {
  const out: OryCMSHookRegistration[] = [];
  let ai = 0;
  let bi = 0;
  while (ai < a.length && bi < b.length) {
    if (a[ai].priority >= b[bi].priority) out.push(a[ai++]);
    else out.push(b[bi++]);
  }
  while (ai < a.length) out.push(a[ai++]);
  while (bi < b.length) out.push(b[bi++]);
  return out;
}

function registerOne(reg: OryCMSHookRegistration): void {
  if (!reg.id) throw new OryCMSHookError("INVALID_HOOK", "Hook registration requires an id.", 400);
  if (typeof reg.fn !== "function")
    throw new OryCMSHookError("INVALID_HOOK", `Hook "${reg.id}" must have a function.`, 400);
  if (_ids.has(reg.id))
    throw new OryCMSHookError("DUPLICATE_HOOK", `Hook "${reg.id}" is already registered.`, 409);

  _ids.add(reg.id);
  const key = scopedKey(reg.event, reg.scope);
  const bucket = _buckets.get(key) ?? [];
  insertSorted(bucket, reg);
  _buckets.set(key, bucket);
}

// ── Collection-hook event map ─────────────────────────────────────────────────

const COLLECTION_HOOK_EVENTS: Record<keyof OryCMSCollectionHooks, OryCMSHookEventName> = {
  beforeCreate: "beforeCreate",
  afterCreate: "afterCreate",
  beforeUpdate: "beforeUpdate",
  afterUpdate: "afterUpdate",
  beforeDelete: "beforeDelete",
  afterDelete: "afterDelete",
  beforePublish: "beforePublish",
  afterPublish: "afterPublish",
};

// ── Public API ────────────────────────────────────────────────────────────────

export function registerGlobalOryCMSHook(
  event: OryCMSHookEventName,
  fn: OryCMSHookFn,
  options: { id?: string; priority?: number; timeout?: number } = {},
): string {
  const id = options.id ?? `global:${event}:${_ids.size}`;
  registerOne({
    id,
    event,
    fn,
    priority: options.priority ?? 0,
    timeout: options.timeout ?? HOOK_DEFAULT_TIMEOUT_MS,
    scope: "*",
    source: "global",
  });
  return id;
}

export function registerOryCMSPluginHook(
  pluginId: string,
  event: OryCMSHookEventName,
  fn: OryCMSHookFn,
  options: { id?: string; priority?: number; timeout?: number; scope?: string } = {},
): string {
  const scope = options.scope ?? "*";
  const id = options.id ?? `plugin:${pluginId}:${event}:${_ids.size}`;
  registerOne({
    id,
    event,
    fn,
    priority: options.priority ?? 0,
    timeout: options.timeout ?? HOOK_DEFAULT_TIMEOUT_MS,
    scope,
    source: "plugin",
  });
  return id;
}

export function registerOryCMSCollectionHooks(
  collectionSlug: string,
  hooks: OryCMSCollectionHooks,
): void {
  for (const key of Object.keys(COLLECTION_HOOK_EVENTS) as (keyof OryCMSCollectionHooks)[]) {
    const fns = hooks[key];
    if (!fns?.length) continue;
    const event = COLLECTION_HOOK_EVENTS[key];
    fns.forEach((fn, i) => {
      const id = `collection:${collectionSlug}:${key}:${i}`;
      if (_ids.has(id)) return; // idempotent on re-upsert
      registerOne({
        id,
        event,
        fn,
        priority: 0,
        timeout: HOOK_DEFAULT_TIMEOUT_MS,
        scope: collectionSlug,
        source: "collection",
      });
    });
  }
}

export function unregisterOryCMSCollectionHooks(collectionSlug: string): void {
  for (const [key, bucket] of _buckets) {
    const kept = bucket.filter((h) => {
      if (h.source === "collection" && h.scope === collectionSlug) {
        _ids.delete(h.id);
        return false;
      }
      return true;
    });
    if (kept.length === 0) _buckets.delete(key);
    else _buckets.set(key, kept);
  }
}

export function getOryCMSHooksForEvent(
  event: OryCMSHookEventName,
  collectionSlug?: string | null,
): OryCMSHookRegistration[] {
  const global = _buckets.get(event);
  const scoped = collectionSlug ? _buckets.get(scopedKey(event, collectionSlug)) : undefined;
  if (!global && !scoped) return [];
  if (!global) return scoped!;
  if (!scoped) return global;
  return mergeSorted(global, scoped);
}

export function hasOryCMSHooks(
  event: OryCMSHookEventName,
  collectionSlug?: string | null,
): boolean {
  return (
    _buckets.has(event) || (!!collectionSlug && _buckets.has(scopedKey(event, collectionSlug)))
  );
}

export function unregisterOryCMSHookById(id: string): boolean {
  if (!_ids.has(id)) return false;
  _ids.delete(id);
  for (const [key, bucket] of _buckets) {
    const kept = bucket.filter((h) => h.id !== id);
    if (kept.length === 0) _buckets.delete(key);
    else _buckets.set(key, kept);
  }
  return true;
}

export function clearOryCMSHookRegistry(): void {
  _buckets.clear();
  _ids.clear();
}
