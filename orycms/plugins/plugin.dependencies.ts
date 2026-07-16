import type { OryCMSPluginManifest } from "./plugin.manifest";

// ── Types ─────────────────────────────────────────────────────────────────────

export type OryCMSDependencyIssueCode =
  "MISSING_DEPENDENCY" | "INCOMPATIBLE_VERSION" | "CIRCULAR_DEPENDENCY" | "DUPLICATE_PLUGIN";

export type OryCMSDependencyIssue = {
  code: OryCMSDependencyIssueCode;
  plugin: string;
  dependency?: string;
  required?: string;
  found?: string;
  message: string;
};

export type OryCMSDependencyResult = {
  valid: boolean;
  errors: OryCMSDependencyIssue[];
  loadOrder: string[];
};

// ── Minimal semver subset ─────────────────────────────────────────────────────
// ponytail: covers ^, ~, >=, >, <=, <, exact, *, || and compound ranges.
// Pre-release identifiers are not supported.

type SemVer = [number, number, number];

function parseVer(s: string): SemVer | null {
  const m = /^[v=]?(\d+)\.(\d+)\.(\d+)/.exec(s.trim());
  return m ? [+m[1], +m[2], +m[3]] : null;
}

function cmpVer(a: SemVer, b: SemVer): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

function satisfies(version: string, range: string): boolean {
  range = range.trim();
  if (!range || range === "*") return true;

  if (range.includes("||")) return range.split("||").some((r) => satisfies(version, r.trim()));

  const parts = range.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return parts.every((r) => satisfies(version, r));

  const v = parseVer(version);
  if (!v) return false;

  if (range.startsWith("^")) {
    const r = parseVer(range.slice(1));
    if (!r) return false;
    return cmpVer(v, r) >= 0 && cmpVer(v, [r[0] + 1, 0, 0]) < 0;
  }
  if (range.startsWith("~")) {
    const r = parseVer(range.slice(1));
    if (!r) return false;
    return cmpVer(v, r) >= 0 && cmpVer(v, [r[0], r[1] + 1, 0]) < 0;
  }
  if (range.startsWith(">=")) {
    const r = parseVer(range.slice(2));
    return r !== null && cmpVer(v, r) >= 0;
  }
  if (range.startsWith("<=")) {
    const r = parseVer(range.slice(2));
    return r !== null && cmpVer(v, r) <= 0;
  }
  if (range.startsWith(">")) {
    const r = parseVer(range.slice(1));
    return r !== null && cmpVer(v, r) > 0;
  }
  if (range.startsWith("<")) {
    const r = parseVer(range.slice(1));
    return r !== null && cmpVer(v, r) < 0;
  }
  const r = parseVer(range);
  return r !== null && cmpVer(v, r) === 0;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildIndex(manifests: OryCMSPluginManifest[]): Map<string, OryCMSPluginManifest> {
  const map = new Map<string, OryCMSPluginManifest>();
  for (const m of manifests) {
    if (!map.has(m.id)) map.set(m.id, m);
  }
  return map;
}

/** All dependency IDs of a plugin that are present in the registry. */
function knownDeps(m: OryCMSPluginManifest, byId: Map<string, OryCMSPluginManifest>): string[] {
  const ids = new Set([
    ...Object.keys(m.dependencies ?? {}),
    ...Object.keys(m.peerDependencies ?? {}),
  ]);
  return [...ids].filter((id) => byId.has(id));
}

/**
 * Kahn's topological sort. `edges` maps each plugin to its in-set dependencies.
 * Returns `{ order, cyclic }` where `cyclic` holds nodes excluded due to cycles.
 * Sort is deterministic: ties broken alphabetically.
 */
function kahn(ids: string[], edges: Map<string, string[]>): { order: string[]; cyclic: string[] } {
  const inDeg = new Map(ids.map((id) => [id, 0]));
  // rev[dep] = list of plugins that depend on dep
  const rev = new Map(ids.map((id) => [id, [] as string[]]));

  for (const id of ids) {
    for (const dep of edges.get(id) ?? []) {
      rev.get(dep)!.push(id);
      inDeg.set(id, inDeg.get(id)! + 1);
    }
  }

  const queue = ids.filter((id) => inDeg.get(id) === 0).sort();
  const order: string[] = [];

  while (queue.length) {
    queue.sort();
    const id = queue.shift()!;
    order.push(id);
    for (const dep of (rev.get(id) ?? []).sort()) {
      const d = inDeg.get(dep)! - 1;
      inDeg.set(dep, d);
      if (d === 0) queue.push(dep);
    }
  }

  return { order, cyclic: ids.filter((id) => !order.includes(id)) };
}

/** DFS cycle detection. Returns one error per unique cycle path. */
function detectCycles(ids: string[], edges: Map<string, string[]>): OryCMSDependencyIssue[] {
  const errors: OryCMSDependencyIssue[] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const stack: string[] = [];
  const seen = new Set<string>();

  function dfs(id: string): void {
    if (inStack.has(id)) {
      const start = stack.indexOf(id);
      const cycle = [...stack.slice(start), id];
      const key = [...cycle].sort().join("\0");
      if (!seen.has(key)) {
        seen.add(key);
        errors.push({
          code: "CIRCULAR_DEPENDENCY",
          plugin: id,
          message: `Circular dependency: ${cycle.join(" → ")}`,
        });
      }
      return;
    }
    if (visited.has(id)) return;
    visited.add(id);
    inStack.add(id);
    stack.push(id);
    for (const dep of (edges.get(id) ?? []).sort()) dfs(dep);
    stack.pop();
    inStack.delete(id);
  }

  for (const id of [...ids].sort()) {
    if (!visited.has(id)) dfs(id);
  }
  return errors;
}

function checkDepSet(
  pluginId: string,
  deps: Record<string, string> | undefined,
  kind: "dependency" | "peer dependency",
  byId: Map<string, OryCMSPluginManifest>,
  errors: OryCMSDependencyIssue[],
): void {
  for (const [depId, range] of Object.entries(deps ?? {})) {
    const dep = byId.get(depId);
    if (!dep) {
      errors.push({
        code: "MISSING_DEPENDENCY",
        plugin: pluginId,
        dependency: depId,
        required: range,
        message: `Plugin "${pluginId}" requires ${kind} "${depId}@${range}" which is not present.`,
      });
      continue;
    }
    if (!satisfies(dep.version, range)) {
      errors.push({
        code: "INCOMPATIBLE_VERSION",
        plugin: pluginId,
        dependency: depId,
        required: range,
        found: dep.version,
        message: `Plugin "${pluginId}" requires ${kind} "${depId}@${range}" but found "${dep.version}".`,
      });
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Validate dependency constraints for a set of plugin manifests.
 * Returns a (possibly empty) array of typed issues without throwing.
 */
export function validateOryCMSPluginDependencies(
  manifests: OryCMSPluginManifest[],
): OryCMSDependencyIssue[] {
  const errors: OryCMSDependencyIssue[] = [];
  const byId = new Map<string, OryCMSPluginManifest>();

  for (const m of manifests) {
    if (byId.has(m.id)) {
      errors.push({
        code: "DUPLICATE_PLUGIN",
        plugin: m.id,
        message: `Duplicate plugin id "${m.id}".`,
      });
    } else {
      byId.set(m.id, m);
    }
  }

  for (const m of byId.values()) {
    checkDepSet(m.id, m.dependencies, "dependency", byId, errors);
    checkDepSet(m.id, m.peerDependencies, "peer dependency", byId, errors);
  }

  const ids = [...byId.keys()];
  const edges = new Map(ids.map((id) => [id, knownDeps(byId.get(id)!, byId)]));
  errors.push(...detectCycles(ids, edges));

  return errors;
}

/**
 * Return the correct plugin load order (dependencies first).
 * Throws when a circular dependency makes ordering impossible.
 */
export function getOryCMSPluginLoadOrder(manifests: OryCMSPluginManifest[]): string[] {
  const byId = buildIndex(manifests);
  const ids = [...byId.keys()];
  const edges = new Map(ids.map((id) => [id, knownDeps(byId.get(id)!, byId)]));
  const { order, cyclic } = kahn(ids, edges);

  if (cyclic.length > 0) {
    throw new Error(
      `Cannot determine load order: circular dependency involving ${cyclic.sort().join(", ")}`,
    );
  }
  return order;
}

/**
 * Validate dependencies and produce a load order in one call.
 * `loadOrder` is empty when circular dependencies are present.
 */
export function resolveOryCMSPluginDependencies(
  manifests: OryCMSPluginManifest[],
): OryCMSDependencyResult {
  const errors = validateOryCMSPluginDependencies(manifests);
  const hasCycles = errors.some((e) => e.code === "CIRCULAR_DEPENDENCY");
  let loadOrder: string[] = [];
  if (!hasCycles) {
    try {
      loadOrder = getOryCMSPluginLoadOrder(manifests);
    } catch {
      loadOrder = [];
    }
  }
  return { valid: errors.length === 0, errors, loadOrder };
}
