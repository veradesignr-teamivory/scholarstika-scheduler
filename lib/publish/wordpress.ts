import { markdownToHtml } from "../markdown";
import type { Post, WordPressConnection } from "../types";
import { isImage, PublishError, type PublishOutcome } from "./common";

function authHeader(conn: WordPressConnection) {
  return "Basic " + Buffer.from(`${conn.username}:${conn.appPassword}`).toString("base64");
}

/**
 * Calls the WordPress REST API. Tries /wp-json/… first; if the site doesn't use pretty permalinks
 * (that path returns a non-JSON 404), falls back to ?rest_route=… which every WordPress site supports.
 */
export async function wpFetch(conn: WordPressConnection, route: string, init: RequestInit = {}) {
  const headers = { Authorization: authHeader(conn), Accept: "application/json", ...(init.headers || {}) };
  const urls = [
    `${conn.siteUrl}/wp-json/wp/v2/${route}`,
    `${conn.siteUrl}/?rest_route=/wp/v2/${route.replace("?", "&")}`,
  ];
  let last: Response | null = null;
  for (const url of urls) {
    let res: Response;
    try {
      res = await fetch(url, { ...init, headers });
    } catch {
      throw new PublishError(`Could not reach ${conn.siteUrl}. Check WP_URL (include https://) and that the site is online.`);
    }
    const isJson = (res.headers.get("content-type") || "").includes("json");
    if (res.status === 404 && !isJson) {
      last = res;
      continue;
    }
    const body = isJson ? await res.json() : await res.text();
    if (!res.ok) {
      const msg = typeof body === "object" && body ? body.message || body.code : String(body).slice(0, 200);
      if (res.status === 401 || res.status === 403) {
        throw new PublishError(
          `WordPress refused the login (${res.status}: ${msg}). Check WP_USERNAME and WP_APP_PASSWORD, and that a security plugin or the host firewall isn't blocking the REST API.`
        );
      }
      throw new PublishError(`WordPress ${res.status}: ${msg}`);
    }
    if (!isJson) throw new PublishError("WordPress returned a web page instead of API data. Check WP_URL.");
    return body;
  }
  throw new PublishError(`WordPress REST API not found at ${conn.siteUrl} (HTTP ${last?.status}). Check WP_URL.`);
}

const slugFrom = (post: Post) =>
  (post.blog?.slug || post.heading)
    .split("/")
    .filter(Boolean)
    .pop()!
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Publishes a blog post: uploads the featured image (if attached), then creates the post. */
export async function publishWordPress(post: Post, conn: WordPressConnection): Promise<PublishOutcome> {
  const slug = slugFrom(post);
  let featured: number | undefined;
  const image = post.media.find(isImage);
  if (image) {
    const file = await fetch(image.url);
    if (!file.ok) throw new PublishError(`Could not read the featured image (${file.status}).`);
    const ext = image.contentType.includes("png") ? "png" : image.contentType.includes("webp") ? "webp" : "jpg";
    const media = await wpFetch(conn, "media", {
      method: "POST",
      headers: {
        "Content-Type": image.contentType,
        "Content-Disposition": `attachment; filename="${slug || "featured"}.${ext}"`,
      },
      body: await file.arrayBuffer(),
    });
    featured = media.id;
    try {
      await wpFetch(conn, `media/${media.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alt_text: post.heading }),
      });
    } catch {
      /* alt text is optional */
    }
  }

  const created = await wpFetch(conn, "posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: post.heading,
      content: markdownToHtml(post.article || ""),
      excerpt: post.blog?.meta || "",
      slug,
      status: conn.status,
      ...(featured ? { featured_media: featured } : {}),
      ...(conn.categoryId ? { categories: [conn.categoryId] } : {}),
    }),
  });
  return { status: "posted", postId: String(created.id), url: created.link };
}
