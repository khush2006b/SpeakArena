/**
 * Next.js API Route — Set HttpOnly Refresh Token Cookie
 *
 * Called by /auth/callback after Google OAuth to store the refresh token
 * as a first-party cookie on speakarena.com.
 *
 * Why this exists:
 *   The backend redirect response sets the RT cookie on speakarena.onrender.com.
 *   But the Vercel rewrite proxy makes /auth/refresh go to speakarena.com first,
 *   so the browser never sends the speakarena.onrender.com cookie.
 *   This route sets the same RT as a speakarena.com HttpOnly cookie so it
 *   IS sent on every proxied /api/v1/auth/refresh call.
 *
 * POST /api/auth/set-cookie
 *   Body: { rt: string }
 *   Sets: refresh_token HttpOnly cookie (30 days, path=/api/v1/auth/refresh)
 */

import { NextRequest, NextResponse } from "next/server";

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rt: string | undefined = body?.rt;

    if (!rt || typeof rt !== "string" || rt.length < 20) {
      return NextResponse.json({ success: false, error: "Invalid token" }, { status: 400 });
    }

    const response = NextResponse.json({ success: true });

    // Set the refresh_token cookie on speakarena.com (first-party).
    // Path is restricted to /api/v1/auth/refresh so the browser only sends
    // it on token refresh requests — matching the backend COOKIE_REFRESH_TOKEN_PATH.
    response.cookies.set("refresh_token", rt, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: THIRTY_DAYS_SECONDS,
      path: "/api/v1/auth/refresh",
    });

    return response;
  } catch {
    return NextResponse.json({ success: false, error: "Bad request" }, { status: 400 });
  }
}
