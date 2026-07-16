import { validateOryCMSCollectionSchema } from "@/schema";
import type {
  OryCMSCollectionDefinition,
  OryCMSSchemaField,
  OryCMSSchemaFieldType,
  OryCMSSchemaRelationCardinality,
  OryCMSSchemaSelectOption,
  OryCMSSchemaValidationResult,
} from "@/schema";

export const ORYCMS_FIELD_TYPES: OryCMSSchemaFieldType[] = [
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
];

export interface CollectionFieldFormState {
  id: string;
  name: string;
  label: string;
  description: string;
  type: OryCMSSchemaFieldType;
  required: boolean;
  unique: boolean;
  private: boolean;
  defaultValue: string;
  options: OryCMSSchemaSelectOption[];
  multiple: boolean;
  target: string;
  cardinality: OryCMSSchemaRelationCardinality;
  sourceField: string;
}

export interface CollectionSchemaFormState {
  name: string;
  slug: string;
  labels: {
    singular: string;
    plural: string;
    menu: string;
  };
  description: string;
  tableName: string;
  fields: CollectionFieldFormState[];
  timestampsEnabled: boolean;
  draftsEnabled: boolean;
  seoEnabled: boolean;
  seoTitleField: string;
  seoDescriptionField: string;
  seoImageField: string;
}

export function slugifyCollectionName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function createEmptyCollectionField(id = `field-${Date.now()}`): CollectionFieldFormState {
  return {
    id,
    name: "",
    label: "",
    description: "",
    type: "text",
    required: false,
    unique: false,
    private: false,
    defaultValue: "",
    options: [{ label: "Option", value: "option" }],
    multiple: false,
    target: "",
    cardinality: "one",
    sourceField: "",
  };
}

export function createEmptyCollectionSchemaForm(): CollectionSchemaFormState {
  return {
    name: "",
    slug: "",
    labels: {
      singular: "",
      plural: "",
      menu: "",
    },
    description: "",
    tableName: "",
    fields: [createEmptyCollectionField("field-1")],
    timestampsEnabled: true,
    draftsEnabled: false,
    seoEnabled: false,
    seoTitleField: "",
    seoDescriptionField: "",
    seoImageField: "",
  };
}

