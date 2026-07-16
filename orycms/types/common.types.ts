export type OryCMSID = string;

export interface OryCMSTimestamps {
  createdAt: string;
  updatedAt: string;
}

export interface OryCMSPaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface OryCMSPaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
  };
}

export interface OryCMSSortParams {
  field: string;
  direction: "asc" | "desc";
}

export interface OryCMSFilterOperator {
  eq?: unknown;
  ne?: unknown;
  gt?: unknown;
  gte?: unknown;
  lt?: unknown;
  lte?: unknown;
  in?: unknown[];
  nin?: unknown[];
  contains?: string;
  startsWith?: string;
  endsWith?: string;
}

export type OryCMSFilterParams = Record<string, OryCMSFilterOperator | unknown>;

export type OryCMSStatus = "active" | "inactive" | "draft" | "archived";

export type OryCMSLocale = string;

export interface OryCMSLocalizedValue<T> {
  [locale: OryCMSLocale]: T;
}
