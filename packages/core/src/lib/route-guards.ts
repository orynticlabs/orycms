import type { Pool } from "pg";
import { OryCMSAuthError, protectOryCMSAdminRoute } from "@/auth";
import type { OryCMSSessionData } from "@/auth";
import { requireOryCMSPermission } from "@/rbac";
import type { OryCMSResource, OryCMSAction } from "@/rbac";
import { getOryCMSPool } from "@/lib/db";
import { safeRouteError } from "../next/route-errors";

// Framework-agnostic: uses the Web platform Request/Response so @ory-cms/core
// carries no next/server dependency. NextRequest extends Request and
// NextResponse extends Response, so these work unchanged inside Next route handlers.

// ── Standard response envelopes ────────────────────────────────────────────────

export function oryJsonOk<T>(data: T, status = 200): Response {
  return Response.json({ success: true, data }, { status });
}

export function oryJsonError(code: string, message: string, status: number): Response {
  return Response.json({ success: false, error: { code, message } }, { status });
}

// ── Error mapping ──────────────────────────────────────────────────────────────

/**
 * Maps any thrown value to the canonical `{ success:false, error:{...} }` envelope.
 * Delegates to the shared rule in next/route-errors.ts: only deliberate errors keep
 * their message, and everything else (including driver errors) becomes a generic 500.
 */
export function toErrorResponse(err: unknown): Response {
  return safeRouteError("route", err);
}

// ── Guard ──────────────────────────────────────────────────────────────────────

/**
 * Authenticate the request and require a single permission in one call.
 * Throws OryCMSAuthError (UNAUTHORIZED / SESSION_EXPIRED / FORBIDDEN) — catch
 * with `toErrorResponse` in the route handler.
 *
 * `pool` is injectable for tests (mocked pg.Pool).
 */
export async function guardOryCMS(
  request: Request,
  resource: OryCMSResource,
  action: OryCMSAction,
  pool: Pool = getOryCMSPool(),
): Promise<OryCMSSessionData> {
  const session = await protectOryCMSAdminRoute(request, pool);
  await requireOryCMSPermission(session, resource, action, pool);
  return session;
}

// Re-export for convenience so routes import guard + error from one module.
export { OryCMSAuthError };
