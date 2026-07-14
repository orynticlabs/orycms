import type { OryCMSID, OryCMSTimestamps } from "./common.types";

export type OryCMSMediaMimeType = string;

export type OryCMSMediaType = "image" | "video" | "audio" | "document" | "archive" | "other";

export interface OryCMSMediaDimensions {
  width: number;
  height: number;
}

export interface OryCMSMediaFormat {
  url: string;
  width: number;
  height: number;
  size: number;
  mimeType: OryCMSMediaMimeType;
}

export interface OryCMSMediaFormats {
  thumbnail?: OryCMSMediaFormat;
  small?: OryCMSMediaFormat;
  medium?: OryCMSMediaFormat;
  large?: OryCMSMediaFormat;
  [key: string]: OryCMSMediaFormat | undefined;
}

export interface OryCMSMediaAsset {
  id: OryCMSID;
  name: string;
  alternativeText?: string;
  caption?: string;
  url: string;
  mimeType: OryCMSMediaMimeType;
  type: OryCMSMediaType;
  size: number;
  dimensions?: OryCMSMediaDimensions;
  formats?: OryCMSMediaFormats;
  folderId?: OryCMSID;
  uploadedBy?: string;
  timestamps: OryCMSTimestamps;
}

export interface OryCMSMediaFolder {
  id: OryCMSID;
  name: string;
  path: string;
  parentId?: OryCMSID;
  timestamps: OryCMSTimestamps;
}

export interface OryCMSCreateMediaFolderInput {
  name: string;
  parentId?: OryCMSID;
}

export interface OryCMSUpdateMediaAssetInput {
  name?: string;
  alternativeText?: string;
  caption?: string;
  folderId?: OryCMSID;
}
