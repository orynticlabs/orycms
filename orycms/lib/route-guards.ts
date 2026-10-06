import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Pool } from "pg";
import { OryCMSAuthError, protectOryCMSAdminRoute } from "@/auth";
import type { OryCMSSessionData } from "@/auth";
import { requireOryCMSPermission } from "@/rbac";
import type { OryCMSResource, OryCMSAction } from "@/rbac";
import { getOryCMSPool } from "@/lib/db";
import { OryCMSPluginError } from "@/plugins/plugin.engine";
import { OryCMSManifestError } from "@/plugins/plugin.manifest";

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
 * Removes anything that looks like a connection URL or a password assignment.
 * Same approach as packages/core's route-errors.ts.
 */
export function redactDetail(text: string): string {
  return text
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, "[redacted-url]")
    .replace(/password\s*[=:]\s*\S+/gi, "password=[redacted]");
}

function logRouteDetail(detail: unknown): void {
  const message = detail instanceof Error ? detail.message : String(detail);
  console.error(`[orycms] ${redactDetail(message)}`);
}

/**
 * Maps any thrown value to the canonical `{ success:false, error:{...} }` envelope.
 *
 * Only deliberate errors pass their message through:
 * - Errors that carry a numeric `statusCode` and a string `code` (auth, content,
 *   collection, hook, media, migration errors). Their `issues` and `field` are kept.
 * - Plugin and manifest errors, which are thrown without a `statusCode`. They map to
 *   400, or 404 for a `*_NOT_FOUND` code.
 *
 * Everything else, including driver errors (which carry a SQLSTATE `code` and may
 * carry connection detail), becomes a generic 500 `INTERNAL_ERROR`. The detail is
 * logged server-side with URLs and password values redacted.
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

  if (err instanceof OryCMSPluginError || err instanceof OryCMSManifestError) {
    const code = err.code;
    const status = code.endsWith("_NOT_FOUND") ? 404 : 400;
    return NextResponse.json({ success: false, error: { code, message: err.message } }, { status });
  }

  logRouteDetail(err);
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
