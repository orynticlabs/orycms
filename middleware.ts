import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ── Public surfaces ─────────────────────────────────────────────────────────

/** Page routes that never require a session. */
const PUBLIC_PAGES = new Set([
  "/login",
  "/setup",
  "/accept-invite",
  "/activate",
  "/reset-password",
  "/forgot-password",
]);

/** All auth API routes are public. */
const PUBLIC_API_PREFIX = "/api/orycms/auth/";

/**
 * Public content read API routes — GET only.
 * Pattern: /api/orycms/collections/<slug>/content (list)
 *          /api/orycms/collections/<slug>/content/<id> (single, no further segments)
 *
 * POST/PATCH/DELETE on these same paths still require a session —
 * the check is done per-request based on method.
 */
const PUBLIC_CONTENT_GET_RE = /^\/api\/orycms\/collections\/[^/]+\/content(?:\/[^/]+)?$/;

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns true when the `from` value is safe to use as a redirect target:
 * - Must be a relative path (starts with /)
 * - Must not start with // (protocol-relative → external redirect)
 * - Must not be /login or /setup (would cause redirect loops)
 */
function isSafeFrom(from: string | null): from is string {
  if (!from) return false;
  if (!from.startsWith("/") || from.startsWith("//")) return false;
  if (from === "/login" || from === "/setup") return false;
  return true;
}

// ── Middleware ───────────────────────────────────────────────────────────────

export function middleware(request: NextRequest) {
  const { pathname, method } = request.nextUrl;
  const requestMethod = request.method ?? method ?? "GET";

  // Auth API — always public
  if (pathname.startsWith(PUBLIC_API_PREFIX)) return NextResponse.next();

  // Public page routes
  if (PUBLIC_PAGES.has(pathname)) return NextResponse.next();

  // Public content GET endpoints (read-only, no session required)
  if (requestMethod === "GET" && PUBLIC_CONTENT_GET_RE.test(pathname)) {
    return NextResponse.next();
  }

  // Everything else requires a session
  const sessionCookie = request.cookies.get("orycms_session");
  if (!sessionCookie?.value) {
    const loginUrl = new URL("/login", request.url);
    // Only carry `from` for safe relative paths — prevents open-redirect
    if (isSafeFrom(pathname)) {
      loginUrl.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match everything except Next.js internals and static assets
    "/((?!_next/static|_next/image|favicon|.*\\.png$|.*\\.ico$).*)",
  ],
};
