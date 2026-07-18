import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/auth";

/**
 * Framework-agnostic HTTP primitives for the OryCMS route dispatcher.
 *
 * Everything here uses the Web platform `Request`/`Response` and the raw
 * `Cookie` / `Set-Cookie` headers — NO dependency on `next/server`. Because
 * `NextRequest`/`NextResponse` extend the Web types, the handlers work
 * unchanged inside Next.js Route Handlers.
 */

/** Context passed to every ported endpoint handler. */
export interface OryCMSHandlerContext {
  /** The incoming Web Request. */
  request: Request;
  /** Path/query params extracted from the matched route pattern (e.g. { collection, id }). */
  params: Record<string, string>;
  /** Pre-parsed URL (avoids re-parsing request.url in each handler). */
  url: URL;
}

/** A ported endpoint handler: takes the context, returns a Web Response. */
export type OryCMSEndpoint = (ctx: OryCMSHandlerContext) => Promise<Response> | Response;

// ── JSON envelopes ──────────────────────────────────────────────────────────────

export function jsonOk<T>(data: T, status = 200): Response {
  return Response.json({ success: true, data }, { status });
}

/** For handlers that spread extra top-level fields (e.g. content list `{success,...result}`). */
export function jsonRaw(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status });
}

export function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ success: false, error: { code, message } }, { status });
}

// ── Cookie helpers ──────────────────────────────────────────────────────────────

/** Read a single cookie value from the request's Cookie header. */
export function readCookie(request: Request, name: string): string | undefined {
  return (request.headers.get("cookie") ?? "")
    .split(";")
    .map((c) => c.trim().split("="))
    .find(([n]) => n === name)?.[1];
}

/** Build the Set-Cookie header value for the OryCMS session cookie. */
function sessionCookieHeader(value: string, maxAge: number): string {
  const parts = [
    `${SESSION_COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

/** Return a JSON response that also SETS the session cookie (login/refresh/accept-invite). */
export function jsonWithSession<T>(data: T, rawToken: string, status = 200): Response {
  const res = jsonOk(data, status);
  res.headers.append("Set-Cookie", sessionCookieHeader(rawToken, SESSION_MAX_AGE));
  return res;
}

/** Return a JSON response that CLEARS the session cookie (logout). */
export function jsonClearingSession<T>(data: T, status = 200): Response {
  const res = jsonOk(data, status);
  res.headers.append("Set-Cookie", sessionCookieHeader("", 0));
  return res;
}

// ── Body parsing ─────────────────────────────────────────────────────────────────

/** Parse a JSON body, tolerating an empty/absent body (returns {}). */
export async function readJsonBody<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

/** A synthetic error carrying an HTTP status, for handlers that throw ad-hoc validation errors. */
export function statusError(code: string, message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { code, statusCode });
}
