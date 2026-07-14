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
