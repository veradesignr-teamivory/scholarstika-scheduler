import type { Media } from "../types";

export const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v25.0";
export const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

export type PublishOutcome =
  | { status: "posted"; postId: string; url?: string }
  | { status: "processing"; pending: Record<string, string>; note: string };

export class PublishError extends Error {}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const isVideo = (m: Media) => m.contentType.startsWith("video/");
export const isImage = (m: Media) => m.contentType.startsWith("image/");

/** POST to the Facebook Graph API with form parameters; throws the API's own error message. */
export async function graphPost(url: string, params: Record<string, string>) {
  const res = await fetch(url, { method: "POST", body: new URLSearchParams(params) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = json.error || {};
    throw new PublishError(`${e.message || res.statusText}${e.error_user_msg ? ` – ${e.error_user_msg}` : ""}`);
  }
  return json;
}

export async function graphGet(path: string, token: string, fields?: string) {
  const u = new URL(`${GRAPH}/${path}`);
  if (fields) u.searchParams.set("fields", fields);
  u.searchParams.set("access_token", token);
  const res = await fetch(u);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new PublishError(json.error?.message || res.statusText);
  return json;
}
