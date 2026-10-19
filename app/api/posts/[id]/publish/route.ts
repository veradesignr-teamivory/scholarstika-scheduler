import { NextResponse } from "next/server";
import { getPost } from "@/lib/db";
import { publishPost } from "@/lib/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** "Post now": publishes immediately, ignoring the scheduled time. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const post = await getPost((await params).id);
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  if (post.status === "posted") return NextResponse.json({ error: "Already published." }, { status: 409 });
  try {
    const summary = await publishPost(post);
    return NextResponse.json({ summary, post: await getPost(post.id) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
