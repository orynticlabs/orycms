import { defineOryCMSCollection } from "@/schema";
import type { OryCMSCollectionDefinition } from "@/schema";

// FK-dependency order matters for installOryCMSCoreSchema:
//   1. orycms-migrations  (no deps)
//   2. orycms-roles       (no deps)
//   3. orycms-permissions (no deps)
//   4. orycms-settings    (no deps)
//   5. orycms-collections (no deps)
//   6. orycms-users       (→ orycms-roles)
//   7. orycms-role-permissions (→ orycms-roles, orycms-permissions)
//   8. orycms-sessions    (→ orycms-users)
//   9. orycms-collection-fields (→ orycms-collections)

const oryMigrations = defineOryCMSCollection({
  name: "OryMigrations",
  slug: "orycms-migrations",
  tableName: "orycms_migrations",
  labels: { singular: "Migration", plural: "Migrations" },
  description: "Tracks applied core schema migrations for idempotent installation.",
  fields: [
    { name: "migrationId", type: "text", required: true, unique: true },
    { name: "name", type: "text", required: true },
    { name: "appliedAt", type: "date", includeTime: true, required: true },
    { name: "durationMs", type: "number", integer: true },
    { name: "checksum", type: "text" },
  ],
});

const oryRoles = defineOryCMSCollection({
  name: "OryRoles",
  slug: "orycms-roles",
  tableName: "orycms_roles",
  labels: { singular: "Role", plural: "Roles" },
  description: "User roles used for access control.",
  fields: [
    { name: "name", type: "text", required: true, unique: true },
    { name: "description", type: "textarea" },
  ],
});

const oryPermissions = defineOryCMSCollection({
  name: "OryPermissions",
  slug: "orycms-permissions",
  tableName: "orycms_permissions",
  labels: { singular: "Permission", plural: "Permissions" },
  description: "Granular action permissions assignable to roles.",
  fields: [
    { name: "name", type: "text", required: true, unique: true },
    { name: "resource", type: "text", required: true },
    { name: "action", type: "text", required: true },
    { name: "description", type: "textarea" },
  ],
});

const orySettings = defineOryCMSCollection({
  name: "OrySettings",
  slug: "orycms-settings",
  tableName: "orycms_settings",
  labels: { singular: "Setting", plural: "Settings" },
  description: "Key/value store for CMS-wide configuration.",
  fields: [
    { name: "key", type: "text", required: true, unique: true },
    { name: "value", type: "json", required: true },
    { name: "description", type: "textarea" },
  ],
});

const oryCollections = defineOryCMSCollection({
  name: "OryCollections",
  slug: "orycms-collections",
  tableName: "orycms_collections",
  labels: { singular: "Collection", plural: "Collections" },
  description: "Registry of content collection schemas.",
  fields: [
    { name: "name", type: "text", required: true },
    { name: "collectionSlug", type: "text", required: true, unique: true },
    { name: "tableName", type: "text", required: true },
    { name: "description", type: "textarea" },
    { name: "schemaJson", type: "json" },
    { name: "isSystem", type: "boolean" },
  ],
});

const oryUsers = defineOryCMSCollection({
  name: "OryUsers",
  slug: "orycms-users",
  tableName: "orycms_users",
  labels: { singular: "User", plural: "Users" },
  description: "CMS user accounts with authentication credentials.",
  fields: [
    { name: "email", type: "email", required: true, unique: true },
    { name: "passwordHash", type: "password", required: true, private: true },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending",
      options: [
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
        { label: "Pending", value: "pending" },
      ],
    },
    {
      name: "roleId",
      type: "relation",
      target: "orycms-roles",
      cardinality: "one",
    },
  ],
});

const oryRolePermissions = defineOryCMSCollection({
  name: "OryRolePermissions",
  slug: "orycms-role-permissions",
  tableName: "orycms_role_permissions",
  labels: { singular: "Role Permission", plural: "Role Permissions" },
  description: "Junction table mapping permissions to roles.",
  fields: [
    {
      name: "roleId",
      type: "relation",
      target: "orycms-roles",
      cardinality: "one",
      required: true,
      cascadeDelete: true,
    },
    {
      name: "permissionId",
      type: "relation",
      target: "orycms-permissions",
      cardinality: "one",
      required: true,
      cascadeDelete: true,
    },
  ],
});

const orySessions = defineOryCMSCollection({
  name: "OrySessions",
  slug: "orycms-sessions",
  tableName: "orycms_sessions",
  labels: { singular: "Session", plural: "Sessions" },
  description: "Active user sessions tracked by hashed token and expiry.",
  fields: [
    {
      name: "userId",
      type: "relation",
      target: "orycms-users",
      cardinality: "one",
      required: true,
      cascadeDelete: true,
    },
    { name: "tokenHash", type: "text", required: true, unique: true },
    { name: "expiresAt", type: "date", includeTime: true, required: true },
    { name: "ipAddress", type: "text" },
    { name: "userAgent", type: "textarea" },
  ],
});

const oryCollectionFields = defineOryCMSCollection({
  name: "OryCollectionFields",
  slug: "orycms-collection-fields",
  tableName: "orycms_collection_fields",
  labels: { singular: "Collection Field", plural: "Collection Fields" },
  description: "Schema field definitions belonging to a content collection.",
  fields: [
    {
      name: "collectionId",
      type: "relation",
      target: "orycms-collections",
      cardinality: "one",
      required: true,
      cascadeDelete: true,
    },
    { name: "name", type: "text", required: true },
    {
      name: "fieldType",
      type: "select",
      required: true,
      options: [
        { label: "Text", value: "text" },
        { label: "Textarea", value: "textarea" },
        { label: "Rich Text", value: "richText" },
        { label: "Number", value: "number" },
        { label: "Boolean", value: "boolean" },
        { label: "Date", value: "date" },
        { label: "Email", value: "email" },
        { label: "Password", value: "password" },
        { label: "Select", value: "select" },
        { label: "Relation", value: "relation" },
        { label: "Media", value: "media" },
        { label: "JSON", value: "json" },
        { label: "Slug", value: "slug" },
      ],
    },
    { name: "required", type: "boolean" },
    { name: "unique", type: "boolean" },
    { name: "config", type: "json" },
    { name: "order", type: "number", integer: true },
  ],
});

const CORE_COLLECTIONS: OryCMSCollectionDefinition[] = [
  oryMigrations,
  oryRoles,
  oryPermissions,
  orySettings,
  oryCollections,
  oryUsers,
  oryRolePermissions,
  orySessions,
  oryCollectionFields,
];

export function getOryCMSCoreCollections(): OryCMSCollectionDefinition[] {
  return CORE_COLLECTIONS;
}
