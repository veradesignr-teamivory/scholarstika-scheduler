import { getMetaConnection, getPosts, getWordPressConnection, logRun, redis, savePost } from "./db";
import { publishWordPress } from "./publish/wordpress";
import { liveLinkedIn } from "./linkedin-auth";
import { PublishError, type PublishOutcome } from "./publish/common";
import { publishFacebook } from "./publish/facebook";
import { publishInstagram } from "./publish/instagram";
import { publishLinkedIn } from "./publish/linkedin";
import type { Channel, ChannelResult, Post } from "./types";
import { readinessProblems } from "./validate";

const MAX_ATTEMPTS = 3;

type Summary = { id: string; heading: string; channels: Partial<Record<Channel, string>> };

/** Publishes one post to every channel that hasn't succeeded yet. Safe to call repeatedly. */
export async function publishPost(post: Post): Promise<Summary> {
  const summary: Summary = { id: post.id, heading: post.heading, channels: {} };
  const problems = readinessProblems(post);
  if (problems.length) throw new PublishError(problems.join(" "));

  const meta = post.channels.some((c) => c === "facebook" || c === "instagram") ? await getMetaConnection() : null;
  const li = post.channels.includes("linkedin") ? await liveLinkedIn() : null;

  post.status = "posting";
  await savePost(post);

  for (const ch of post.channels) {
    const prev = post.results[ch];
    if (prev?.status === "posted") continue;
    if (prev?.status === "failed" && prev.attempts >= MAX_ATTEMPTS) continue;

    const result: ChannelResult = { status: "pending", attempts: (prev?.attempts || 0) + 1, pending: prev?.pending };
    try {
      let out: PublishOutcome;
      if (ch === "facebook") {
        if (!meta) throw new PublishError("Facebook is not connected. Open Settings and connect it.");
        out = await publishFacebook(post, meta);
      } else if (ch === "instagram") {
        if (!meta) throw new PublishError("Instagram is not connected. Open Settings and connect Facebook & Instagram.");
        out = await publishInstagram(post, meta, prev);
      } else if (ch === "linkedin") {
        if (!li) throw new PublishError("LinkedIn is not connected. Open Settings and connect it.");
        out = await publishLinkedIn(post, li, prev);
      } else {
        const wp = getWordPressConnection();
        if (!wp) throw new PublishError("WordPress is not connected. Add WP_URL, WP_USERNAME and WP_APP_PASSWORD in Vercel.");
        out = await publishWordPress(post, wp);
      }
      if (out.status === "posted") {
        Object.assign(result, { status: "posted", postId: out.postId, url: out.url, pending: undefined, error: undefined });
      } else {
        // Still processing: don't count this as a failed attempt.
        Object.assign(result, { status: "processing", pending: out.pending, error: out.note, attempts: prev?.attempts || 0 });
      }
    } catch (e) {
      result.status = "failed";
      result.error = e instanceof Error ? e.message : String(e);
    }
    result.at = new Date().toISOString();
    post.results[ch] = result;
    summary.channels[ch] = result.status + (result.error ? `: ${result.error}` : "");
    await savePost(post);
  }

  const states = post.channels.map((c) => post.results[c]);
  if (states.every((r) => r?.status === "posted")) post.status = "posted";
  else if (states.some((r) => r?.status === "failed" && r.attempts >= MAX_ATTEMPTS)) post.status = "failed";
  else post.status = "posting"; // retried / continued on the next run
  await savePost(post);
  return summary;
}

/** Called by the cron job: publishes everything that is ready and due. */
export async function runDue(trigger: string) {
  const r = redis();
  const got = await r.set("lock:run", trigger, { nx: true, ex: 280 });
  if (!got) return { skipped: "Another run is already in progress." };

  const started = Date.now();
  const done: Summary[] = [];
  const errors: string[] = [];
  try {
    const now = Date.now();
    const due = (await getPosts()).filter(
      (p) => (p.status === "ready" || p.status === "posting") && new Date(p.scheduledAt).getTime() <= now
    );
    for (const post of due) {
      if (Date.now() - started > 200_000) break; // leave room before the function time limit
      try {
        done.push(await publishPost(post));
      } catch (e) {
        errors.push(`${post.id}: ${e instanceof Error ? e.message : String(e)}`);
        post.status = "draft";
        post.results = { ...post.results };
        await savePost(post);
      }
    }
    const entry = { trigger, due: due.length, done, errors };
    if (due.length || errors.length) await logRun(entry);
    return entry;
  } finally {
    await r.del("lock:run");
  }
}
