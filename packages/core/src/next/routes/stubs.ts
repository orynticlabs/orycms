import { guardOryCMS, toErrorResponse, oryJsonError } from "@/lib/route-guards";
import type { OryCMSResource, OryCMSAction } from "@/rbac";
import type { OryCMSRoute } from "../dispatcher";

// Endpoints whose business logic isn't implemented yet. They still enforce
// auth + RBAC, then return 501 — identical behavior to the reference stubs.
function stub(
  method: OryCMSRoute["method"],
  pattern: string,
  resource: OryCMSResource,
  action: OryCMSAction,
  message: string,
): OryCMSRoute {
  return {
    method,
    pattern,
    handler: async ({ request }) => {
      try {
        await guardOryCMS(request, resource, action);
        return oryJsonError("NOT_IMPLEMENTED", message, 501);
      } catch (err) {
        return toErrorResponse(err);
      }
    },
  };
}

export const stubRoutes: OryCMSRoute[] = [
  // Plugins
  stub("GET", "plugins", "plugins", "read", "Plugin listing is not yet implemented."),
  stub("GET", "plugins/:slug", "plugins", "read", "Plugin detail is not yet implemented."),
  stub("POST", "plugins/:slug", "plugins", "create", "Plugin install is not yet implemented."),
  stub("PATCH", "plugins/:slug", "plugins", "update", "Plugin update is not yet implemented."),
  stub("DELETE", "plugins/:slug", "plugins", "delete", "Plugin uninstall is not yet implemented."),

  // SEO
  stub("GET", "seo/redirects", "seo", "read", "SEO redirects are not yet implemented."),
  stub("POST", "seo/redirects", "seo", "create", "SEO redirects are not yet implemented."),
  stub("PATCH", "seo/redirects/:id", "seo", "update", "SEO redirects are not yet implemented."),
  stub("DELETE", "seo/redirects/:id", "seo", "delete", "SEO redirects are not yet implemented."),
  stub("GET", "seo/sitemap", "seo", "read", "SEO sitemap is not yet implemented."),
  stub("PATCH", "seo/sitemap", "seo", "update", "SEO sitemap is not yet implemented."),

  // Commerce (guard on collections, matching the reference)
  stub("GET", "products", "collections", "read", "Product catalog is not yet implemented."),
  stub("POST", "products", "collections", "create", "Product catalog is not yet implemented."),
  stub("GET", "orders", "collections", "read", "Orders are not yet implemented."),
  stub("GET", "customers", "collections", "read", "Customers are not yet implemented."),
];
