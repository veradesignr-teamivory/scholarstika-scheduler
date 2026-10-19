import { NextResponse } from "next/server";
import { getMetaConnection, getWordPressConnection, saveLinkedInConnection, saveMetaConnection } from "@/lib/db";
import { graphGet } from "@/lib/publish/common";
import { wpFetch } from "@/lib/publish/wordpress";
import { liveLinkedIn } from "@/lib/linkedin-auth";

export const dynamic = "force-dynamic";

/** Tests each saved connection against the real APIs. */
export async function GET() {
  const out: Record<string, { ok: boolean; detail: string }> = {};

  const meta = await getMetaConnection();
  if (!meta) {
    out.facebook = { ok: false, detail: "Not connected." };
    out.instagram = { ok: false, detail: "Not connected." };
  } else {
    try {
      const page = await graphGet(meta.pageId, meta.pageToken, "name");
      out.facebook = { ok: true, detail: `Page "${page.name}"` };
    } catch (e) {
      out.facebook = { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
    if (!meta.igUserId) out.instagram = { ok: false, detail: "No Instagram professional account is linked to this Facebook Page." };
    else {
      try {
        const ig = await graphGet(meta.igUserId, meta.pageToken, "username");
        out.instagram = { ok: true, detail: `@${ig.username}` };
      } catch (e) {
        out.instagram = { ok: false, detail: e instanceof Error ? e.message : String(e) };
      }
    }
  }

  const li = await liveLinkedIn();
  if (!li) out.linkedin = { ok: false, detail: "Not connected." };
  else {
    const res = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${li.accessToken}` } });
    const days = li.expiresAt ? Math.round((new Date(li.expiresAt).getTime() - Date.now()) / 864e5) : null;
    out.linkedin = res.ok
      ? { ok: true, detail: `${li.name}${days !== null ? ` · token valid for ${days} more days` : ""}` }
      : { ok: false, detail: `Token rejected (${res.status}). Reconnect LinkedIn.` };
  }
  const wp = getWordPressConnection();
  if (!wp) out.wordpress = { ok: false, detail: "Not connected. Add WP_URL, WP_USERNAME and WP_APP_PASSWORD in Vercel." };
  else {
    try {
      const me = await wpFetch(wp, "users/me?context=edit");
      const canPublish = me?.capabilities?.publish_posts !== false;
      out.wordpress = canPublish
        ? { ok: true, detail: `${wp.siteUrl} as ${me.name} · new posts are ${wp.status === "publish" ? "published" : `saved as ${wp.status}`}` }
        : { ok: false, detail: `${me.name} can't publish posts. Use an Administrator, Editor or Author account.` };
    } catch (e) {
      out.wordpress = { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  }
  return NextResponse.json(out);
}

export async function DELETE(req: Request) {
  const which = new URL(req.url).searchParams.get("which");
  if (which === "meta") await saveMetaConnection(null);
  if (which === "linkedin") await saveLinkedInConnection(null);
  return NextResponse.json({ ok: true });
}
