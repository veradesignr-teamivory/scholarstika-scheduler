import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, isValidSession } from "./lib/session";

// Routes reachable without the admin cookie. Cron checks CRON_SECRET; upload checks the cookie itself
// (Vercel Blob calls it back without one when an upload finishes).
const PUBLIC = ["/login", "/api/login", "/api/cron", "/api/upload"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();

  if (await isValidSession(req.cookies.get(COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
