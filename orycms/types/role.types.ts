import type { OryCMSID, OryCMSTimestamps } from "./common.types";

export type OryCMSPermissionAction = "create" | "read" | "update" | "delete" | "publish" | "manage";

export type OryCMSPermissionSubject =
  | "collection"
  | "content"
  | "media"
  | "user"
  | "role"
  | "plugin"
  | "database"
  | "seo"
  | "settings"
  | "all";

export interface OryCMSPermission {
  action: OryCMSPermissionAction;
  subject: OryCMSPermissionSubject;
  conditions?: Record<string, unknown>;
}

export interface OryCMSRole {
  id: OryCMSID;
  name: string;
  description?: string;
  isSystem: boolean;
  permissions: OryCMSPermission[];
  userCount: number;
  timestamps: OryCMSTimestamps;
}

export interface OryCMSCreateRoleInput {
  name: string;
  description?: string;
  permissions?: OryCMSPermission[];
}

export interface OryCMSUpdateRoleInput {
  name?: string;
  description?: string;
  permissions?: OryCMSPermission[];
}
