import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Pool } from "pg";
import { OryCMSAuthError, protectOryCMSAdminRoute } from "@/auth";
import type { OryCMSSessionData } from "@/auth";
import { requireOryCMSPermission } from "@/rbac";
import type { OryCMSResource, OryCMSAction } from "@/rbac";
import { getOryCMSPool } from "@/lib/db";

// ── Standard response envelopes ────────────────────────────────────────────────

export function oryJsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

export function oryJsonError(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

// ── Error mapping ──────────────────────────────────────────────────────────────

/** Shape shared by every domain error that carries an HTTP status. */
interface StatusfulError {
  code: string;
  message: string;
  statusCode: number;
  issues?: unknown[];
  field?: string;
}

function hasStatusCode(err: unknown): err is StatusfulError {
  if (!(err instanceof Error)) return false;
  const e = err as unknown as Record<string, unknown>;
  return typeof e.statusCode === "number" && typeof e.code === "string";
}

/**
 * Maps any thrown value to the canonical `{ success:false, error:{...} }` envelope.
 *
 * - Auth / Content / CollectionPersistence / Hook / Media errors all expose
 *   `code` + `statusCode` → mapped generically (preserving `issues`/`field`).
 * - Plugin / Manifest errors have `code` but NO `statusCode` → default to 400.
 * - Everything else → 500 INTERNAL_ERROR (message hidden).
 */
export function toErrorResponse(err: unknown): NextResponse {
  if (hasStatusCode(err)) {
    const body: { code: string; message: string; issues?: unknown[]; field?: string } = {
      code: err.code,
      message: err.message,
    };
    if (err.issues) body.issues = err.issues;
    if (err.field) body.field = err.field;
    return NextResponse.json({ success: false, error: body }, { status: err.statusCode });
  }

  // Plugin/Manifest errors: have `code` but no statusCode.
  if (err instanceof Error && typeof (err as unknown as Record<string, unknown>).code === "string") {
    const code = (err as unknown as Record<string, unknown>).code as string;
    const status = code.endsWith("_NOT_FOUND") ? 404 : 400;
    return NextResponse.json(
      { success: false, error: { code, message: err.message } },
      { status },
    );
  }

  return NextResponse.json(
    { success: false, error: { code: "INTERNAL_ERROR", message: "Request failed." } },
    { status: 500 },
  );
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
  request: NextRequest,
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
