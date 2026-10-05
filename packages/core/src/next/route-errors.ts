import { jsonError } from "./http";

// ── Route error handling ────────────────────────────────────────────────────────
//
// Driver and connection errors can carry a connection string, host, user name or
// constraint detail. Responses never include them. Deliberate status errors (auth,
// permission and validation failures, which carry a numeric `statusCode`) keep their
// own message. Anything else becomes a generic 500, and the detail goes to the
// server log with credentials redacted.

/** Removes anything that looks like a connection URL or a password assignment. */
export function redactDetail(text: string): string {
  return text
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, "[redacted-url]")
    .replace(/password\s*[=:]\s*\S+/gi, "password=[redacted]");
}

export function logRouteDetail(context: string, detail: unknown): void {
  const message = detail instanceof Error ? detail.message : String(detail);
  console.error(`[orycms] ${context}: ${redactDetail(message)}`);
}

/** A thrown value that deliberately carries an HTTP status and a stable code. */
export function hasDeliberateStatus(
  err: unknown,
): err is { statusCode: number; code: string; message: string } {
  const e = err as { statusCode?: unknown; code?: unknown } | null;
  return typeof e?.statusCode === "number" && typeof e?.code === "string";
}

/** Turns any thrown value into a response that carries no driver or connection detail. */
export function safeRouteError(context: string, err: unknown): Response {
  if (hasDeliberateStatus(err)) {
    return Response.json(
      { success: false, error: { code: err.code, message: err.message } },
      { status: err.statusCode },
    );
  }
  logRouteDetail(context, err);
  return jsonError("INTERNAL_ERROR", "Request failed.", 500);
}
