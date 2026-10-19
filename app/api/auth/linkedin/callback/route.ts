import { NextResponse, type NextRequest } from "next/server";
import { saveLinkedInConnection } from "@/lib/db";
import { appUrl } from "@/lib/session";

export async function GET(req: NextRequest) {
  const back = (msg: string, ok = false) =>
    NextResponse.redirect(new URL(`/settings?${ok ? "ok" : "error"}=${encodeURIComponent(msg)}`, req.url));
  const q = req.nextUrl.searchParams;
  if (q.get("error")) return back(q.get("error_description") || "LinkedIn sign-in was cancelled.");
  if (!q.get("code") || q.get("state") !== req.cookies.get("li_state")?.value) {
    return back("The sign-in link expired. Try connecting again.");
  }

  try {
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: q.get("code")!,
        redirect_uri: `${appUrl(req.nextUrl.origin)}/api/auth/linkedin/callback`,
        client_id: process.env.LINKEDIN_CLIENT_ID || "",
        client_secret: process.env.LINKEDIN_CLIENT_SECRET || "",
      }),
    });
    const t = await tokenRes.json();
    if (!tokenRes.ok) return back(t.error_description || "LinkedIn did not return a token.");

    const meRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${t.access_token}` },
    });
    const me = await meRes.json();
    if (!meRes.ok) return back(me.message || "Could not read your LinkedIn profile.");

    const org = process.env.LINKEDIN_ORG_ID;
    await saveLinkedInConnection({
      accessToken: t.access_token,
      expiresAt: new Date(Date.now() + t.expires_in * 1000).toISOString(),
      refreshToken: t.refresh_token,
      refreshExpiresAt: t.refresh_token_expires_in
        ? new Date(Date.now() + t.refresh_token_expires_in * 1000).toISOString()
        : undefined,
      author: org ? `urn:li:organization:${org}` : `urn:li:person:${me.sub}`,
      name: org ? `Company page ${org} (approved by ${me.name})` : me.name,
      connectedAt: new Date().toISOString(),
      source: "oauth",
    });
    return back(`Connected LinkedIn as ${org ? "company page " + org : me.name}.`, true);
  } catch (e) {
    return back(e instanceof Error ? e.message : String(e));
  }
}
