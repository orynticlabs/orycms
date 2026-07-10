"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Edit,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OryCMSCollectionDefinition } from "@/schema/collection.schema";
import type { OryCMSContentEntry } from "@/types/content.types";

interface OryCMSContentTableProps {
  collection: OryCMSCollectionDefinition;
}

type SortDir = "asc" | "desc";

interface SortState {
  field: string;
  dir: SortDir;
}

const PAGE_SIZE = 20;

/** Returns the best display field: first non-private text/email/slug field, else id. */
function getPrimaryField(collection: OryCMSCollectionDefinition): string {
  const f = collection.fields.find(
    (f) => !f.private && ["text", "email", "slug", "textarea"].includes(f.type),
  );
  return f?.name ?? "id";
}

/** Format a cell value for display. */
function formatCell(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ") || "—";
  if (typeof value === "object") return JSON.stringify(value).slice(0, 60);
  return String(value).slice(0, 80);
}

export function OryCMSContentTable({ collection }: OryCMSContentTableProps) {
  const router = useRouter();
  const slug = collection.slug;

  const [entries, setEntries] = useState<OryCMSContentEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState>({ field: "createdAt", dir: "desc" });
  const [includeDrafts, setIncludeDrafts] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const primaryField = getPrimaryField(collection);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        sort: `${sort.field}:${sort.dir}`,
        drafts: String(includeDrafts),
      });

      if (search) {
        params.set(`filter[${primaryField}][contains]`, search);
      }

      const res = await fetch(`/api/orycms/collections/${slug}/content?${params}`);
      const json = (await res.json()) as {
        success: boolean;
        data?: OryCMSContentEntry[];
        meta?: { total: number };
        error?: { message: string };
      };

      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Failed to load entries.");
        return;
      }

      setEntries(json.data ?? []);
      setTotal(json.meta?.total ?? 0);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [slug, page, sort, search, includeDrafts, primaryField]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  // Reset to page 1 when search/sort/drafts changes
  useEffect(() => {
    setPage(1);
  }, [search, sort, includeDrafts]);

  const handleSort = (field: string) => {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" },
    );
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this entry? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/orycms/collections/${slug}/content/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchEntries();
      }
    } finally {
      setDeletingId(null);
    }
  };

  // Columns: primary + next 2 visible non-private non-text-heavy fields, then status, timestamps
  const columns = [
    primaryField,
    ...collection.fields
      .filter(
        (f) =>
          !f.private &&
          f.name !== primaryField &&
          !["textarea", "richText", "json", "password"].includes(f.type),
      )
      .slice(0, 2)
      .map((f) => f.name),
  ];
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasDraft = Boolean(collection.draft?.enabled);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search by ${primaryField}…`}
              className="h-8 w-[220px] pl-8 text-[13px]"
            />
          </div>
          {hasDraft && (
            <button
              onClick={() => setIncludeDrafts((v) => !v)}
              className={cn(
                "h-8 rounded-md border px-3 text-[12px] font-medium transition-colors",
                includeDrafts
                  ? "border-border bg-surface-muted/60 text-foreground"
                  : "border-border bg-surface text-muted-foreground hover:border-border-strong",
              )}
            >
              {includeDrafts ? "All (incl. drafts)" : "Published only"}
            </button>
          )}
        </div>

        <Button
          size="sm"
          onClick={() => router.push(`/collections/${slug}/content/new`)}
          className="h-8 text-[12.5px]"
        >
          <Plus className="h-3.5 w-3.5" />
          New entry
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-[12.5px] text-destructive">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[600px] text-[13px]">
          <thead className="border-b border-border bg-surface-muted/50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground"
                >
                  <button
                    onClick={() => handleSort(col)}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    {col}
                    <ArrowUpDown
                      className={cn(
                        "h-3 w-3",
                        sort.field === col ? "text-foreground" : "opacity-40",
                      )}
                    />
                  </button>
                </th>
              ))}
              {hasDraft && (
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground">
                  Status
                </th>
              )}
              <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground">
                Updated
              </th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={columns.length + (hasDraft ? 1 : 0) + 2}
                  className="py-12 text-center text-muted-foreground"
                >
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            )}
            {!loading && entries.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + (hasDraft ? 1 : 0) + 2}
                  className="py-12 text-center text-[13px] text-muted-foreground"
                >
                  {search
                    ? `No entries matching "${search}"`
                    : "No entries yet. Create your first one."}
                </td>
              </tr>
            )}
            {!loading &&
              entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors"
                >
                  {columns.map((col) => (
                    <td key={col} className="px-4 py-3 text-[13px]">
                      {col === "id" ? (
                        <span className="font-mono text-[11.5px] text-muted-foreground">
                          {entry.id.slice(0, 8)}…
                        </span>
                      ) : (
                        <span className="line-clamp-1">{formatCell(entry.data[col])}</span>
                      )}
                    </td>
                  ))}
                  {hasDraft && (
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10.5px]",
                          entry.status === "published"
                            ? "border-success/30 bg-success/10 text-success"
                            : "border-warning/30 bg-warning/10 text-warning",
                        )}
                      >
                        {entry.status}
                      </Badge>
                    </td>
                  )}
                  <td className="px-4 py-3 text-[11.5px] text-muted-foreground">
                    {new Date(entry.timestamps.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => router.push(`/collections/${slug}/content/${entry.id}/edit`)}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(entry.id)}
                        disabled={deletingId === entry.id}
                      >
                        {deletingId === entry.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[12.5px] text-muted-foreground">
          <span>
            {total} {total === 1 ? "entry" : "entries"} · page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
