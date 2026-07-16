import type { OryCMSID, OryCMSTimestamps } from "./common.types";

export type OryCMSContentStatus = "draft" | "published" | "archived";

export type OryCMSContentData = Record<string, unknown>;

export interface OryCMSContentEntry {
  id: OryCMSID;
  collectionSlug: string;
  status: OryCMSContentStatus;
  locale: string;
  data: OryCMSContentData;
  publishedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  timestamps: OryCMSTimestamps;
}

export interface OryCMSCreateContentInput {
  collectionSlug: string;
  locale?: string;
  status?: OryCMSContentStatus;
  data: OryCMSContentData;
}

export interface OryCMSUpdateContentInput {
  status?: OryCMSContentStatus;
  locale?: string;
  data?: Partial<OryCMSContentData>;
}

export interface OryCMSPublishContentInput {
  publishedAt?: string;
}

export interface OryCMSContentVersion {
  id: OryCMSID;
  contentId: OryCMSID;
  data: OryCMSContentData;
  createdBy: string;
  createdAt: string;
}
