import { NextResponse } from "next/server";
import { getPost, savePost } from "@/lib/db";
import { CHANNELS, type Channel, type Media, type Post } from "@/lib/types";
import { readinessProblems } from "@/lib/validate";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const post = await getPost((await params).id);
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  return NextResponse.json({ post, problems: readinessProblems(post) });
}

const isMedia = (m: unknown): m is Media =>
  !!m && typeof m === "object" && typeof (m as Media).url === "string" && typeof (m as Media).contentType === "string";

/** Saves edits. `action` can be "ready", "draft" or "retry". */
export async function PATCH(req: Request, { params }: Ctx) {
  const post = await getPost((await params).id);
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  const body = (await req.json()) as Partial<Post> & { action?: "ready" | "draft" | "retry" };

  if (post.status === "posting" || post.status === "posted") {
    const onlyAction = body.action === "retry" && post.status !== "posted";
    if (!onlyAction && Object.keys(body).some((k) => k !== "action")) {
      return NextResponse.json({ error: "This post is publishing or already published, so it can't be edited." }, { status: 409 });
    }
  }

  if (typeof body.caption === "string") post.caption = body.caption;
  if (typeof body.hashtags === "string") post.hashtags = body.hashtags;
  if (typeof body.heading === "string") post.heading = body.heading;
  if (typeof body.scheduledAt === "string" && !Number.isNaN(Date.parse(body.scheduledAt))) {
    post.scheduledAt = new Date(body.scheduledAt).toISOString();
  }
  if (post.kind === "blog") {
    post.channels = ["wordpress"];
    if (typeof body.article === "string") post.article = body.article;
    const meta = (body as { blogMeta?: unknown }).blogMeta;
    if (typeof meta === "string" && post.blog) post.blog = { ...post.blog, meta };
  } else if (Array.isArray(body.channels)) {
    post.channels = body.channels.filter((c): c is Channel => CHANNELS.includes(c as Channel));
  }
  if (Array.isArray(body.media)) post.media = body.media.filter(isMedia);
  if (body.cover === null || isMedia(body.cover)) post.cover = body.cover;

  if (body.action === "ready") {
    const problems = readinessProblems(post);
    if (problems.length) {
      await savePost(post);
      return NextResponse.json({ error: problems.join(" "), problems, post }, { status: 400 });
    }
    for (const ch of post.channels) {
      const r = post.results[ch];
      if (r && r.status === "failed") post.results[ch] = { ...r, attempts: 0, status: "pending" };
    }
    post.status = "ready";
  } else if (body.action === "draft" && post.status !== "manual") {
    post.status = "draft";
  } else if (body.action === "retry") {
    for (const ch of post.channels) {
      const r = post.results[ch];
      if (r && r.status === "failed") post.results[ch] = { ...r, attempts: 0, status: "pending" };
    }
    post.status = "ready";
  }

  await savePost(post);
  return NextResponse.json({ post, problems: readinessProblems(post) });
}
