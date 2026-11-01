import { NextResponse } from "next/server";
import { runDue } from "@/lib/scheduler";
import { cronSecret } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Called every 15 minutes by Vercel Cron (see vercel.json), or by any external cron service.
 * The key is generated at first-time setup (shown on the settings page), or CRON_SECRET in Vercel.
 */
export async function GET(req: Request) {
  const secret = await cronSecret();
  const auth = req.headers.get("authorization");
  const key = new URL(req.url).searchParams.get("key");
  if (!secret || (auth !== `Bearer ${secret}` && key !== secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runDue("cron"));
}
