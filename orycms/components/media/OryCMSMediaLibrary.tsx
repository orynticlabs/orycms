"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  File,
  FileText,
  Film,
  FolderOpen,
  FolderPlus,
  Image,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/dashboard/PageHeader";
import type { OryCMSMediaAsset, OryCMSMediaFolder } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ListResult {
  data: OryCMSMediaAsset[];
  meta: { total: number; page: number; limit: number; hasMore: boolean };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function TypeIcon({ type, mime }: { type: string; mime: string }) {
  if (type === "image") return <Image className="h-4 w-4 text-blue-500" />;
  if (type === "video") return <Film className="h-4 w-4 text-purple-500" />;
  if (mime === "application/pdf") return <FileText className="h-4 w-4 text-red-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

// ── Main component ────────────────────────────────────────────────────────────

export function OryCMSMediaLibrary() {
  const [assets, setAssets] = useState<OryCMSMediaAsset[]>([]);
  const [folders, setFolders] = useState<OryCMSMediaFolder[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [folderId, setFolderId] = useState<string | null | undefined>(undefined);
  const [sort, setSort] = useState<"name" | "size" | "created_at">("created_at");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [newFolderName, setNewFolderName] = useState("");
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [selected, setSelected] = useState<OryCMSMediaAsset | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Debounce search ─────────────────────────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, folderId, sort, dir]);

  // ── Fetch folders ───────────────────────────────────────────────────────────

  const loadFolders = useCallback(() => {
    fetch("/api/orycms/media/folders")
      .then((r) => r.json())
      .then((json: { success: boolean; data?: OryCMSMediaFolder[] }) => {
        if (json.success) setFolders(json.data ?? []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  // ── Fetch assets ────────────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
      sort,
      dir,
    });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (folderId !== undefined) params.set("folderId", folderId ?? "null");

    fetch(`/api/orycms/media?${params}`)
      .then((r) => r.json())
      .then(
        (json: {
          success: boolean;
          data?: OryCMSMediaAsset[];
          meta?: typeof meta;
          error?: { message: string };
        }) => {
          if (json.success) {
            setAssets(json.data ?? []);
            if (json.meta) setMeta(json.meta);
          } else {
            setError(json.error?.message ?? "Failed to load media.");
          }
        },
      )
      .catch(() => setError("Failed to load media."))
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, folderId, sort, dir]);

  // ── Upload ──────────────────────────────────────────────────────────────────

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      if (folderId) form.append("folderId", folderId);
      const res = await fetch("/api/orycms/media", { method: "POST", body: form });
      const json = (await res.json()) as { success: boolean; error?: { message: string } };
      if (!json.success) {
        setError(json.error?.message ?? "Upload failed.");
        break;
      }
    }
    setUploading(false);
    setPage(1);
    // Reload by toggling a sentinel; simplest without extra state
    setDir((d) => d);
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function handleDelete(asset: OryCMSMediaAsset) {
    if (!confirm(`Delete "${asset.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/orycms/media/${asset.id}`, { method: "DELETE" });
    const json = (await res.json()) as { success: boolean; error?: { message: string } };
    if (json.success) {
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      if (selected?.id === asset.id) setSelected(null);
    } else {
      setError(json.error?.message ?? "Delete failed.");
    }
  }

  // ── Create folder ───────────────────────────────────────────────────────────

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    const res = await fetch("/api/orycms/media/folders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: newFolderName.trim(), parentId: folderId ?? undefined }),
    });
    const json = (await res.json()) as { success: boolean; error?: { message: string } };
    if (json.success) {
      setNewFolderName("");
      setShowFolderInput(false);
      loadFolders();
    } else {
      setError(json.error?.message ?? "Could not create folder.");
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          eyebrow="Asset management"
          title="Media library"
          description="Upload, organize, and reference images, videos, and documents."
        />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFolderInput((s) => !s)}>
            <FolderPlus className="h-3.5 w-3.5" />
            New folder
          </Button>
          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,.pdf,.doc,.docx,.txt,.csv"
            className="hidden"
            onChange={(e) => void handleUpload(e.target.files)}
          />
        </div>
      </div>

      {showFolderInput && (
        <div className="flex gap-2">
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name…"
            className="max-w-xs text-[13px]"
            onKeyDown={(e) => e.key === "Enter" && void handleCreateFolder()}
          />
          <Button size="sm" onClick={() => void handleCreateFolder()}>
            Create
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowFolderInput(false);
              setNewFolderName("");
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-6">
        {/* ── Folder sidebar ── */}
        <div className="w-44 shrink-0 space-y-1">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Folders
          </div>
          <button
            onClick={() => setFolderId(undefined)}
            className={`flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${
              folderId === undefined
                ? "bg-foreground/8 font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            All files
          </button>
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => setFolderId(f.id)}
              className={`flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${
                folderId === f.id
                  ? "bg-foreground/8 font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span className="truncate">{f.name}</span>
            </button>
          ))}
        </div>

        {/* ── Main area ── */}
        <div className="min-w-0 flex-1 space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name…"
                className="pl-8 text-[13px]"
              />
            </div>
            <select
              value={`${sort}:${dir}`}
              onChange={(e) => {
                const [s, d] = e.target.value.split(":") as [typeof sort, typeof dir];
                setSort(s);
                setDir(d);
              }}
              className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12.5px] text-foreground"
            >
              <option value="created_at:desc">Newest first</option>
              <option value="created_at:asc">Oldest first</option>
              <option value="name:asc">Name A–Z</option>
              <option value="name:desc">Name Z–A</option>
              <option value="size:desc">Largest first</option>
              <option value="size:asc">Smallest first</option>
            </select>
            <span className="text-[12px] text-muted-foreground">
              {meta.total} file{meta.total !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid place-items-center py-24 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : assets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-20 text-center text-[13px] text-muted-foreground">
              No files found. Upload something to get started.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  onClick={() => setSelected(asset)}
                  className={`group relative cursor-pointer overflow-hidden rounded-xl border transition-all ${
                    selected?.id === asset.id
                      ? "border-foreground ring-1 ring-foreground"
                      : "border-border hover:border-border-strong"
                  } bg-surface`}
                >
                  {/* Thumbnail */}
                  <div className="aspect-square overflow-hidden bg-surface-muted">
                    {asset.type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={asset.url}
                        alt={asset.alternativeText ?? asset.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full place-items-center">
                        <TypeIcon type={asset.type} mime={asset.mimeType} />
                      </div>
                    )}
                  </div>
                  {/* Caption */}
                  <div className="p-2">
                    <div className="truncate text-[11.5px] font-medium">{asset.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatBytes(asset.size)}
                    </div>
                  </div>
                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(asset);
                    }}
                    className="absolute right-1.5 top-1.5 hidden rounded-md bg-background/80 p-1 text-destructive backdrop-blur-sm group-hover:flex"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {(meta.page > 1 || meta.hasMore) && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={meta.page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-[12px] text-muted-foreground">Page {meta.page}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={!meta.hasMore}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>

        {/* ── Detail panel ── */}
        {selected && (
          <div className="w-56 shrink-0 space-y-3 rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium">Details</span>
              <button
                onClick={() => setSelected(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {selected.type === "image" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.url}
                alt={selected.alternativeText ?? selected.name}
                className="w-full rounded-lg object-cover"
              />
            )}
            <div className="space-y-1.5 text-[12px]">
              <div>
                <span className="text-muted-foreground">Name:</span>{" "}
                <span className="font-medium">{selected.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Type:</span> {selected.mimeType}
              </div>
              <div>
                <span className="text-muted-foreground">Size:</span> {formatBytes(selected.size)}
              </div>
              {selected.dimensions && (
                <div>
                  <span className="text-muted-foreground">Dimensions:</span>{" "}
                  {selected.dimensions.width} × {selected.dimensions.height}
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Uploaded:</span>{" "}
                {new Date(selected.timestamps.createdAt).toLocaleDateString()}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-[12px]"
              onClick={() => void navigator.clipboard.writeText(selected.url)}
            >
              Copy URL
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-[12px] text-destructive hover:text-destructive"
              onClick={() => void handleDelete(selected)}
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
