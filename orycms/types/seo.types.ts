import type { OryCMSID, OryCMSTimestamps } from "./common.types";

export interface OryCMSSeoMeta {
  title?: string;
  description?: string;
  keywords?: string[];
  canonicalUrl?: string;
  noIndex?: boolean;
  noFollow?: boolean;
}

export interface OryCMSOpenGraphMeta {
  title?: string;
  description?: string;
  image?: string;
  imageAlt?: string;
  type?: string;
  siteName?: string;
  locale?: string;
}

export interface OryCMSTwitterMeta {
  card?: "summary" | "summary_large_image" | "app" | "player";
  title?: string;
  description?: string;
  image?: string;
  imageAlt?: string;
  site?: string;
  creator?: string;
}

export interface OryCMSSeoPage {
  id: OryCMSID;
  path: string;
  title?: string;
  seo: OryCMSSeoMeta;
  openGraph?: OryCMSOpenGraphMeta;
  twitter?: OryCMSTwitterMeta;
  structuredData?: Record<string, unknown>;
  timestamps: OryCMSTimestamps;
}

export type OryCMSRedirectType = 301 | 302 | 307 | 308;

export interface OryCMSRedirect {
  id: OryCMSID;
  from: string;
  to: string;
  type: OryCMSRedirectType;
  isActive: boolean;
  timestamps: OryCMSTimestamps;
}

export interface OryCMSCreateRedirectInput {
  from: string;
  to: string;
  type?: OryCMSRedirectType;
}

export interface OryCMSSitemapSettings {
  enabled: boolean;
  includeImages: boolean;
  changeFrequency: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority: number;
  excludedPaths: string[];
}
