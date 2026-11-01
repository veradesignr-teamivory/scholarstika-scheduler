import { NextResponse } from "next/server";
import { createAdmin, MIN_PASSWORD } from "@/lib/password";
import { adminExists, COOKIE, cookieOptions, sessionToken } from "@/lib/session";

export const runtime = "nodejs";

/** First-run only: creates the admin account, then signs you in and shows the GitHub scheduler key. */
export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  const back = (error: string) => NextResponse.redirect(`${origin}/setup?error=${error}`, 303);
  try {
    if (await adminExists()) return NextResponse.redirect(`${origin}/login?error=exists`, 303);
    const form = await req.formData();
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");
    if (password.length < MIN_PASSWORD) return back("short");
    if (password !== confirm) return back("mismatch");
    if (!(await createAdmin(password))) return NextResponse.redirect(`${origin}/login?error=exists`, 303);
    const res = NextResponse.redirect(`${origin}/settings?welcome=1`, 303);
    res.cookies.set(COOKIE, await sessionToken(), cookieOptions());
    return res;
  } catch {
    return back("db");
  }
}
