import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/cookies";

/**
 * Fast redirect for requests with no session cookie at all.
 *
 * This is a user-experience optimisation, not a security boundary: a forged or
 * expired cookie still reaches the dashboard, where `requireUser` validates the
 * session against the database. Never rely on this check for authorization.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.get(SESSION_COOKIE)?.value) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
