/**
 * @ory-cms/core/next — framework-agnostic API route handlers.
 *
 * Mount every OryCMS API endpoint from a single Next.js catch-all route:
 *
 *   // app/api/orycms/[...ory]/route.ts
 *   import { createOryCMSRouteHandlers } from "@ory-cms/core/next";
 *   export const { GET, POST, PATCH, PUT, DELETE } = createOryCMSRouteHandlers();
 *
 * The handlers use only Web platform `Request`/`Response` (no `next/server`),
 * so they also work in any other fetch-based runtime.
 */
export { createOryCMSRouteHandlers } from "./dispatcher";
export type {
  OryCMSRoute,
  OryCMSRouteHandlers,
  OryCMSRouteHandlerOptions,
} from "./dispatcher";
export type { OryCMSHandlerContext, OryCMSEndpoint } from "./http";
export { ORYCMS_ROUTES } from "./routes";
