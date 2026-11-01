import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/password";
import { adminExists, COOKIE, cookieOptions, sessionToken } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const form = await req.formData();
  const password = String(form.get("password") || "");
  const origin = new URL(req.url).origin;
  if (!(await adminExists())) return NextResponse.redirect(`${origin}/setup`, 303);
  if (!(await verifyPassword(password))) {
    await new Promise((r) => setTimeout(r, 800)); // slow down password guessing
    return NextResponse.redirect(`${origin}/login?error=wrong`, 303);
  }
  const res = NextResponse.redirect(`${origin}/`, 303);
  res.cookies.set(COOKIE, await sessionToken(), cookieOptions());
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE);
  return res;
}
