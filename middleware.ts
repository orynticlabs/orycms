import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public paths that never need a session
const PUBLIC = new Set(["/login", "/setup"]);
const PUBLIC_API = "/api/orycms/auth/";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // All auth API routes are always public
  if (pathname.startsWith(PUBLIC_API)) return NextResponse.next();

  // Non-API public pages
  if (PUBLIC.has(pathname)) return NextResponse.next();

  // All other routes require a session cookie
  const sessionCookie = request.cookies.get("orycms_session");
  if (!sessionCookie?.value) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
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
