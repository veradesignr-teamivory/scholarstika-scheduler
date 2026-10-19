import { NextResponse, type NextRequest } from "next/server";
import { saveMetaConnection } from "@/lib/db";
import { GRAPH } from "@/lib/publish/common";
import { appUrl } from "@/lib/session";

type Page = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string };
};

async function getJson(url: URL) {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error?.message || res.statusText);
  return json;
}

/** Exchanges the code for a long-lived token, then stores the Page token (which does not expire) and the linked Instagram account. */
export async function GET(req: NextRequest) {
  const back = (msg: string, ok = false) =>
    NextResponse.redirect(new URL(`/settings?${ok ? "ok" : "error"}=${encodeURIComponent(msg)}`, req.url));
  const q = req.nextUrl.searchParams;
  if (q.get("error")) return back(q.get("error_description") || "Facebook sign-in was cancelled.");
  if (!q.get("code") || q.get("state") !== req.cookies.get("meta_state")?.value) {
    return back("The sign-in link expired. Try connecting again.");
  }

  try {
    const id = process.env.META_APP_ID!;
    const secret = process.env.META_APP_SECRET!;
    const redirect = `${appUrl(req.nextUrl.origin)}/api/auth/meta/callback`;

    const short = new URL(`${GRAPH}/oauth/access_token`);
    short.search = new URLSearchParams({ client_id: id, client_secret: secret, redirect_uri: redirect, code: q.get("code")! }).toString();
    const { access_token: shortToken } = await getJson(short);

    const long = new URL(`${GRAPH}/oauth/access_token`);
    long.search = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: id,
      client_secret: secret,
      fb_exchange_token: shortToken,
    }).toString();
    const { access_token: userToken } = await getJson(long);

    const accounts = new URL(`${GRAPH}/me/accounts`);
    accounts.search = new URLSearchParams({
      fields: "id,name,access_token,instagram_business_account{id,username}",
      limit: "100",
      access_token: userToken,
    }).toString();
    const { data } = (await getJson(accounts)) as { data: Page[] };
    if (!data?.length) return back("No Facebook Pages found. Make sure you selected the Scholarstika Page when approving.");

    const wanted = process.env.FB_PAGE_ID;
    const page = (wanted && data.find((p) => p.id === wanted)) || data.find((p) => /scholarstika/i.test(p.name)) || data[0];

    await saveMetaConnection({
      pageId: page.id,
      pageName: page.name,
      pageToken: page.access_token,
      igUserId: page.instagram_business_account?.id,
      igUsername: page.instagram_business_account?.username,
      connectedAt: new Date().toISOString(),
      source: "oauth",
    });
    const ig = page.instagram_business_account
      ? ` and Instagram @${page.instagram_business_account.username || page.instagram_business_account.id}`
      : ". No Instagram account is linked to this Page yet";
    return back(`Connected Facebook Page "${page.name}"${ig}.`, true);
  } catch (e) {
    return back(e instanceof Error ? e.message : String(e));
  }
}
