"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, Loader2, Plus, Save, Trash2, Wand2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { adminCollectionsPath } from "@/admin";
import {
  ORYCMS_FIELD_TYPES,
  apiEndpointPreview,
  collectionDefinitionToForm,
  collectionSchemaFormToDefinition,
  createEmptyCollectionField,
  createEmptyCollectionSchemaForm,
  slugifyCollectionName,
  validateCollectionSchemaForm,
  type CollectionFieldFormState,
  type CollectionSchemaFormState,
} from "@/admin";
import type {
  OryCMSCollectionDefinition,
  OryCMSSchemaFieldType,
  OryCMSSchemaRelationCardinality,
  OryCMSSchemaValidationIssue,
} from "@/schema";

interface OryCMSCollectionSchemaEditorProps {
  mode: "create" | "edit";
  collectionSlug?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    issues?: OryCMSSchemaValidationIssue[];
  };
}

const fieldTypeLabels: Record<OryCMSSchemaFieldType, string> = {
  text: "Text",
  textarea: "Textarea",
  richText: "Rich Text",
  number: "Number",
  boolean: "Boolean",
  date: "Date",
  email: "Email",
  password: "Password",
  select: "Select",
  relation: "Relation",
  media: "Media",
  json: "JSON",
  slug: "Slug",
};

function SettingCheckbox({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-[12.5px]">
      <Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(Boolean(value))} />
      {label}
    </label>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12px]">{label}</Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="h-8 text-[13px]"
      />
    </div>
  );
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  const current = next[index];
  next[index] = next[target];
  next[target] = current;
  return next;
}

