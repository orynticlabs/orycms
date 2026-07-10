"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { OryCMSContentTable } from "./OryCMSContentTable";
import { OryCMSContentForm } from "./OryCMSContentForm";
import { adminContentListPath } from "@/lib/admin-content-routes";
import type { OryCMSCollectionDefinition } from "@/schema/collection.schema";
import type { OryCMSContentEntry } from "@/types/content.types";

type Mode = "list" | "create" | "edit";

interface OryCMSCollectionContentPageProps {
  collectionSlug: string;
  mode: Mode;
  entryId?: string;
}

export function OryCMSCollectionContentPage({
  collectionSlug,
  mode,
  entryId,
}: OryCMSCollectionContentPageProps) {
  const router = useRouter();
  const [collection, setCollection] = useState<OryCMSCollectionDefinition | null>(null);
  const [entry, setEntry] = useState<OryCMSContentEntry | undefined>(undefined);
  const [loadingSchema, setLoadingSchema] = useState(true);
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  // Fetch schema
  useEffect(() => {
    setLoadingSchema(true);
    setSchemaError(null);
    fetch(`/api/orycms/collections/${collectionSlug}`)
      .then((r) => r.json())
      .then(
        (json: {
          success: boolean;
          data?: OryCMSCollectionDefinition;
          error?: { message: string };
        }) => {
          if (json.success && json.data) {
            setCollection(json.data);
          } else {
            setSchemaError(json.error?.message ?? "Collection not found.");
          }
        },
      )
      .catch(() => setSchemaError("Failed to load collection schema."))
      .finally(() => setLoadingSchema(false));
  }, [collectionSlug]);

  // Fetch entry when editing
  useEffect(() => {
    if (mode !== "edit" || !entryId) return;
    setLoadingEntry(true);
    fetch(`/api/orycms/collections/${collectionSlug}/content/${entryId}`)
      .then((r) => r.json())
      .then((json: { success: boolean; data?: OryCMSContentEntry }) => {
        if (json.success && json.data) setEntry(json.data);
      })
      .catch(() => {})
      .finally(() => setLoadingEntry(false));
  }, [collectionSlug, entryId, mode]);

  if (loadingSchema) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (schemaError || !collection) {
    return (
      <div className="space-y-4 p-6 lg:p-8">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
          {schemaError ?? "Collection not found."}
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push("/collections")}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to collections
        </Button>
      </div>
    );
  }

  const listPath = adminContentListPath(collectionSlug);

  if (mode === "list") {
    return (
      <div className="space-y-6 p-6 lg:p-8 max-w-[1400px] mx-auto">
        <PageHeader
          eyebrow={`Collection · ${collection.name}`}
          title="Content entries"
          description={collection.description}
        />
        <OryCMSContentTable collection={collection} />
      </div>
    );
  }

  if (mode === "create") {
    return (
      <div className="p-6 lg:p-8 max-w-[900px] mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push(listPath)}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
          <PageHeader
            eyebrow={`${collection.name} · New entry`}
            title="Create entry"
            className="flex-1"
          />
        </div>
        <div className="rounded-xl border border-border bg-surface p-6">
          <OryCMSContentForm collection={collection} />
        </div>
      </div>
    );
  }

  // edit
  if (loadingEntry) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[900px] mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push(listPath)}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
        <PageHeader
          eyebrow={`${collection.name} · Edit entry`}
          title={
            entry ? String(entry.data[Object.keys(entry.data)[0]] ?? entryId) : (entryId ?? "Edit")
          }
          className="flex-1"
        />
      </div>
      <div className="rounded-xl border border-border bg-surface p-6">
        <OryCMSContentForm
          collection={collection}
          entry={entry}
          onSuccess={(updated) => setEntry(updated)}
        />
      </div>
    </div>
  );
}
