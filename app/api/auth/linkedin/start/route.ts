import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/lib/session";

/**
 * Sends you to LinkedIn to approve posting. With LINKEDIN_ORG_ID set, posts go to the company page
 * (needs LinkedIn's Community Management API product); otherwise to your personal profile.
 */
export async function GET(req: NextRequest) {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) return NextResponse.redirect(new URL("/settings?error=LINKEDIN_CLIENT_ID+is+not+set", req.url));
  const scopes = ["openid", "profile", "w_member_social"];
  if (process.env.LINKEDIN_ORG_ID) scopes.push("w_organization_social", "r_organization_social");
  const state = crypto.randomUUID();
  const u = new URL("https://www.linkedin.com/oauth/v2/authorization");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", `${appUrl(req.nextUrl.origin)}/api/auth/linkedin/callback`);
  u.searchParams.set("state", state);
  u.searchParams.set("scope", scopes.join(" "));
  const res = NextResponse.redirect(u);
  res.cookies.set("li_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
