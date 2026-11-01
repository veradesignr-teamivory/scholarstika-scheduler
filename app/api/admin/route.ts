import { NextResponse } from "next/server";
import { changePassword, MIN_PASSWORD, regenerateCronSecret, verifyPassword } from "@/lib/password";
import { COOKIE, cookieOptions, cronSecret, sessionToken } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Signed-in only (middleware). Returns the GitHub scheduler key so the settings page can show it. */
export async function GET() {
  return NextResponse.json({
    cronKey: await cronSecret(),
    fromEnv: { password: !!process.env.ADMIN_PASSWORD, cron: !!process.env.CRON_SECRET },
  });
}

/** action "password": change the admin password · action "cron": make a new scheduler key. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.action === "password") {
    if (process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "The password is set by ADMIN_PASSWORD in Vercel. Change it there, or delete it to manage the password here." }, { status: 409 });
    }
    if (!(await verifyPassword(String(body.current || "")))) {
      return NextResponse.json({ error: "Your current password is incorrect." }, { status: 400 });
    }
    const next = String(body.next || "");
    if (next.length < MIN_PASSWORD) return NextResponse.json({ error: `Use at least ${MIN_PASSWORD} characters.` }, { status: 400 });
    await changePassword(next);
    const res = NextResponse.json({ ok: true, message: "Password changed. Other browsers have been signed out." });
    res.cookies.set(COOKIE, await sessionToken(), cookieOptions());
    return res;
  }
  if (body.action === "cron") {
    if (process.env.CRON_SECRET) {
      return NextResponse.json({ error: "The key is set by CRON_SECRET in Vercel. Change it there." }, { status: 409 });
    }
    return NextResponse.json({ cronKey: await regenerateCronSecret(), message: "New key created. Update the CRON_SECRET secret in GitHub." });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
