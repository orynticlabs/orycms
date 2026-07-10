import type {
  OryCMSCollectionDefinition,
  OryCMSSchemaValidationIssue,
  OryCMSSchemaValidationResult,
} from "./collection.schema";
import { validateOryCMSCollectionSchema } from "./schema.validator";

// ─────────────────────────────────────────────────────────────────────────────
// Error class
// ─────────────────────────────────────────────────────────────────────────────

export class OryCMSSchemaError extends Error {
  readonly issues: OryCMSSchemaValidationIssue[];

  constructor(message: string, issues: OryCMSSchemaValidationIssue[]) {
    super(message);
    this.name = "OryCMSSchemaError";
    this.issues = issues;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory registry (module-level singleton — reset via clearOryCMSRegistry for tests)
// ─────────────────────────────────────────────────────────────────────────────

const _registry = new Map<string, OryCMSCollectionDefinition>();

function _slugSet(): ReadonlySet<string> {
  return new Set(_registry.keys());
}

function _throw(message: string, issues: OryCMSSchemaValidationIssue[]): never {
  throw new OryCMSSchemaError(message, issues);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public engine functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates a collection definition and returns it typed as OryCMSCollectionDefinition.
 * Throws OryCMSSchemaError if validation fails.
 * Does NOT add to the registry — use registerOryCMSCollection for that.
 */
export function defineOryCMSCollection(
  definition: OryCMSCollectionDefinition,
): OryCMSCollectionDefinition {
  const result = validateOryCMSCollectionSchema(definition);
  if (!result.valid) {
    _throw(`defineOryCMSCollection: "${definition?.slug ?? "??"}" is invalid`, result.issues);
  }
  return definition;
}

/**
 * Validates and adds a collection to the in-memory registry.
 * Throws OryCMSSchemaError on duplicate slug, invalid schema, or unresolved relation targets.
 */
export function registerOryCMSCollection(
  definition: OryCMSCollectionDefinition,
): OryCMSCollectionDefinition {
  const registeredSlugs = _slugSet();
  const registeredCollectionSlugs = _slugSet();

  const result = validateOryCMSCollectionSchema(definition, {
    registeredSlugs,
    registeredCollectionSlugs,
  });

  if (!result.valid) {
    _throw(
      `registerOryCMSCollection: cannot register "${definition?.slug ?? "??"}"`,
      result.issues,
    );
  }

  _registry.set(definition.slug, definition);
  return definition;
}

/**
 * Returns a registered collection definition by slug, or null if not found.
 */
export function getOryCMSCollection(slug: string): OryCMSCollectionDefinition | null {
  return _registry.get(slug) ?? null;
}

/**
 * Returns all registered collection definitions in insertion order.
 */
export function listOryCMSCollections(): OryCMSCollectionDefinition[] {
  return Array.from(_registry.values());
}

/**
 * Merges updates into an existing collection definition, re-validates, and persists.
 * The slug is immutable — pass it as the first argument, not inside updates.
 * Throws OryCMSSchemaError if the collection is not found or the merged schema is invalid.
 */
export function updateOryCMSCollectionSchema(
  slug: string,
  updates: Omit<Partial<OryCMSCollectionDefinition>, "slug">,
): OryCMSCollectionDefinition {
  const existing = _registry.get(slug);
  if (!existing) {
    _throw(`updateOryCMSCollectionSchema: no collection with slug "${slug}"`, [
      { code: "COLLECTION_NOT_FOUND", message: `No collection registered with slug "${slug}"` },
    ]);
  }

  const merged: OryCMSCollectionDefinition = { ...existing, ...updates, slug };

  // Exclude current slug from duplicate check (we're updating in-place)
  const otherSlugs = new Set(_registry.keys());
  otherSlugs.delete(slug);

  const result = validateOryCMSCollectionSchema(merged, {
    registeredSlugs: otherSlugs,
    registeredCollectionSlugs: _slugSet(),
  });

  if (!result.valid) {
    _throw(`updateOryCMSCollectionSchema: updated schema for "${slug}" is invalid`, result.issues);
  }

  _registry.set(slug, merged);
  return merged;
}

/**
 * Removes a collection from the registry.
 * Throws OryCMSSchemaError if the slug is not registered.
 */
export function removeOryCMSCollection(slug: string): void {
  if (!_registry.has(slug)) {
    _throw(`removeOryCMSCollection: no collection with slug "${slug}"`, [
      { code: "COLLECTION_NOT_FOUND", message: `No collection registered with slug "${slug}"` },
    ]);
  }
  _registry.delete(slug);
}

/**
 * Pure validation — wraps the validator with optional registry context.
 * Does not throw. Returns all issues found.
 */
export function validateOryCMSCollectionSchemaPure(
  definition: unknown,
): OryCMSSchemaValidationResult {
  return validateOryCMSCollectionSchema(definition, {
    registeredSlugs: _slugSet(),
    registeredCollectionSlugs: _slugSet(),
  });
}

/**
 * Clears the in-memory registry. Intended for tests only.
 */
export function clearOryCMSRegistry(): void {
  _registry.clear();
}
