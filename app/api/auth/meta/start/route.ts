import { NextResponse, type NextRequest } from "next/server";
import { GRAPH_VERSION } from "@/lib/publish/common";
import { getMetaApp } from "@/lib/credentials";
import { appUrl } from "@/lib/session";

const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "pages_manage_engagement",
  "pages_read_user_engagement",
  "business_management",
  "instagram_basic",
  "instagram_content_publish",
].join(",");

/** Sends you to Facebook to approve posting to your Page and its linked Instagram account. */
export async function GET(req: NextRequest) {
  const app = await getMetaApp();
  if (!app) return NextResponse.redirect(new URL("/connect?error=" + encodeURIComponent("Save your Meta App ID and App Secret first."), req.url));
  const appId = app.appId;
  const state = crypto.randomUUID();
  const u = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  u.searchParams.set("client_id", appId);
  u.searchParams.set("redirect_uri", `${appUrl(req.nextUrl.origin)}/api/auth/meta/callback`);
  u.searchParams.set("state", state);
  u.searchParams.set("scope", META_SCOPES);
  const res = NextResponse.redirect(u);
  res.cookies.set("meta_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
