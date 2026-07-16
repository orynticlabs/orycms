import type { OryCMSID, OryCMSTimestamps, OryCMSStatus } from "./common.types";

export type OryCMSFieldType =
  | "text"
  | "rich_text"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "email"
  | "url"
  | "slug"
  | "media"
  | "relation"
  | "json"
  | "select"
  | "multi_select"
  | "color"
  | "component"
  | "repeatable";

export interface OryCMSFieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  unique?: boolean;
}

export interface OryCMSFieldOption {
  label: string;
  value: string;
}

export interface OryCMSField {
  id: OryCMSID;
  name: string;
  label: string;
  type: OryCMSFieldType;
  description?: string;
  placeholder?: string;
  defaultValue?: unknown;
  validation?: OryCMSFieldValidation;
  options?: OryCMSFieldOption[];
  relationTo?: string;
  localized?: boolean;
  private?: boolean;
  sortOrder: number;
}

export interface OryCMSCollectionSettings {
  draftAndPublish: boolean;
  localization: boolean;
  softDelete: boolean;
  timestamps: boolean;
  searchable: boolean;
  populateCreatedBy: boolean;
}

export interface OryCMSCollection {
  id: OryCMSID;
  slug: string;
  name: string;
  singularName: string;
  description?: string;
  icon?: string;
  status: OryCMSStatus;
  fields: OryCMSField[];
  settings: OryCMSCollectionSettings;
  timestamps: OryCMSTimestamps;
}

export interface OryCMSCreateCollectionInput {
  slug: string;
  name: string;
  singularName: string;
  description?: string;
  icon?: string;
  fields?: Omit<OryCMSField, "id" | "sortOrder">[];
  settings?: Partial<OryCMSCollectionSettings>;
}

export interface OryCMSUpdateCollectionInput {
  name?: string;
  singularName?: string;
  description?: string;
  icon?: string;
  status?: OryCMSStatus;
  settings?: Partial<OryCMSCollectionSettings>;
}
