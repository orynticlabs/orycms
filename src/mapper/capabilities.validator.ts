import type { OryCMSCollectionDefinition } from "@/schema/collection.schema";
import type {
  OryCMSDatabaseAdapterType,
  OryCMSDatabaseAdapterCapabilities,
} from "@/database/adapter.types";
import type {
  OryCMSCapabilityValidationResult,
  OryCMSCapabilityValidationIssue,
} from "./mapper.types";
import { ORYCMS_DEFAULT_ADAPTER_CAPABILITIES } from "./mapper.types";

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function push(
  issues: OryCMSCapabilityValidationIssue[],
  issue: OryCMSCapabilityValidationIssue,
): void {
  issues.push(issue);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks whether an adapter's declared capabilities satisfy what a given
 * collection schema requires. Returns structured issues rather than throwing.
 *
 * Severity rules:
 *   error   → the adapter cannot meaningfully store/query this data
 *   warning → the adapter supports a degraded form; plan is still generated
 */
export function validateOryCMSAdapterCapabilities(
  collection: OryCMSCollectionDefinition,
  adapterType: OryCMSDatabaseAdapterType,
  capabilities: OryCMSDatabaseAdapterCapabilities = ORYCMS_DEFAULT_ADAPTER_CAPABILITIES[
    adapterType
  ],
): OryCMSCapabilityValidationResult {
  const issues: OryCMSCapabilityValidationIssue[] = [];

  const jsonFields = collection.fields.filter((f) => f.type === "json");
  const relationFields = collection.fields.filter((f) => f.type === "relation");
  const richTextFields = collection.fields.filter((f) => f.type === "richText");

  // ── JSON fields ───────────────────────────────────────────────────

  if (jsonFields.length > 0 && !capabilities.jsonFields) {
    push(issues, {
      code: "UNSUPPORTED_JSON_FIELDS",
      severity: "error",
      capability: "jsonFields",
      message:
        `Adapter "${adapterType}" does not support native JSON fields. ` +
        `Remove json-typed fields or choose a different adapter. ` +
        `Affected fields: ${jsonFields.map((f) => `"${f.name}"`).join(", ")}.`,
    });
  }

  // ── Relation fields ───────────────────────────────────────────────

  if (relationFields.length > 0) {
    if (!capabilities.relations) {
      // MongoDB and Firebase: partial support via document references
      const partial = adapterType === "mongodb" || adapterType === "firebase";
      push(issues, {
        code: partial ? "PARTIAL_RELATION_SUPPORT" : "UNSUPPORTED_RELATIONS",
        severity: partial ? "warning" : "error",
        capability: "relations",
        message: partial
          ? `Adapter "${adapterType}" maps relation fields to document references (no foreign-key enforcement). ` +
            `Referential integrity must be maintained at the application layer. ` +
            `Affected fields: ${relationFields.map((f) => `"${f.name}"`).join(", ")}.`
          : `Adapter "${adapterType}" does not support relation fields. ` +
            `Affected fields: ${relationFields.map((f) => `"${f.name}"`).join(", ")}.`,
      });
    }
  }

  // ── Rich text full-text indexing ──────────────────────────────────

  if (richTextFields.length > 0 && !capabilities.fullTextSearch) {
    push(issues, {
      code: "UNSUPPORTED_FULL_TEXT_SEARCH",
      severity: "warning",
      capability: "fullTextSearch",
      message:
        `Adapter "${adapterType}" does not support full-text search. ` +
        `richText fields will be stored as plain strings without search indexing. ` +
        `Affected fields: ${richTextFields.map((f) => `"${f.name}"`).join(", ")}.`,
    });
  }

  // ── Migration support ─────────────────────────────────────────────

  if (!capabilities.migrations) {
    push(issues, {
      code: "UNSUPPORTED_MIGRATIONS",
      severity: "warning",
      capability: "migrations",
      message:
        `Adapter "${adapterType}" does not support schema migrations. ` +
        `The generated migration plan is for documentation purposes only — ` +
        `apply schema changes manually or via a third-party migration tool.`,
    });
  }

  const errors = issues.filter((i) => i.severity === "error");

  return {
    valid: errors.length === 0,
    issues,
  };
}
