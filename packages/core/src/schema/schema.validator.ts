import type {
  OryCMSSchemaValidationResult,
  OryCMSSchemaValidationIssue,
  OryCMSSchemaFieldType,
} from "./collection.schema";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Valid lowercase kebab-case: starts with a letter, no leading/trailing/consecutive hyphens. */
const SLUG_REGEX = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

const RESERVED_SLUGS = new Set([
  "id",
  "type",
  "status",
  "created-at",
  "updated-at",
  "published-at",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Table and column name safety
//
// A collection's table name (the slug, underscored, or an explicit override)
// and every field's name end up spliced into generated SQL as an identifier
// (see the mapper, schema diff and migration planner). Checked here, before
// any of that happens, so an unsafe name is refused at the point it is saved
// rather than relying on quoting alone to make it harmless later.
// ─────────────────────────────────────────────────────────────────────────────

/** A safe, unquoted-style SQL identifier: starts with a letter or underscore, then
 * letters, digits or underscores, at most 63 characters (Postgres' own identifier
 * length limit). */
const IDENTIFIER_REGEX = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

/** Every table this library creates for itself starts with this prefix; a collection
 * submitted through the API may never resolve to a table name that could collide
 * with one. Collections this library registers for itself at startup are exempt —
 * see the `allowCoreTablePrefix` validator option. */
const CORE_TABLE_PREFIX = "orycms_";

/** Columns every collection table may already have, depending on its settings —
 * a field may never reuse one of these names. */
const SYSTEM_COLUMN_NAMES = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "_isDraft",
  "_publishedAt",
  "_seoTitle",
  "_seoDescription",
  "_seoImage",
]);

/** The table name a collection definition resolves to — mirrors the formula used
 * by the mapper, content engine and persistence layer (`tableName ?? slug`,
 * dashes to underscores). */
function resolveTableName(def: { tableName?: unknown; slug?: unknown }): string | undefined {
  if (isNonEmptyString(def.tableName)) return def.tableName;
  if (isNonEmptyString(def.slug)) return def.slug.replace(/-/g, "_");
  return undefined;
}

const VALID_FIELD_TYPES = new Set<OryCMSSchemaFieldType>([
  "text",
  "textarea",
  "richText",
  "number",
  "boolean",
  "date",
  "email",
  "password",
  "select",
  "relation",
  "media",
  "json",
  "slug",
]);

