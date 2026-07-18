import { protectOryCMSAdminRoute } from "@/auth";
import {
  loadOryCMSPersistedCollectionsOnStartup,
  listOryCMSCollections,
  getOryCMSCollection,
  getOryCMSPersistedCollection,
  saveOryCMSCollectionSchema,
  updateOryCMSPersistedCollection,
  deleteOryCMSPersistedCollection,
} from "@/schema";
import type { OryCMSCollectionDefinition } from "@/schema";
import {
  listOryCMSContentEntries,
  createOryCMSContentEntry,
  getOryCMSContentEntry,
  updateOryCMSContentEntry,
  deleteOryCMSContentEntry,
  publishOryCMSContentEntry,
  unpublishOryCMSContentEntry,
} from "@/content";
import type { OryCMSDatabaseQueryFilter, OryCMSDatabaseSortOptions } from "@/database";
import { generateOryCMSMigrationPreview } from "@/mapper";
import {
  approveOryCMSMigration,
  executeOryCMSMigration,
  getOryCMSMigrationHistory,
  rollbackOryCMSMigration,
} from "@/migrations";
import { requireOryCMSPermission } from "@/rbac";
import type { OryCMSRoute } from "../dispatcher";
import { jsonOk, jsonRaw, jsonError, readJsonBody } from "../http";

// ── Collections registry ────────────────────────────────────────────────────────

const listCollections: OryCMSRoute = {
  method: "GET",
  pattern: "collections",
  handler: async () => {
    await loadOryCMSPersistedCollectionsOnStartup();
    return jsonOk(listOryCMSCollections());
  },
};

const createCollection: OryCMSRoute = {
  method: "POST",
  pattern: "collections",
  handler: async ({ request }) => {
    await loadOryCMSPersistedCollectionsOnStartup();
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "collections", "create");
    const body = (await request.json()) as OryCMSCollectionDefinition;
    const collection = await saveOryCMSCollectionSchema(body);
    return jsonOk(collection, 201);
  },
};

const getCollection: OryCMSRoute = {
  method: "GET",
  pattern: "collections/:collection",
  handler: async ({ params }) => {
    await loadOryCMSPersistedCollectionsOnStartup();
    const schema = getOryCMSCollection(params.collection);
    if (!schema) {
      return jsonError("NOT_FOUND", `Collection "${params.collection}" not found.`, 404);
    }
    return jsonOk(schema);
  },
};

const updateCollection: OryCMSRoute = {
  method: "PATCH",
  pattern: "collections/:collection",
  handler: async ({ request, params }) => {
    await loadOryCMSPersistedCollectionsOnStartup();
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "collections", "update");
    const body = (await request.json()) as OryCMSCollectionDefinition;
    const updated = await updateOryCMSPersistedCollection(params.collection, body);
    return jsonOk(updated);
  },
};

const deleteCollection: OryCMSRoute = {
  method: "DELETE",
  pattern: "collections/:collection",
  handler: async ({ request, params }) => {
    await loadOryCMSPersistedCollectionsOnStartup();
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "collections", "delete");
    await deleteOryCMSPersistedCollection(params.collection);
    return jsonOk(null);
  },
};

// ── Content ─────────────────────────────────────────────────────────────────────

const listContent: OryCMSRoute = {
  method: "GET",
  pattern: "collections/:collection/content",
  handler: async ({ url, params }) => {
    const page = Number(url.searchParams.get("page") ?? 1);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
    const includeDrafts = url.searchParams.get("drafts") === "true";

    const filters: OryCMSDatabaseQueryFilter[] = [];
    for (const [key, val] of url.searchParams.entries()) {
      const m = key.match(/^filter\[(.+?)\]\[(.+?)\]$/);
      if (m) {
        filters.push({
          field: m[1],
          operator: m[2] as OryCMSDatabaseQueryFilter["operator"],
          value: val,
        });
      }
    }

    const sort: OryCMSDatabaseSortOptions[] = (url.searchParams.get("sort") ?? "")
      .split(",")
      .filter(Boolean)
      .map((s) => {
        const [field, dir] = s.split(":");
        return { field, direction: (dir === "asc" ? "asc" : "desc") as "asc" | "desc" };
      });

    const result = await listOryCMSContentEntries(params.collection, {
      filters,
      sort,
      page,
      limit,
      includeDrafts,
    });
    return jsonRaw({ success: true, ...result });
  },
};

const createContent: OryCMSRoute = {
  method: "POST",
  pattern: "collections/:collection/content",
  handler: async ({ request, params }) => {
    await protectOryCMSAdminRoute(request);
    const body = (await request.json()) as { data?: Record<string, unknown>; asDraft?: boolean };
    if (!body.data || typeof body.data !== "object") {
      return jsonError("VALIDATION_ERROR", "Body must contain a `data` object.", 422);
    }
    const entry = await createOryCMSContentEntry(params.collection, {
      data: body.data,
      asDraft: body.asDraft,
    });
    return jsonOk(entry, 201);
  },
};

const getContent: OryCMSRoute = {
  method: "GET",
  pattern: "collections/:collection/content/:id",
  handler: async ({ params }) => {
    const entry = await getOryCMSContentEntry(params.collection, params.id);
    return jsonOk(entry);
  },
};

const updateContent: OryCMSRoute = {
  method: "PATCH",
  pattern: "collections/:collection/content/:id",
  handler: async ({ request, params }) => {
    await protectOryCMSAdminRoute(request);
    const body = (await request.json()) as { data?: Record<string, unknown> };
    if (!body.data || typeof body.data !== "object") {
      return jsonError("VALIDATION_ERROR", "Body must contain a `data` object.", 422);
    }
    const entry = await updateOryCMSContentEntry(params.collection, params.id, { data: body.data });
    return jsonOk(entry);
  },
};

