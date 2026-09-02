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