const VALID_RELATION_CARDINALITIES = new Set(["one", "many"]);

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function push(issues: OryCMSSchemaValidationIssue[], issue: OryCMSSchemaValidationIssue): void {
  issues.push(issue);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Public validator
// ─────────────────────────────────────────────────────────────────────────────

export interface OryCMSValidatorOptions {
  /**
   * If provided, the validator also checks for duplicate slug registration.
   * Pass the current registry's slug set from the engine.
   */
  registeredSlugs?: ReadonlySet<string>;
  /**
   * If provided, relation targets are checked against the registered collection slugs.
   */
  registeredCollectionSlugs?: ReadonlySet<string>;
  /**
   * Table names already in use by other collections (lowercased), so two collections
   * can never resolve to the same physical table.
   */
  registeredTableNames?: ReadonlySet<string>;
  /**
   * Allows a table name under this library's own reserved prefix. Set only for the
   * collections this library registers for itself at startup — never for anything
   * reaching the validator from the collections API.
   */
  allowCoreTablePrefix?: boolean;
}

/**
 * Validates an OryCMS collection definition without touching the registry.
 * Returns every issue found — does NOT throw.
 */
export function validateOryCMSCollectionSchema(
  definition: unknown,
  options: OryCMSValidatorOptions = {},
): OryCMSSchemaValidationResult {
  const issues: OryCMSSchemaValidationIssue[] = [];

  if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
    return {
      valid: false,
      issues: [
        {
          code: "MISSING_REQUIRED_PROPERTY",
          message: "Collection definition must be a plain object",
        },
      ],
    };
  }

  const def = definition as Record<string, unknown>;

  // ── name ──────────────────────────────────────────────────────────────────

  if (!isNonEmptyString(def.name)) {
    push(issues, {
      code: "MISSING_REQUIRED_PROPERTY",
      path: "name",
      message: "name is required and must be a non-empty string",
    });
  }

  // ── slug ──────────────────────────────────────────────────────────────────

  if (!isNonEmptyString(def.slug)) {
    push(issues, {
      code: "MISSING_REQUIRED_PROPERTY",
      path: "slug",
      message: "slug is required and must be a non-empty string",
    });
  } else if (RESERVED_SLUGS.has(def.slug)) {
    push(issues, {
      code: "RESERVED_SLUG",
      path: "slug",
      message: `"${def.slug}" is a reserved identifier and cannot be used as a collection slug`,
    });
  } else if (!SLUG_REGEX.test(def.slug)) {
    push(issues, {
      code: "INVALID_SLUG_FORMAT",
      path: "slug",
      message: `slug "${def.slug}" must be lowercase kebab-case starting with a letter (e.g. "blog-posts")`,
    });
  } else if (options.registeredSlugs?.has(def.slug)) {
    push(issues, {
      code: "DUPLICATE_SLUG",
      path: "slug",
      message: `A collection with slug "${def.slug}" is already registered`,
    });
  }

  // ── tableName (explicit override, or derived from slug) ─────────────────────
  //
  // Whatever table name the collection resolves to, it ends up unquoted-identifier
  // safe, never under the reserved `orycms_` prefix, never a bare SQL reserved word,
  // and never shared with another collection — whether that name was typed in
  // directly or derived automatically from an already-valid slug.

  if (def.tableName !== undefined) {
    if (!isNonEmptyString(def.tableName)) {
      push(issues, {
        code: "INVALID_TABLE_NAME_FORMAT",
        path: "tableName",
        message: "tableName must be a non-empty string when provided",
      });
    } else if (!IDENTIFIER_REGEX.test(def.tableName)) {
      push(issues, {
        code: "INVALID_TABLE_NAME_FORMAT",
        path: "tableName",
        message:
          "tableName must start with a letter or underscore, contain only letters, digits " +
          "and underscores, and be at most 63 characters",
      });
    }
  }

  const resolvedTableName = resolveTableName(def);
  const tableNamePath = isNonEmptyString(def.tableName) ? "tableName" : "slug";

  if (resolvedTableName && IDENTIFIER_REGEX.test(resolvedTableName)) {
    if (
      !options.allowCoreTablePrefix &&
      resolvedTableName.toLowerCase().startsWith(CORE_TABLE_PREFIX)
    ) {
      push(issues, {
        code: "RESERVED_TABLE_NAME",
        path: tableNamePath,
        message: `"${resolvedTableName}" starts with the reserved "${CORE_TABLE_PREFIX}" prefix used by this library's own tables`,
      });
    } else if (options.registeredTableNames?.has(resolvedTableName.toLowerCase())) {
      push(issues, {
        code: "DUPLICATE_TABLE_NAME",
        path: tableNamePath,
        message: `Table name "${resolvedTableName}" is already used by another collection`,
      });
    }
  }

  // ── labels ─────────────────────────────────────────────────────────────────

  const labels = def.labels as Record<string, unknown> | undefined;

  if (!labels || typeof labels !== "object" || Array.isArray(labels)) {
    push(issues, {
      code: "MISSING_REQUIRED_PROPERTY",
      path: "labels",
      message: "labels is required",
    });
  } else {
    if (!isNonEmptyString(labels.singular)) {
      push(issues, {
        code: "MISSING_REQUIRED_PROPERTY",
        path: "labels.singular",
        message: "labels.singular is required",
      });
    }
    if (!isNonEmptyString(labels.plural)) {
      push(issues, {
        code: "MISSING_REQUIRED_PROPERTY",
        path: "labels.plural",
        message: "labels.plural is required",
      });
    }
  }

  // ── fields ─────────────────────────────────────────────────────────────────

  if (!Array.isArray(def.fields)) {
    push(issues, {
      code: "MISSING_REQUIRED_PROPERTY",
      path: "fields",
      message: "fields must be an array (may be empty)",
    });
    return { valid: issues.length === 0, issues };
  }

  // Collect all field names up-front so slug.sourceField can be cross-referenced
  const allFieldNames = (def.fields as unknown[]).flatMap((f) =>
    f &&
    typeof f === "object" &&
    !Array.isArray(f) &&
    isNonEmptyString((f as Record<string, unknown>).name)
      ? [(f as Record<string, unknown>).name as string]
      : [],
  );

  const seenFieldNames = new Set<string>();

  for (let i = 0; i < def.fields.length; i++) {
    const raw = def.fields[i];
    const p = `fields[${i}]`;

    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      push(issues, {
        code: "MISSING_REQUIRED_PROPERTY",
        path: p,
        message: `Field at index ${i} must be a plain object`,
      });
      continue;
    }

    const field = raw as Record<string, unknown>;
    const fieldName = isNonEmptyString(field.name) ? field.name : undefined;

    // name
    if (!fieldName) {
      push(issues, {
        code: "MISSING_FIELD_NAME",
        path: `${p}.name`,
        message: `Field at index ${i} is missing a name`,
      });
    } else if (seenFieldNames.has(fieldName)) {
      push(issues, {
        code: "DUPLICATE_FIELD_NAME",
        path: `${p}.name`,
        fieldName,
        message: `Duplicate field name "${fieldName}" in collection`,
      });
    } else if (!IDENTIFIER_REGEX.test(fieldName)) {
      push(issues, {
        code: "INVALID_FIELD_NAME_FORMAT",
        path: `${p}.name`,
        fieldName,
        message:
          `Field name "${fieldName}" must start with a letter or underscore, contain only ` +
          "letters, digits and underscores, and be at most 63 characters",
      });
      seenFieldNames.add(fieldName);
    } else if (SYSTEM_COLUMN_NAMES.has(fieldName)) {
      push(issues, {
        code: "SYSTEM_FIELD_NAME",
        path: `${p}.name`,
        fieldName,
        message: `Field name "${fieldName}" is reserved for a system column`,
      });
      seenFieldNames.add(fieldName);
    } else {
      seenFieldNames.add(fieldName);
    }

    // type
    if (!isNonEmptyString(field.type)) {
      push(issues, {
        code: "MISSING_FIELD_TYPE",
        path: `${p}.type`,
        fieldName,
        message: `Field "${fieldName ?? i}" is missing a type`,
      });
      continue;
    }

    if (!VALID_FIELD_TYPES.has(field.type as OryCMSSchemaFieldType)) {
      push(issues, {
        code: "INVALID_FIELD_TYPE",
        path: `${p}.type`,
        fieldName,
        message: `Field "${fieldName}" has unsupported type "${field.type}". Valid types: ${[...VALID_FIELD_TYPES].join(", ")}`,
      });
      continue;
    }

    // ── Type-specific validation ────────────────────────────────────────────

    switch (field.type as OryCMSSchemaFieldType) {
      case "select": {
        const opts = field.options;
        if (!Array.isArray(opts) || opts.length === 0) {
          push(issues, {
            code: "EMPTY_SELECT_OPTIONS",
            path: `${p}.options`,
            fieldName,
            message: `Select field "${fieldName}" must have at least one option`,
          });
        } else {
          for (let j = 0; j < opts.length; j++) {
            const opt = opts[j] as Record<string, unknown>;
            if (
              !opt ||
              typeof opt !== "object" ||
              !isNonEmptyString(opt.label) ||
              !isNonEmptyString(opt.value)
            ) {
              push(issues, {
                code: "INVALID_SELECT_OPTION",
                path: `${p}.options[${j}]`,
                fieldName,
                message: `Option at index ${j} in select field "${fieldName}" must have non-empty label and value strings`,
              });
            }
          }
        }
        break;
      }

      case "relation": {
        if (!isNonEmptyString(field.target)) {
          push(issues, {
            code: "MISSING_RELATION_TARGET",
            path: `${p}.target`,
            fieldName,
            message: `Relation field "${fieldName}" must specify a target collection slug`,
          });
        } else if (!SLUG_REGEX.test(field.target)) {
          push(issues, {
            code: "INVALID_RELATION_TARGET_FORMAT",
            path: `${p}.target`,
            fieldName,
            message: `Relation field "${fieldName}" target "${field.target}" is not valid kebab-case`,
          });
        } else if (
          options.registeredCollectionSlugs &&
          !options.registeredCollectionSlugs.has(field.target)
        ) {
          push(issues, {
            code: "UNRESOLVED_RELATION_TARGET",
            path: `${p}.target`,
            fieldName,
            message: `Relation field "${fieldName}" targets "${field.target}" which is not registered`,
          });
        }

        if (!isNonEmptyString(field.cardinality)) {
          push(issues, {
            code: "MISSING_RELATION_CARDINALITY",
            path: `${p}.cardinality`,
            fieldName,
            message: `Relation field "${fieldName}" must specify cardinality`,
          });
        } else if (!VALID_RELATION_CARDINALITIES.has(field.cardinality)) {
          push(issues, {
            code: "INVALID_RELATION_CARDINALITY",
            path: `${p}.cardinality`,
            fieldName,
            message: `Relation field "${fieldName}" cardinality must be "one" or "many", got "${field.cardinality}"`,
          });
        }
        break;
      }

      case "slug": {
        if (!isNonEmptyString(field.sourceField)) {
          push(issues, {
            code: "MISSING_SLUG_SOURCE_FIELD",
            path: `${p}.sourceField`,
            fieldName,
            message: `Slug field "${fieldName}" must specify a sourceField`,
          });
        } else if (!allFieldNames.includes(field.sourceField)) {
          push(issues, {
            code: "SLUG_SOURCE_FIELD_NOT_FOUND",
            path: `${p}.sourceField`,
            fieldName,
            message: `Slug field "${fieldName}" references sourceField "${field.sourceField}" which does not exist in this collection`,
          });
        }
        break;
      }

      // text, textarea, richText, number, boolean, date, email, password, media, json
      // have no extra required properties — type-check is sufficient
      default:
        break;
    }
  }

  return { valid: issues.length === 0, issues };
}
