import type { OryCMSCollectionDefinition, OryCMSSchemaField } from "@/schema";
import type { OryCMSContentData } from "@/types";
import { OryCMSContentError } from "./content.errors";

/** System fields injected by the engine — never treated as user-defined fields. */
const SYSTEM_FIELDS = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "_isDraft",
  "_publishedAt",
  "_seoTitle",
  "_seoDescription",
  "_seoImage",
]);

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
