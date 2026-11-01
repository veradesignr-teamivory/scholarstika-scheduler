import { NextResponse } from "next/server";
import { clearConfig, publicConfig, saveConfig } from "@/lib/credentials";
import { saveLinkedInConnection, saveMetaConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

const PLATFORMS = ["meta", "linkedin", "wordpress"] as const;
type Platform = (typeof PLATFORMS)[number];
const isPlatform = (p: unknown): p is Platform => PLATFORMS.includes(p as Platform);

/** Signed-in only (middleware). Settings without secrets. */
export async function GET() {
  return NextResponse.json(await publicConfig());
}

/** Save one platform's keys: { platform, values }. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!isPlatform(body.platform)) return NextResponse.json({ error: "Unknown platform." }, { status: 400 });
  const v = body.values || {};
  const before = await publicConfig();

  if (body.platform === "meta") {
    if (!/^\d{6,20}$/.test(String(v.appId || "").trim())) {
      return NextResponse.json({ error: "The App ID should be a long number, e.g. 1234567890123456. Copy it from App settings → Basic." }, { status: 400 });
    }
    if (!String(v.appSecret || "").trim() && !before.meta.hasSecret) {
      return NextResponse.json({ error: "Paste the App Secret too (App settings → Basic → App secret → Show)." }, { status: 400 });
    }
    if (String(v.configId || "").trim() && !/^\d{6,25}$/.test(String(v.configId).trim())) {
      return NextResponse.json({ error: "The Configuration ID should be a long number. Copy it from Facebook Login for Business → Configurations." }, { status: 400 });
    }
  } else if (body.platform === "linkedin") {
    if (!String(v.clientId || "").trim()) return NextResponse.json({ error: "Paste the Client ID from the Auth tab of your LinkedIn app." }, { status: 400 });
    if (!String(v.clientSecret || "").trim() && !before.linkedin.hasSecret) {
      return NextResponse.json({ error: "Paste the Primary Client Secret too (Auth tab)." }, { status: 400 });
    }
  } else {
    if (!String(v.siteUrl || "").trim() || !String(v.username || "").trim()) {
      return NextResponse.json({ error: "Enter your site address and WordPress username." }, { status: 400 });
    }
    if (!String(v.appPassword || "").trim() && !before.wordpress.hasSecret) {
      return NextResponse.json({ error: "Paste the Application Password you created in WordPress." }, { status: 400 });
    }
  }

  await saveConfig(body.platform, v);
  return NextResponse.json({ ok: true, config: await publicConfig() });
}

/** Remove a platform's keys and its connection: ?platform=meta */
export async function DELETE(req: Request) {
  const platform = new URL(req.url).searchParams.get("platform");
  if (!isPlatform(platform)) return NextResponse.json({ error: "Unknown platform." }, { status: 400 });
  await clearConfig(platform);
  if (platform === "meta") await saveMetaConnection(null);
  if (platform === "linkedin") await saveLinkedInConnection(null);
  return NextResponse.json({ ok: true, config: await publicConfig() });
}