export function OryCMSCollectionSchemaEditor({
  mode,
  collectionSlug,
}: OryCMSCollectionSchemaEditorProps) {
  const router = useRouter();
  const [form, setForm] = useState<CollectionSchemaFormState>(() =>
    createEmptyCollectionSchemaForm(),
  );
  const [collections, setCollections] = useState<OryCMSCollectionDefinition[]>([]);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/orycms/collections")
      .then((response) => response.json())
      .then((json: ApiResponse<OryCMSCollectionDefinition[]>) => {
        if (json.success) setCollections(json.data ?? []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (mode !== "edit" || !collectionSlug) return;
    setLoading(true);
    fetch(`/api/orycms/collections/${collectionSlug}`)
      .then((response) => response.json())
      .then((json: ApiResponse<OryCMSCollectionDefinition>) => {
        if (json.success && json.data) {
          setForm(collectionDefinitionToForm(json.data));
        } else {
          setLoadError(json.error?.message ?? "Collection not found.");
        }
      })
      .catch(() => setLoadError("Failed to load collection schema."))
      .finally(() => setLoading(false));
  }, [collectionSlug, mode]);

  const validation = useMemo(
    () =>
      validateCollectionSchemaForm(form, collections, mode === "edit" ? collectionSlug : undefined),
    [collectionSlug, collections, form, mode],
  );
  const definition = useMemo(() => collectionSchemaFormToDefinition(form), [form]);
  const endpoints = useMemo(() => apiEndpointPreview(form.slug), [form.slug]);
  const fieldNames = form.fields.map((field) => field.name).filter(Boolean);

  const updateForm = (updates: Partial<CollectionSchemaFormState>) => {
    setForm((current) => ({ ...current, ...updates }));
  };

  const updateField = (id: string, updates: Partial<CollectionFieldFormState>) => {
    setForm((current) => ({
      ...current,
      fields: current.fields.map((field) => (field.id === id ? { ...field, ...updates } : field)),
    }));
  };

  const saveSchema = async () => {
    setApiError(null);
    setSaveMessage(null);
    if (!validation.valid) {
      setApiError("Fix schema validation errors before saving.");
      return;
    }

    setSaving(true);
    const url =
      mode === "edit" && collectionSlug
        ? `/api/orycms/collections/${collectionSlug}`
        : "/api/orycms/collections";
    const method = mode === "edit" ? "PATCH" : "POST";

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(definition),
      });
      const json = (await response.json()) as ApiResponse<OryCMSCollectionDefinition>;
      if (!response.ok || !json.success) {
        setApiError(json.error?.message ?? "Schema could not be saved.");
        return;
      }
      setSaveMessage("Schema saved in the OryCMS registry. Database migrations were not executed.");
      if (json.data) {
        setForm(collectionDefinitionToForm(json.data));
      }
    } catch {
      setApiError("Network error while saving schema.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-[900px] space-y-4 p-6 lg:p-8">
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        <Button variant="outline" size="sm" onClick={() => router.push(adminCollectionsPath())}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to collections
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-[1500px] gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-8">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <PageHeader
            eyebrow="Collection schema"
            title={mode === "create" ? "Create collection" : `Edit ${collectionSlug}`}
            description="Define fields, validation rules, schema capabilities, and generated endpoints."
          />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push(adminCollectionsPath())}>
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
            <Button size="sm" onClick={saveSchema} disabled={saving || !validation.valid}>
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save schema
            </Button>
          </div>
        </div>

        {apiError && (
          <Alert variant="destructive">
            <AlertDescription>{apiError}</AlertDescription>
          </Alert>
        )}
        {saveMessage && (
          <Alert className="border-success/30 bg-success/10 text-success">
            <AlertDescription>{saveMessage}</AlertDescription>
          </Alert>
        )}

        <section className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold">Collection details</h2>
              <p className="text-[12.5px] text-muted-foreground">
                Name, slug, labels, table name, and description.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const slug = slugifyCollectionName(form.name);
                updateForm({
                  slug,
                  tableName: slug.replace(/-/g, "_"),
                  labels: {
                    singular: form.labels.singular || form.name,
                    plural: form.labels.plural || `${form.name}s`,
                    menu: form.labels.menu,
                  },
                });
              }}
            >
              <Wand2 className="h-3.5 w-3.5" />
              Generate
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FieldInput
              label="Name"
              value={form.name}
              onChange={(name) => updateForm({ name })}
              placeholder="Blog Post"
            />
            <FieldInput
              label="Slug"
              value={form.slug}
              onChange={(slug) => updateForm({ slug })}
              placeholder="blog-posts"
              disabled={mode === "edit"}
            />
            <FieldInput
              label="Singular label"
              value={form.labels.singular}
              onChange={(singular) => updateForm({ labels: { ...form.labels, singular } })}
              placeholder="Post"
            />
            <FieldInput
              label="Plural label"
              value={form.labels.plural}
              onChange={(plural) => updateForm({ labels: { ...form.labels, plural } })}
              placeholder="Posts"
            />
            <FieldInput
              label="Menu label"
              value={form.labels.menu}
              onChange={(menu) => updateForm({ labels: { ...form.labels, menu } })}
              placeholder="Blog"
            />
            <FieldInput
              label="Table name"
              value={form.tableName}
              onChange={(tableName) => updateForm({ tableName })}
              placeholder="blog_posts"
            />
          </div>

          <div className="mt-4 space-y-1.5">
            <Label className="text-[12px]">Description</Label>
            <Textarea
              value={form.description}
              onChange={(event) => updateForm({ description: event.target.value })}
              placeholder="Content managed by this collection."
              className="min-h-20 text-[13px]"
            />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold">Fields</h2>
              <p className="text-[12.5px] text-muted-foreground">
                Add, edit, reorder, and remove schema fields.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                updateForm({
                  fields: [...form.fields, createEmptyCollectionField(`field-${Date.now()}`)],
                })
              }
            >
              <Plus className="h-3.5 w-3.5" />
              Add field
            </Button>
          </div>

          <div className="space-y-4">
            {form.fields.map((field, index) => (
              <div key={field.id} className="rounded-lg border border-border bg-background p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">#{index + 1}</Badge>
                    <span className="text-[13px] font-medium">
                      {field.name || "Untitled field"}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateForm({ fields: moveItem(form.fields, index, -1) })}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateForm({ fields: moveItem(form.fields, index, 1) })}
                      disabled={index === form.fields.length - 1}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() =>
                        updateForm({ fields: form.fields.filter((item) => item.id !== field.id) })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <FieldInput
                    label="Field name"
                    value={field.name}
                    onChange={(name) => updateField(field.id, { name })}
                    placeholder="title"
                  />
                  <FieldInput
                    label="Label"
                    value={field.label}
                    onChange={(label) => updateField(field.id, { label })}
                    placeholder="Title"
                  />
                  <div className="space-y-1.5">
                    <Label className="text-[12px]">Type</Label>
                    <Select
                      value={field.type}
                      onValueChange={(type) =>
                        updateField(field.id, { type: type as OryCMSSchemaFieldType })
                      }
                    >
                      <SelectTrigger className="h-8 text-[13px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ORYCMS_FIELD_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {fieldTypeLabels[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <FieldInput
                    label="Default value"
                    value={field.defaultValue}
                    onChange={(defaultValue) => updateField(field.id, { defaultValue })}
                    placeholder="String, number, boolean, null, or JSON"
                  />
                  <FieldInput
                    label="Description"
                    value={field.description}
                    onChange={(description) => updateField(field.id, { description })}
                    placeholder="Shown to editors and API consumers"
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <SettingCheckbox
                    label="Required"
                    checked={field.required}
                    onCheckedChange={(required) => updateField(field.id, { required })}
                  />
                  <SettingCheckbox
                    label="Unique"
                    checked={field.unique}
                    onCheckedChange={(unique) => updateField(field.id, { unique })}
                  />
                  <SettingCheckbox
                    label="Private"
                    checked={field.private}
                    onCheckedChange={(privateField) =>
                      updateField(field.id, { private: privateField })
                    }
                  />
                </div>

                {field.type === "select" && (
                  <div className="mt-4 rounded-md border border-border bg-surface-muted/30 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <SettingCheckbox
                        label="Allow multiple values"
                        checked={field.multiple}
                        onCheckedChange={(multiple) => updateField(field.id, { multiple })}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateField(field.id, {
                            options: [...field.options, { label: "", value: "" }],
                          })
                        }
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add option
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {field.options.map((option, optionIndex) => (
                        <div key={optionIndex} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                          <Input
                            value={option.label}
                            onChange={(event) => {
                              const options = [...field.options];
                              options[optionIndex] = { ...option, label: event.target.value };
                              updateField(field.id, { options });
                            }}
                            placeholder="Label"
                            className="h-8 text-[13px]"
                          />
                          <Input
                            value={option.value}
                            onChange={(event) => {
                              const options = [...field.options];
                              options[optionIndex] = { ...option, value: event.target.value };
                              updateField(field.id, { options });
                            }}
                            placeholder="value"
                            className="h-8 text-[13px]"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() =>
                              updateField(field.id, {
                                options: field.options.filter((_, i) => i !== optionIndex),
                              })
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {field.type === "relation" && (
                  <div className="mt-4 grid gap-4 rounded-md border border-border bg-surface-muted/30 p-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-[12px]">Relation target</Label>
                      <Select
                        value={field.target || undefined}
                        onValueChange={(target) => updateField(field.id, { target })}
                      >
                        <SelectTrigger className="h-8 text-[13px]">
                          <SelectValue placeholder="Select collection" />
                        </SelectTrigger>
                        <SelectContent>
                          {collections.map((collection) => (
                            <SelectItem key={collection.slug} value={collection.slug}>
                              {collection.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px]">Cardinality</Label>
                      <Select
                        value={field.cardinality}
                        onValueChange={(cardinality) =>
                          updateField(field.id, {
                            cardinality: cardinality as OryCMSSchemaRelationCardinality,
                          })
                        }
                      >
                        <SelectTrigger className="h-8 text-[13px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="one">One</SelectItem>
                          <SelectItem value="many">Many</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {field.type === "slug" && (
                  <div className="mt-4 rounded-md border border-border bg-surface-muted/30 p-3">
                    <Label className="text-[12px]">Source field</Label>
                    <Select
                      value={field.sourceField || undefined}
                      onValueChange={(sourceField) => updateField(field.id, { sourceField })}
                    >
                      <SelectTrigger className="mt-1.5 h-8 text-[13px]">
                        <SelectValue placeholder="Select source field" />
                      </SelectTrigger>
                      <SelectContent>
                        {fieldNames
                          .filter((name) => name !== field.name)
                          .map((name) => (
                            <SelectItem key={name} value={name}>
                              {name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-[15px] font-semibold">Capabilities</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="flex items-center justify-between rounded-lg border border-border px-3 py-3">
              <span className="text-[13px]">Timestamps</span>
              <Switch
                checked={form.timestampsEnabled}
                onCheckedChange={(timestampsEnabled) => updateForm({ timestampsEnabled })}
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-border px-3 py-3">
              <span className="text-[13px]">Drafts</span>
              <Switch
                checked={form.draftsEnabled}
                onCheckedChange={(draftsEnabled) => updateForm({ draftsEnabled })}
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-border px-3 py-3">
              <span className="text-[13px]">SEO</span>
              <Switch
                checked={form.seoEnabled}
                onCheckedChange={(seoEnabled) => updateForm({ seoEnabled })}
              />
            </label>
          </div>

          {form.seoEnabled && (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <FieldInput
                label="SEO title field"
                value={form.seoTitleField}
                onChange={(seoTitleField) => updateForm({ seoTitleField })}
              />
              <FieldInput
                label="SEO description field"
                value={form.seoDescriptionField}
                onChange={(seoDescriptionField) => updateForm({ seoDescriptionField })}
              />
              <FieldInput
                label="SEO image field"
                value={form.seoImageField}
                onChange={(seoImageField) => updateForm({ seoImageField })}
              />
            </div>
          )}
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <section className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[14px] font-semibold">Validation</h2>
            <Badge variant={validation.valid ? "outline" : "destructive"}>
              {validation.valid ? "Valid" : `${validation.issues.length} issues`}
            </Badge>
          </div>
          {validation.valid ? (
            <p className="text-[12.5px] text-muted-foreground">Schema passes OryCMS validation.</p>
          ) : (
            <div className="space-y-2">
              {validation.issues.map((issue, index) => (
                <div
                  key={`${issue.code}-${index}`}
                  className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2"
                >
                  <div className="text-[12px] font-medium text-destructive">{issue.code}</div>
                  <div className="text-[12px] text-destructive/90">{issue.message}</div>
                  {issue.path && (
                    <code className="mt-1 block text-[11px] text-destructive/80">{issue.path}</code>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-[14px] font-semibold">Generated API preview</h2>
          <div className="mt-3 space-y-2">
            {endpoints.map((endpoint) => (
              <code
                key={endpoint}
                className="block rounded-md bg-surface-muted px-3 py-2 text-[11.5px]"
              >
                {endpoint}
              </code>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-[14px] font-semibold">Schema JSON</h2>
          <pre className="mt-3 max-h-[360px] overflow-auto rounded-md bg-surface-muted p-3 text-[11px] leading-relaxed">
            {JSON.stringify(definition, null, 2)}
          </pre>
        </section>
      </aside>
    </div>
  );
}