function parseDefaultValue(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (!Number.isNaN(Number(trimmed)) && /^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function withSharedFieldSettings(
  field: CollectionFieldFormState,
): Pick<
  OryCMSSchemaField,
  "name" | "label" | "description" | "required" | "unique" | "private" | "defaultValue"
> {
  const base: Pick<
    OryCMSSchemaField,
    "name" | "label" | "description" | "required" | "unique" | "private" | "defaultValue"
  > = {
    name: field.name.trim(),
  };
  if (field.label.trim()) base.label = field.label.trim();
  if (field.description.trim()) base.description = field.description.trim();
  if (field.required) base.required = true;
  if (field.unique) base.unique = true;
  if (field.private) base.private = true;
  const defaultValue = parseDefaultValue(field.defaultValue);
  if (defaultValue !== undefined) base.defaultValue = defaultValue;
  return base;
}

export function collectionFieldFormToSchema(field: CollectionFieldFormState): OryCMSSchemaField {
  const base = withSharedFieldSettings(field);

  if (field.type === "select") {
    return {
      ...base,
      type: "select",
      options: field.options
        .map((option) => ({ label: option.label.trim(), value: option.value.trim() }))
        .filter((option) => option.label || option.value),
      ...(field.multiple ? { multiple: true } : {}),
    };
  }

  if (field.type === "relation") {
    return {
      ...base,
      type: "relation",
      target: field.target.trim(),
      cardinality: field.cardinality,
    };
  }

  if (field.type === "slug") {
    return {
      ...base,
      type: "slug",
      sourceField: field.sourceField.trim(),
    };
  }

  return { ...base, type: field.type } as OryCMSSchemaField;
}

export function collectionSchemaFormToDefinition(
  form: CollectionSchemaFormState,
): OryCMSCollectionDefinition {
  const definition: OryCMSCollectionDefinition = {
    name: form.name.trim(),
    slug: form.slug.trim(),
    labels: {
      singular: form.labels.singular.trim(),
      plural: form.labels.plural.trim(),
    },
    fields: form.fields.map(collectionFieldFormToSchema),
  };

  if (form.labels.menu.trim()) definition.labels.menu = form.labels.menu.trim();
  if (form.description.trim()) definition.description = form.description.trim();
  if (form.tableName.trim()) definition.tableName = form.tableName.trim();
  if (form.timestampsEnabled) definition.timestamps = { enabled: true };
  if (form.draftsEnabled) definition.draft = { enabled: true };
  if (form.seoEnabled) {
    definition.seo = {
      enabled: true,
      ...(form.seoTitleField.trim() ? { titleField: form.seoTitleField.trim() } : {}),
      ...(form.seoDescriptionField.trim()
        ? { descriptionField: form.seoDescriptionField.trim() }
        : {}),
      ...(form.seoImageField.trim() ? { imageField: form.seoImageField.trim() } : {}),
    };
  }

  return definition;
}

export function collectionDefinitionToForm(
  definition: OryCMSCollectionDefinition,
): CollectionSchemaFormState {
  return {
    name: definition.name,
    slug: definition.slug,
    labels: {
      singular: definition.labels.singular,
      plural: definition.labels.plural,
      menu: definition.labels.menu ?? "",
    },
    description: definition.description ?? "",
    tableName: definition.tableName ?? "",
    fields: definition.fields.map((field, index) => ({
      ...createEmptyCollectionField(`field-${index + 1}`),
      name: field.name,
      label: field.label ?? "",
      description: field.description ?? "",
      type: field.type,
      required: Boolean(field.required),
      unique: Boolean(field.unique),
      private: Boolean(field.private),
      defaultValue:
        field.defaultValue === undefined
          ? ""
          : typeof field.defaultValue === "string"
            ? field.defaultValue
            : JSON.stringify(field.defaultValue),
      options: field.type === "select" ? field.options : [{ label: "Option", value: "option" }],
      multiple: field.type === "select" ? Boolean(field.multiple) : false,
      target: field.type === "relation" ? field.target : "",
      cardinality: field.type === "relation" ? field.cardinality : "one",
      sourceField: field.type === "slug" ? field.sourceField : "",
    })),
    timestampsEnabled: Boolean(definition.timestamps?.enabled),
    draftsEnabled: Boolean(definition.draft?.enabled),
    seoEnabled: Boolean(definition.seo?.enabled),
    seoTitleField: definition.seo?.titleField ?? "",
    seoDescriptionField: definition.seo?.descriptionField ?? "",
    seoImageField: definition.seo?.imageField ?? "",
  };
}

export function validateCollectionSchemaForm(
  form: CollectionSchemaFormState,
  existingCollections: OryCMSCollectionDefinition[],
  originalSlug?: string,
): OryCMSSchemaValidationResult {
  const definition = collectionSchemaFormToDefinition(form);
  const registeredSlugs = new Set(
    existingCollections
      .map((collection) => collection.slug)
      .filter((slug) => slug !== originalSlug),
  );
  const relationTargets = new Set(existingCollections.map((collection) => collection.slug));
  if (definition.slug) relationTargets.add(definition.slug);

  return validateOryCMSCollectionSchema(definition, {
    registeredSlugs,
    registeredCollectionSlugs: relationTargets,
  });
}

export function apiEndpointPreview(collectionSlug: string): string[] {
  const slug = collectionSlug.trim() || "[collection]";
  return [
    `GET /api/orycms/collections/${slug}/content`,
    `POST /api/orycms/collections/${slug}/content`,
    `GET /api/orycms/collections/${slug}/content/[id]`,
    `PATCH /api/orycms/collections/${slug}/content/[id]`,
    `DELETE /api/orycms/collections/${slug}/content/[id]`,
    `POST /api/orycms/collections/${slug}/content/[id]/publish`,
  ];
}
