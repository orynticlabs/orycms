// ─────────────────────────────────────────────────────────────────────────────
// Field types supported by the OryCMS schema engine
// ─────────────────────────────────────────────────────────────────────────────

export type OryCMSSchemaFieldType =
  | "text"
  | "textarea"
  | "richText"
  | "number"
  | "boolean"
  | "date"
  | "email"
  | "password"
  | "select"
  | "relation"
  | "media"
  | "json"
  | "slug";

// ─────────────────────────────────────────────────────────────────────────────
// Base interface shared by all field types
// ─────────────────────────────────────────────────────────────────────────────

export interface OryCMSSchemaFieldBase {
  name: string;
  label?: string;
  description?: string;
  required?: boolean;
  unique?: boolean;
  /** Omit this field from public API responses. */
  private?: boolean;
  defaultValue?: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Concrete field type interfaces (discriminated by `type`)
// ─────────────────────────────────────────────────────────────────────────────

export interface OryCMSSchemaTextField extends OryCMSSchemaFieldBase {
  type: "text";
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  pattern?: string;
}

export interface OryCMSSchemaTextareaField extends OryCMSSchemaFieldBase {
  type: "textarea";
  minLength?: number;
  maxLength?: number;
  rows?: number;
}

export interface OryCMSSchemaRichTextField extends OryCMSSchemaFieldBase {
  type: "richText";
}

export interface OryCMSSchemaNumberField extends OryCMSSchemaFieldBase {
  type: "number";
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
}

export interface OryCMSSchemaBooleanField extends OryCMSSchemaFieldBase {
  type: "boolean";
}

export interface OryCMSSchemaDateField extends OryCMSSchemaFieldBase {
  type: "date";
  includeTime?: boolean;
  min?: string;
  max?: string;
}

export interface OryCMSSchemaEmailField extends OryCMSSchemaFieldBase {
  type: "email";
}

export interface OryCMSSchemaPasswordField extends OryCMSSchemaFieldBase {
  type: "password";
  minLength?: number;
}

export interface OryCMSSchemaSelectOption {
  label: string;
  value: string;
}

export interface OryCMSSchemaSelectField extends OryCMSSchemaFieldBase {
  type: "select";
  /** At least one option is required. */
  options: OryCMSSchemaSelectOption[];
  multiple?: boolean;
}

export type OryCMSSchemaRelationCardinality = "one" | "many";

export interface OryCMSSchemaRelationField extends OryCMSSchemaFieldBase {
  type: "relation";
  /** Slug of the target collection. */
  target: string;
  cardinality: OryCMSSchemaRelationCardinality;
  cascadeDelete?: boolean;
}

export interface OryCMSSchemaMediaField extends OryCMSSchemaFieldBase {
  type: "media";
  allowedTypes?: ("image" | "video" | "audio" | "document")[];
  multiple?: boolean;
}

export interface OryCMSSchemaJsonField extends OryCMSSchemaFieldBase {
  type: "json";
}

export interface OryCMSSchemaSlugField extends OryCMSSchemaFieldBase {
  type: "slug";
  /** Name of the sibling field to auto-generate this slug from. */
  sourceField: string;
}

// Discriminated union — narrows to the correct interface on `switch (field.type)`
export type OryCMSSchemaField =
  | OryCMSSchemaTextField
  | OryCMSSchemaTextareaField
  | OryCMSSchemaRichTextField
  | OryCMSSchemaNumberField
  | OryCMSSchemaBooleanField
  | OryCMSSchemaDateField
  | OryCMSSchemaEmailField
  | OryCMSSchemaPasswordField
  | OryCMSSchemaSelectField
  | OryCMSSchemaRelationField
  | OryCMSSchemaMediaField
  | OryCMSSchemaJsonField
  | OryCMSSchemaSlugField;

// ─────────────────────────────────────────────────────────────────────────────
// Collection support configs
// ─────────────────────────────────────────────────────────────────────────────

export interface OryCMSCollectionLabels {
  singular: string;
  plural: string;
  /** Optional override for the sidebar menu label. */
  menu?: string;
}

export interface OryCMSCollectionTimestampsConfig {
  enabled: boolean;
  /** Defaults to "createdAt". */
  createdAtField?: string;
  /** Defaults to "updatedAt". */
  updatedAtField?: string;
}

export interface OryCMSCollectionDraftConfig {
  enabled: boolean;
}

export interface OryCMSCollectionSeoConfig {
  enabled: boolean;
  /** Field name whose value maps to the SEO title. */
  titleField?: string;
  /** Field name whose value maps to the SEO description. */
  descriptionField?: string;
  /** Field name whose value maps to the OG image. */
  imageField?: string;
}

export interface OryCMSCollectionAccess {
  create?: string[];
  read?: string[];
  update?: string[];
  delete?: string[];
  publish?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-level collection definition — the developer-facing schema DSL
// ─────────────────────────────────────────────────────────────────────────────

import type { OryCMSCollectionHooks } from "@/hooks";

export interface OryCMSCollectionDefinition {
  /** Human-readable name, e.g. "Blog Post". */
  name: string;
  /** Lowercase kebab-case identifier, e.g. "blog-posts". Must be unique. */
  slug: string;
  labels: OryCMSCollectionLabels;
  description?: string;
  /** Override the database table / collection name. Defaults to slug. */
  tableName?: string;
  fields: OryCMSSchemaField[];
  timestamps?: OryCMSCollectionTimestampsConfig;
  draft?: OryCMSCollectionDraftConfig;
  seo?: OryCMSCollectionSeoConfig;
  access?: OryCMSCollectionAccess;
  /** Lifecycle hooks invoked around content operations for this collection. */
  hooks?: OryCMSCollectionHooks;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation types
// ─────────────────────────────────────────────────────────────────────────────

export type OryCMSSchemaValidationCode =
  | "MISSING_REQUIRED_PROPERTY"
  | "INVALID_SLUG_FORMAT"
  | "RESERVED_SLUG"
  | "DUPLICATE_SLUG"
  | "DUPLICATE_FIELD_NAME"
  | "MISSING_FIELD_NAME"
  | "MISSING_FIELD_TYPE"
  | "INVALID_FIELD_TYPE"
  | "EMPTY_SELECT_OPTIONS"
  | "INVALID_SELECT_OPTION"
  | "MISSING_RELATION_TARGET"
  | "INVALID_RELATION_TARGET_FORMAT"
  | "MISSING_RELATION_CARDINALITY"
  | "INVALID_RELATION_CARDINALITY"
  | "MISSING_SLUG_SOURCE_FIELD"
  | "SLUG_SOURCE_FIELD_NOT_FOUND"
  | "UNRESOLVED_RELATION_TARGET"
  | "COLLECTION_NOT_FOUND";

export interface OryCMSSchemaValidationIssue {
  code: OryCMSSchemaValidationCode;
  message: string;
  /** Dot-separated path to the offending property (e.g. "fields[2].options[0]"). */
  path?: string;
  /** Name of the field involved, if applicable. */
  fieldName?: string;
}

export interface OryCMSSchemaValidationResult {
  valid: boolean;
  issues: OryCMSSchemaValidationIssue[];
}
