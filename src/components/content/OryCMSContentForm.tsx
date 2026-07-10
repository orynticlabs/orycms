"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { OryCMSDynamicField } from "./OryCMSDynamicField";
import type { OryCMSCollectionDefinition } from "@/schema/collection.schema";
import type { OryCMSContentEntry } from "@/types/content.types";

interface OryCMSContentFormProps {
  collection: OryCMSCollectionDefinition;
  /** Existing entry when editing; undefined when creating */
  entry?: OryCMSContentEntry;
  onSuccess?: (entry: OryCMSContentEntry) => void;
}

type FieldErrors = Record<string, string>;

function initFormData(
  collection: OryCMSCollectionDefinition,
  entry?: OryCMSContentEntry,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const field of collection.fields) {
    if (field.private) continue;
    const existing = entry?.data[field.name];
    if (existing !== undefined) {
      data[field.name] = existing;
    } else if (field.defaultValue !== undefined) {
      data[field.name] = field.defaultValue;
    } else if (field.type === "boolean") {
      data[field.name] = false;
    } else if (field.type === "select" && field.multiple) {
      data[field.name] = [];
    } else {
      data[field.name] = "";
    }
  }
  return data;
}

export function OryCMSContentForm({ collection, entry, onSuccess }: OryCMSContentFormProps) {
  const router = useRouter();
  const isEdit = Boolean(entry);
  const slug = collection.slug;

  const [formData, setFormData] = useState<Record<string, unknown>>(() =>
    initFormData(collection, entry),
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);

  // Re-init when entry changes (e.g. after save)
  useEffect(() => {
    setFormData(initFormData(collection, entry));
    setFieldErrors({});
    setGlobalError(null);
    setSuccess(false);
  }, [collection, entry]);

  const setField = useCallback((name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const cleanPayload = (raw: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      // Exclude empty strings for optional fields — let backend use defaults
      if (v === "") out[k] = null;
      else out[k] = v;
    }
    return out;
  };

  const handleSave = async (asDraft?: boolean) => {
    setGlobalError(null);
    setFieldErrors({});
    setSuccess(false);
    setSaving(true);

    try {
      const payload = cleanPayload(formData);
      const url = isEdit
        ? `/api/orycms/collections/${slug}/content/${entry!.id}`
        : `/api/orycms/collections/${slug}/content`;

      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEdit ? { data: payload } : { data: payload, asDraft: asDraft ?? true },
        ),
      });

      const json = (await res.json()) as {
        success: boolean;
        data?: OryCMSContentEntry;
        error?: { code: string; message: string };
      };

      if (!res.ok || !json.success) {
        const msg = json.error?.message ?? "Save failed.";
        // Surface field-specific errors
        if (
          json.error?.code === "FIELD_REQUIRED" ||
          json.error?.code === "FIELD_INVALID" ||
          json.error?.code === "FIELD_UNKNOWN"
        ) {
          const fieldMatch = msg.match(/"([^"]+)"/);
          if (fieldMatch) {
            setFieldErrors({ [fieldMatch[1]]: msg });
          } else {
            setGlobalError(msg);
          }
        } else {
          setGlobalError(msg);
        }
        setSaving(false);
        return;
      }

      setSuccess(true);
      setSaving(false);

      if (onSuccess && json.data) {
        onSuccess(json.data);
      } else if (!isEdit && json.data) {
        // Navigate to edit page after create
        router.push(`/collections/${slug}/content/${json.data.id}/edit`);
      }
    } catch {
      setGlobalError("Network error. Please try again.");
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!entry) return;
    setGlobalError(null);
    setPublishing(true);
    try {
      const res = await fetch(`/api/orycms/collections/${slug}/content/${entry.id}/publish`, {
        method: "POST",
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: OryCMSContentEntry;
        error?: { message: string };
      };
      if (!res.ok || !json.success) {
        setGlobalError(json.error?.message ?? "Publish failed.");
      } else if (json.data && onSuccess) {
        onSuccess(json.data);
      }
    } catch {
      setGlobalError("Network error.");
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!entry) return;
    setGlobalError(null);
    setUnpublishing(true);
    try {
      const res = await fetch(`/api/orycms/collections/${slug}/content/${entry.id}/publish`, {
        method: "DELETE",
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: OryCMSContentEntry;
        error?: { message: string };
      };
      if (!res.ok || !json.success) {
        setGlobalError(json.error?.message ?? "Unpublish failed.");
      } else if (json.data && onSuccess) {
        onSuccess(json.data);
      }
    } catch {
      setGlobalError("Network error.");
    } finally {
      setUnpublishing(false);
    }
  };

  const visibleFields = collection.fields.filter((f) => !f.private);
  const hasDraft = Boolean(collection.draft?.enabled);
  const isPublished = entry?.status === "published";

  return (
    <div className="space-y-6">
      {/* Status badge when editing */}
      {isEdit && entry && (
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={
              isPublished
                ? "border-success/30 bg-success/10 text-success"
                : "border-warning/30 bg-warning/10 text-warning"
            }
          >
            {isPublished ? "Published" : "Draft"}
          </Badge>
          {entry.publishedAt && (
            <span className="text-[11.5px] text-muted-foreground">
              Published {new Date(entry.publishedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      )}

      {/* Global error */}
      {globalError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{globalError}</AlertDescription>
        </Alert>
      )}

      {/* Success notice */}
      {success && (
        <Alert className="border-success/30 bg-success/10 text-success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Saved successfully.</AlertDescription>
        </Alert>
      )}

      {/* Fields */}
      <div className="grid gap-5">
        {visibleFields.map((field) => (
          <OryCMSDynamicField
            key={field.name}
            field={field}
            value={formData[field.name]}
            onChange={(v) => setField(field.name, v)}
            error={fieldErrors[field.name]}
            disabled={saving || publishing || unpublishing}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-5">
        {hasDraft ? (
          <>
            <Button onClick={() => handleSave(true)} disabled={saving} variant="outline">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save as draft
            </Button>
            {isEdit && !isPublished && (
              <Button onClick={handlePublish} disabled={publishing}>
                {publishing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Publish
              </Button>
            )}
            {isEdit && isPublished && (
              <Button onClick={handleUnpublish} disabled={unpublishing} variant="outline">
                {unpublishing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Unpublish
              </Button>
            )}
          </>
        ) : (
          <Button onClick={() => handleSave(false)} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isEdit ? "Save changes" : "Create entry"}
          </Button>
        )}

        <Button
          variant="ghost"
          onClick={() => router.push(`/collections/${slug}/content`)}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
