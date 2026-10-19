import { Redis } from "@upstash/redis";
import seed from "../data/posts.json";
import { watToIso } from "./time";
import type { LinkedInConnection, MetaConnection, Post, WordPressConnection } from "./types";

let client: Redis | null = null;

/** Works with Upstash Redis added from the Vercel Marketplace (KV_* vars) or created on upstash.com (UPSTASH_* vars). */
export function redis(): Redis {
  if (client) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Database not configured. Add Upstash Redis to this Vercel project (Storage → Marketplace → Upstash Redis) and redeploy."
    );
  }
  client = new Redis({ url, token });
  return client;
}

const POSTS = "posts";

type SeedPost = (typeof seed)[number];

function fromSeed(s: SeedPost): Post {
  return {
    id: s.id,
    week: s.week,
    scheduledAt: watToIso(s.date, s.time),
    kind: s.kind as Post["kind"],
    format: s.format,
    type: s.type as Post["type"],
    channels: s.kind === "blog" ? ["wordpress"] : (s.channels as Post["channels"]),
    heading: s.heading,
    caption: s.caption,
    hashtags: s.hashtags,
    prompts: s.prompts,
    blog: s.blog,
    article: "",
    media: [],
    cover: null,
    status: "draft",
    results: {},
    updatedAt: new Date().toISOString(),
  };
}

/** Loads every post, seeding the database from data/posts.json on first run. */
export async function getPosts(): Promise<Post[]> {
  const r = redis();
  let all = (await r.hgetall<Record<string, Post>>(POSTS)) || {};
  if (Object.keys(all).length === 0 && !(await r.get("seeded"))) {
    const entries: Record<string, Post> = {};
    for (const s of seed) entries[s.id] = fromSeed(s);
    await r.hset(POSTS, entries);
    await r.set("seeded", new Date().toISOString());
    all = entries;
  }
  return Object.values(all).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

export async function getPost(id: string): Promise<Post | null> {
  await getPosts(); // make sure the seed exists
  return (await redis().hget<Post>(POSTS, id)) || null;
}

export async function savePost(post: Post): Promise<void> {
  post.updatedAt = new Date().toISOString();
  await redis().hset(POSTS, { [post.id]: post });
}

export async function getMetaConnection(): Promise<MetaConnection | null> {
  if (process.env.FB_PAGE_ACCESS_TOKEN && process.env.FB_PAGE_ID) {
    return {
      pageId: process.env.FB_PAGE_ID,
      pageName: process.env.FB_PAGE_NAME || "Facebook Page (from environment)",
      pageToken: process.env.FB_PAGE_ACCESS_TOKEN,
      igUserId: process.env.IG_USER_ID,
      igUsername: process.env.IG_USERNAME,
      connectedAt: "",
      source: "env",
    };
  }
  return (await redis().get<MetaConnection>("conn:meta")) || null;
}

export async function saveMetaConnection(c: MetaConnection | null) {
  if (c) await redis().set("conn:meta", c);
  else await redis().del("conn:meta");
}

export async function getLinkedInConnection(): Promise<LinkedInConnection | null> {
  if (process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_AUTHOR_URN) {
    return {
      accessToken: process.env.LINKEDIN_ACCESS_TOKEN,
      author: process.env.LINKEDIN_AUTHOR_URN,
      name: "LinkedIn (from environment)",
      connectedAt: "",
      source: "env",
    };
  }
  return (await redis().get<LinkedInConnection>("conn:linkedin")) || null;
}

export async function saveLinkedInConnection(c: LinkedInConnection | null) {
  if (c) await redis().set("conn:linkedin", c);
  else await redis().del("conn:linkedin");
}

/** WordPress uses an Application Password, set as environment variables in Vercel. */
export function getWordPressConnection(): WordPressConnection | null {
  const { WP_URL, WP_USERNAME, WP_APP_PASSWORD, WP_POST_STATUS, WP_CATEGORY_ID } = process.env;
  if (!WP_URL || !WP_USERNAME || !WP_APP_PASSWORD) return null;
  const status = WP_POST_STATUS === "draft" || WP_POST_STATUS === "pending" ? WP_POST_STATUS : "publish";
  return {
    siteUrl: WP_URL.replace(/\/+$/, ""),
    username: WP_USERNAME,
    appPassword: WP_APP_PASSWORD.replace(/\s+/g, ""),
    status,
    categoryId: WP_CATEGORY_ID ? Number(WP_CATEGORY_ID) : undefined,
  };
}

export async function logRun(entry: Record<string, unknown>) {
  const r = redis();
  await r.lpush("runs", { at: new Date().toISOString(), ...entry });
  await r.ltrim("runs", 0, 49);
}

export async function getRuns(): Promise<Array<Record<string, unknown>>> {
  return (await redis().lrange<Record<string, unknown>>("runs", 0, 19)) || [];
}
