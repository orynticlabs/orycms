export interface OryCMSApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface OryCMSApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export type OryCMSApiResponse<T = unknown> = OryCMSApiSuccessResponse<T> | OryCMSApiErrorResponse;

export interface OryCMSApiRequestContext {
  userId?: string;
  roles?: string[];
  locale?: string;
}

export type OryCMSHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface OryCMSRouteParams {
  params: Record<string, string>;
}
