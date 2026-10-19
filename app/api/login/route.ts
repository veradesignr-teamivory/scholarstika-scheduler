import { NextResponse } from "next/server";
import { COOKIE, sessionToken } from "@/lib/session";

export async function POST(req: Request) {
  const form = await req.formData();
  const password = String(form.get("password") || "");
  const origin = new URL(req.url).origin;
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.redirect(`${origin}/login?error=setup`, 303);
  }
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.redirect(`${origin}/login?error=wrong`, 303);
  }
  const res = NextResponse.redirect(`${origin}/`, 303);
  res.cookies.set(COOKIE, await sessionToken(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE);
  return res;
}
