"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Edit, Loader2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { adminCollectionCreatePath, adminCollectionEditPath } from "@/lib/admin-collection-routes";
import type { OryCMSCollectionDefinition } from "@/schema";

export function OryCMSCollectionsAdminPage() {
  const [collections, setCollections] = useState<OryCMSCollectionDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/orycms/collections")
      .then((response) => response.json())
      .then(
        (json: {
          success: boolean;
          data?: OryCMSCollectionDefinition[];
          error?: { message: string };
        }) => {
          if (json.success) setCollections(json.data ?? []);
          else setError(json.error?.message ?? "Failed to load collections.");
        },
      )
      .catch(() => setError("Failed to load collections."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          eyebrow="Content architecture"
          title="Collections"
          description="Create and edit OryCMS collection schemas from the admin panel."
        />
        <Button asChild size="sm">
          <Link href={adminCollectionCreatePath()}>
            <Plus className="h-3.5 w-3.5" />
            Create collection
          </Link>
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="grid grid-cols-[1.5fr_1fr_0.8fr_0.8fr_auto] gap-3 border-b border-border bg-surface-muted/50 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          <div>Collection</div>
          <div>Slug</div>
          <div>Fields</div>
          <div>Capabilities</div>
          <div />
        </div>
        {loading ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {collections.map((collection) => (
              <div
                key={collection.slug}
                className="grid grid-cols-[1.5fr_1fr_0.8fr_0.8fr_auto] items-center gap-3 px-4 py-3 text-[13px]"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{collection.name}</div>
                  <div className="truncate text-[12px] text-muted-foreground">
                    {collection.description ?? collection.labels.plural}
                  </div>
                </div>
                <code className="truncate rounded-md bg-surface-muted px-2 py-1 text-[11.5px]">
                  {collection.slug}
                </code>
                <div className="text-muted-foreground">{collection.fields.length} fields</div>
                <div className="flex flex-wrap gap-1">
                  {collection.timestamps?.enabled && <Badge variant="outline">timestamps</Badge>}
                  {collection.draft?.enabled && <Badge variant="outline">drafts</Badge>}
                  {collection.seo?.enabled && <Badge variant="outline">SEO</Badge>}
                </div>
                <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                  <Link href={adminCollectionEditPath(collection.slug)} aria-label="Edit schema">
                    <Edit className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            ))}
            {collections.length === 0 && (
              <div className="px-4 py-12 text-center text-[13px] text-muted-foreground">
                No collections registered yet.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
