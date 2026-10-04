import type { OryCMSCollectionDefinition, OryCMSSchemaField } from "@/schema";
import type { OryCMSContentData } from "@/types";
import { OryCMSContentError } from "./content.errors";

/** System fields injected by the engine — never treated as user-defined fields. */
export const SYSTEM_FIELDS = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "_isDraft",
  "_publishedAt",
  "_seoTitle",
  "_seoDescription",
  "_seoImage",
]);

/** The only filter operators the query layer knows how to translate to SQL. */
export const VALID_QUERY_OPERATORS = new Set([
  "eq",
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "nin",
  "contains",
  "startsWith",
  "endsWith",
]);

/** True if `field` is a real column on this collection's table (declared field or system column). */
function isKnownQueryField(collection: OryCMSCollectionDefinition, field: string): boolean {
  return SYSTEM_FIELDS.has(field) || collection.fields.some((f) => f.name === field);
}

/**
 * Validates a single filter entry before it is turned into SQL.
 * Throws OryCMSContentError (400) if the field isn't a real column on this
 * collection, or the operator isn't one of the fixed set the engine supports.
 */
export function validateOryCMSQueryFilter(
  collection: OryCMSCollectionDefinition,
  filter: { field: string; operator: string },
): void {
  if (!isKnownQueryField(collection, filter.field)) {
    throw new OryCMSContentError(
      "FIELD_UNKNOWN",
      `Unknown field "${filter.field}" in collection "${collection.slug}".`,
      400,
      filter.field,
    );
  }
  if (!VALID_QUERY_OPERATORS.has(filter.operator)) {
    throw new OryCMSContentError(
      "OPERATOR_INVALID",
      `Unsupported filter operator "${filter.operator}".`,
      400,
      filter.field,
    );
  }
}

/**
 * Validates a single sort entry before it is turned into SQL.
 * Throws OryCMSContentError (400) if the field isn't a real column on this
 * collection, or the direction isn't "asc"/"desc".
 */
export function validateOryCMSSortField(
  collection: OryCMSCollectionDefinition,
  sort: { field: string; direction: string },
): void {
  if (!isKnownQueryField(collection, sort.field)) {
    throw new OryCMSContentError(
      "FIELD_UNKNOWN",
      `Unknown field "${sort.field}" in collection "${collection.slug}".`,
      400,
      sort.field,
    );
  }
  if (sort.direction !== "asc" && sort.direction !== "desc") {
    throw new OryCMSContentError(
      "OPERATOR_INVALID",
      `Unsupported sort direction "${sort.direction}".`,
      400,
      sort.field,
    );
  }
}

/**
 * Validates content data against the collection schema.
 * Throws OryCMSContentError on the first violation found.
 * - Rejects fields not defined in the schema (unknown fields)
 * - Enforces required fields (on create; requireAll=true)
 * - Skips private-field write rejection (that's a read concern)
 */
export function validateOryCMSContentData(
  collection: OryCMSCollectionDefinition,
  data: OryCMSContentData,
  /** true = full create validation (required fields), false = partial update */
  requireAll: boolean,
): void {
  const knownFields = new Map<string, OryCMSSchemaField>(collection.fields.map((f) => [f.name, f]));

  // 1. Reject unknown fields
  for (const key of Object.keys(data)) {
    if (!knownFields.has(key) && !SYSTEM_FIELDS.has(key)) {
      throw new OryCMSContentError(
        "FIELD_UNKNOWN",
        `Unknown field "${key}" in collection "${collection.slug}".`,
        422,
        key,
      );
    }
  }

  // 2. Enforce required fields (create only)
  if (requireAll) {
    for (const field of collection.fields) {
      if (field.required && !(field.name in data) && field.defaultValue === undefined) {
        throw new OryCMSContentError(
          "FIELD_REQUIRED",
          `Field "${field.name}" is required in collection "${collection.slug}".`,
          422,
          field.name,
        );
      }
    }
  }

  // 3. Basic type coercion checks on provided values
  for (const [key, value] of Object.entries(data)) {
    const field = knownFields.get(key);
    if (!field || value === null || value === undefined) continue;

    switch (field.type) {
      case "number":
        if (typeof value !== "number") {
          throw new OryCMSContentError(
            "FIELD_INVALID",
            `Field "${key}" must be a number.`,
            422,
            key,
          );
        }
        break;
      case "boolean":
        if (typeof value !== "boolean") {
          throw new OryCMSContentError(
            "FIELD_INVALID",
            `Field "${key}" must be a boolean.`,
            422,
            key,
          );
        }
        break;
      case "email": {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (typeof value !== "string" || !emailRegex.test(value)) {
          throw new OryCMSContentError(
            "FIELD_INVALID",
            `Field "${key}" must be a valid email address.`,
            422,
            key,
          );
        }
        break;
      }
      case "select":
        if (field.multiple) {
          if (!Array.isArray(value)) {
            throw new OryCMSContentError(
              "FIELD_INVALID",
              `Field "${key}" must be an array for multi-select.`,
              422,
              key,
            );
          }
        } else {
          const allowed = field.options.map((o) => o.value);
          if (!allowed.includes(String(value))) {
            throw new OryCMSContentError(
              "FIELD_INVALID",
              `Field "${key}" must be one of: ${allowed.join(", ")}.`,
              422,
              key,
            );
          }
        }
        break;
    }
  }
}

/**
 * Returns a copy of the data with all private fields removed.
 */
export function stripOryCMSPrivateFields(
  collection: OryCMSCollectionDefinition,
  data: OryCMSContentData,
): OryCMSContentData {
  const privateNames = new Set(collection.fields.filter((f) => f.private).map((f) => f.name));
  if (privateNames.size === 0) return data;
  return Object.fromEntries(Object.entries(data).filter(([k]) => !privateNames.has(k)));
}
