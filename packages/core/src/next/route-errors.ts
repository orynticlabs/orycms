import { OryCMSPluginError } from "../plugins/plugin.engine";
import { OryCMSManifestError } from "../plugins/plugin.manifest";
import { redactDetail } from "../lib/redact";
import { jsonError } from "./http";

// ── Route error handling ────────────────────────────────────────────────────────
//
// Driver and connection errors can carry a connection string, host, user name or
// constraint detail. Responses never include them. Only deliberate errors pass their
// message through: errors that carry one of the known HTTP statuses below, and the
// plugin and manifest error classes. Anything else becomes a generic 500, and the
// detail goes to the server log with credentials redacted.

/** HTTP statuses a deliberate error may carry. Anything else is treated as unexpected. */
const DELIBERATE_STATUSES: ReadonlySet<number> = new Set([
  400, 401, 403, 404, 405, 409, 410, 413, 415, 422, 429,
]);

export function logRouteDetail(context: string, detail: unknown): void {
  const message = detail instanceof Error ? detail.message : String(detail);
  console.error(`[orycms] ${context}: ${redactDetail(message)}`);
}

/** A thrown value that deliberately carries a known HTTP status and a stable code. */
export function hasDeliberateStatus(err: unknown): err is {
  statusCode: number;
  code: string;
  message: string;
  field?: string;
  issues?: unknown[];
} {
  const e = err as { statusCode?: unknown; code?: unknown } | null;
  return (
    typeof e?.statusCode === "number" &&
    DELIBERATE_STATUSES.has(e.statusCode) &&
    typeof e?.code === "string"
  );
}

/** Turns any thrown value into a response that carries no driver or connection detail. */
export function safeRouteError(context: string, err: unknown): Response {
  if (hasDeliberateStatus(err)) {
    const body: { code: string; message: string; field?: string; issues?: unknown[] } = {
      code: err.code,
      message: err.message,
    };
    if (err.field) body.field = err.field;
    if (err.issues) body.issues = err.issues;
    return Response.json({ success: false, error: body }, { status: err.statusCode });
  }

  // Plugin and manifest errors are thrown without a statusCode. Their messages are
  // written for the caller, so they pass through.
  if (err instanceof OryCMSPluginError || err instanceof OryCMSManifestError) {
    const status = err.code.endsWith("_NOT_FOUND") ? 404 : 400;
    return Response.json(
      { success: false, error: { code: err.code, message: err.message } },
      { status },
    );
  }

  logRouteDetail(context, err);
  return jsonError("INTERNAL_ERROR", "Request failed.", 500);
}
