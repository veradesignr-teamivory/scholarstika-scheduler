import { NextResponse, type NextRequest } from "next/server";
import { adminExists, COOKIE, isValidSession } from "./lib/session";

// Reachable without signing in. Cron checks its own key; upload checks the cookie itself
// (Vercel Blob calls it back without one when an upload finishes); setup only works before an admin exists.
const PUBLIC = ["/login", "/api/login", "/api/cron", "/api/upload", "/setup", "/api/setup"];

const dbConfigured = () =>
  !!((process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
    (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN));

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();

  // Without a database the pages show setup instructions instead.
  if (!dbConfigured() && !process.env.ADMIN_PASSWORD) return NextResponse.next();

  if (await isValidSession(req.cookies.get(COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = (await adminExists().catch(() => true)) ? "/login" : "/setup";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