const deleteContent: OryCMSRoute = {
  method: "DELETE",
  pattern: "collections/:collection/content/:id",
  handler: async ({ request, params }) => {
    await protectOryCMSAdminRoute(request);
    await deleteOryCMSContentEntry(params.collection, params.id);
    return jsonOk(null);
  },
};

const publishContent: OryCMSRoute = {
  method: "POST",
  pattern: "collections/:collection/content/:id/publish",
  handler: async ({ request, params }) => {
    await protectOryCMSAdminRoute(request);
    const entry = await publishOryCMSContentEntry(params.collection, params.id);
    return jsonOk(entry);
  },
};

const unpublishContent: OryCMSRoute = {
  method: "DELETE",
  pattern: "collections/:collection/content/:id/publish",
  handler: async ({ request, params }) => {
    await protectOryCMSAdminRoute(request);
    const entry = await unpublishOryCMSContentEntry(params.collection, params.id);
    return jsonOk(entry);
  },
};

// ── Fields (501 stubs — logic not yet implemented) ────────────────────────────────

const listFields: OryCMSRoute = {
  method: "GET",
  pattern: "collections/:collection/fields",
  handler: async ({ request }) => {
    await protectOryCMSAdminRoute(request);
    return jsonError("NOT_IMPLEMENTED", "Collection fields are not yet implemented.", 501);
  },
};
const createField: OryCMSRoute = {
  method: "POST",
  pattern: "collections/:collection/fields",
  handler: async ({ request }) => {
    await protectOryCMSAdminRoute(request);
    return jsonError("NOT_IMPLEMENTED", "Collection fields are not yet implemented.", 501);
  },
};
const updateField: OryCMSRoute = {
  method: "PATCH",
  pattern: "collections/:collection/fields/:id",
  handler: async ({ request }) => {
    await protectOryCMSAdminRoute(request);
    return jsonError("NOT_IMPLEMENTED", "Collection fields are not yet implemented.", 501);
  },
};
const deleteField: OryCMSRoute = {
  method: "DELETE",
  pattern: "collections/:collection/fields/:id",
  handler: async ({ request }) => {
    await protectOryCMSAdminRoute(request);
    return jsonError("NOT_IMPLEMENTED", "Collection fields are not yet implemented.", 501);
  },
};

// ── Migrations ────────────────────────────────────────────────────────────────────

const migrationPreview: OryCMSRoute = {
  method: "POST",
  pattern: "collections/:collection/migration-preview",
  handler: async ({ request, params }) => {
    await loadOryCMSPersistedCollectionsOnStartup();
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "migrations", "manage");
    const schema = await getOryCMSPersistedCollection(params.collection);
    if (!schema) {
      return jsonError("NOT_FOUND", `Collection "${params.collection}" not found.`, 404);
    }
    const preview = await generateOryCMSMigrationPreview(schema);
    return jsonOk(preview);
  },
};

const migrationHistory: OryCMSRoute = {
  method: "GET",
  pattern: "collections/:collection/migrations",
  handler: async ({ request, params }) => {
    await loadOryCMSPersistedCollectionsOnStartup();
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "migrations", "manage");
    const history = await getOryCMSMigrationHistory(params.collection);
    return jsonOk(history);
  },
};

const migrationAction: OryCMSRoute = {
  method: "POST",
  pattern: "collections/:collection/migrations",
  handler: async ({ request, params }) => {
    await loadOryCMSPersistedCollectionsOnStartup();
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "migrations", "manage");
    const body = (await request.json()) as {
      action: "approve" | "execute";
      migrationId?: string;
      confirmDestructive?: boolean;
    };

    if (body.action === "approve") {
      const schema = await getOryCMSPersistedCollection(params.collection);
      if (!schema) {
        return jsonError("NOT_FOUND", `Collection "${params.collection}" not found.`, 404);
      }
      const preview = await generateOryCMSMigrationPreview(schema);
      const record = await approveOryCMSMigration(preview, session.email, {
        confirmDestructive: body.confirmDestructive,
      });
      return jsonOk(record, 201);
    }

    if (body.action === "execute") {
      if (!body.migrationId) {
        return jsonError("VALIDATION_ERROR", "migrationId required for execute.", 422);
      }
      const record = await executeOryCMSMigration(body.migrationId, session.email);
      return jsonOk(record);
    }

    return jsonError("VALIDATION_ERROR", 'action must be "approve" or "execute".', 422);
  },
};

const migrationRollback: OryCMSRoute = {
  method: "POST",
  pattern: "collections/:collection/migrations/:id/rollback",
  handler: async ({ request, params }) => {
    await loadOryCMSPersistedCollectionsOnStartup();
    const session = await protectOryCMSAdminRoute(request);
    await requireOryCMSPermission(session, "migrations", "manage");
    const record = await rollbackOryCMSMigration(params.id, session.email);
    return jsonOk(record);
  },
};

export const collectionRoutes: OryCMSRoute[] = [
  listCollections,
  createCollection,
  getCollection,
  updateCollection,
  deleteCollection,
  listContent,
  createContent,
  getContent,
  updateContent,
  deleteContent,
  publishContent,
  unpublishContent,
  listFields,
  createField,
  updateField,
  deleteField,
  migrationPreview,
  migrationHistory,
  migrationAction,
  migrationRollback,
];
