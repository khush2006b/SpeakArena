/**
 * Next.js Middleware — Edge Route Protection
 *
 * Runs on every request BEFORE page components execute. This is the
 * FIRST line of defense — the backend ALWAYS re-validates JWTs on
 * every API call. This middleware is purely a UX optimization.
 *
 * Cookie strategy:
 *   - `refresh_token` — HttpOnly, set by backend on login (cannot be read here)
 *   - `sa_auth`       — Non-HttpOnly boolean flag, set by client after login success,
 *                       used ONLY for middleware routing decisions
 *   - `sa_role`       — Non-HttpOnly, "TEACHER" | "STUDENT", set by client after login
 *
 * Protected patterns:
 *   /teacher/* — TEACHER role only
 *   /student/* — STUDENT role only
 *   /login, /register, etc. — redirect authenticated users away
 *
 * Client sets sa_auth and sa_role in useLogin/useRegister onSuccess callbacks.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";



export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip Next.js internals and static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const isAuthCookie = request.cookies.get("sa_auth")?.value === "1";
  // Normalize to uppercase — backend returns lowercase ("teacher"/"student")
  const userRole = (request.cookies.get("sa_role")?.value ?? "").toUpperCase();

  const isTeacherPath = pathname.startsWith("/teacher");
  const isStudentPath = pathname.startsWith("/student");


  // Unauthenticated user → redirect to login (preserve intended destination)
  if (!isAuthCookie && (isTeacherPath || isStudentPath)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role check: ONLY redirect if userRole is explicitly set to the opposite role
  if (isAuthCookie && isTeacherPath && userRole === "STUDENT") {
    return NextResponse.redirect(new URL("/student", request.url));
  }

  if (isAuthCookie && isStudentPath && userRole === "TEACHER") {
    return NextResponse.redirect(new URL("/teacher", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|og.png).*)",
  ],
};
