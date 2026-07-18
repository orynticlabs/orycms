import { toErrorResponse } from "@/lib/route-guards";
import type { OryCMSEndpoint, OryCMSHandlerContext } from "./http";
import { jsonError } from "./http";
import { ORYCMS_ROUTES } from "./routes";

/**
 * A registered route: an HTTP method + a segment pattern + its handler.
 * Pattern segments starting with ":" are params (e.g. ":collection").
 */
export interface OryCMSRoute {
  method: string;
  /** Path pattern relative to basePath, e.g. "collections/:collection/content/:id". */
  pattern: string;
  handler: OryCMSEndpoint;
}

export interface OryCMSRouteHandlerOptions {
  /**
   * The URL prefix these handlers are mounted under. Everything up to and
   * including this prefix is stripped before matching. Default: "/api/orycms".
   */
  basePath?: string;
}

/** The object returned to a Next.js catch-all route: one function per HTTP verb. */
export interface OryCMSRouteHandlers {
  GET: (request: Request) => Promise<Response>;
  POST: (request: Request) => Promise<Response>;
  PATCH: (request: Request) => Promise<Response>;
  PUT: (request: Request) => Promise<Response>;
  DELETE: (request: Request) => Promise<Response>;
}

// ── Matching ────────────────────────────────────────────────────────────────────

function splitPath(path: string): string[] {
  return path.split("/").filter(Boolean);
}

/**
 * Try to match `segments` against a route `pattern`. Returns the extracted
 * params on success, or null on a shape mismatch.
 */
function matchPattern(
  pattern: string,
  segments: string[],
): Record<string, string> | null {
  const patternSegs = splitPath(pattern);
  if (patternSegs.length !== segments.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternSegs.length; i++) {
    const p = patternSegs[i];
    const s = segments[i];
    if (p.startsWith(":")) {
      params[p.slice(1)] = decodeURIComponent(s);
    } else if (p !== s) {
      return null;
    }
  }
  return params;
}

// ── Factory ─────────────────────────────────────────────────────────────────────

/**
 * Build the OryCMS API route handlers as a single reusable interface.
 *
 * Mount them from ONE Next.js catch-all route
 * (`app/api/orycms/[...ory]/route.ts`):
 *
 *   import { createOryCMSRouteHandlers } from "@ory-cms/core/next";
 *   export const { GET, POST, PATCH, PUT, DELETE } = createOryCMSRouteHandlers();
 *
 * Framework-agnostic: every handler is `(Request) => Promise<Response>` using
 * only Web platform types, so no `next/server` import is required.
 */
export function createOryCMSRouteHandlers(
  options: OryCMSRouteHandlerOptions = {},
): OryCMSRouteHandlers {
  const basePath = (options.basePath ?? "/api/orycms").replace(/\/+$/, "");
  const baseSegs = splitPath(basePath);

  async function dispatch(request: Request, method: string): Promise<Response> {
    let url: URL;
    try {
      url = new URL(request.url);
    } catch {
      return jsonError("BAD_REQUEST", "Invalid request URL.", 400);
    }

    const allSegs = splitPath(url.pathname);
    // Strip the basePath prefix.
    if (
      allSegs.length < baseSegs.length ||
      baseSegs.some((seg, i) => seg !== allSegs[i])
    ) {
      return jsonError("NOT_FOUND", "Unknown OryCMS API route.", 404);
    }
    const segments = allSegs.slice(baseSegs.length);

    // Find a route whose pattern matches the path shape.
    let pathMatched = false;
    for (const route of ORYCMS_ROUTES) {
      const params = matchPattern(route.pattern, segments);
      if (!params) continue;
      pathMatched = true;
      if (route.method !== method) continue;

      const ctx: OryCMSHandlerContext = { request, params, url };
      try {
        return await route.handler(ctx);
      } catch (err) {
        // Uniform error envelope — mirrors the per-route try/catch in the app.
        return toErrorResponse(err);
      }
    }

    // Path exists but method doesn't → 405; otherwise 404.
    if (pathMatched) {
      return jsonError("METHOD_NOT_ALLOWED", `Method ${method} not allowed.`, 405);
    }
    return jsonError("NOT_FOUND", "Unknown OryCMS API route.", 404);
  }

  return {
    GET: (request) => dispatch(request, "GET"),
    POST: (request) => dispatch(request, "POST"),
    PATCH: (request) => dispatch(request, "PATCH"),
    PUT: (request) => dispatch(request, "PUT"),
    DELETE: (request) => dispatch(request, "DELETE"),
  };
}
