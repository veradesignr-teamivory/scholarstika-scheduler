import { fullCaption } from "../caption";
import type { ChannelResult, MetaConnection, Post } from "../types";
import { GRAPH, graphGet, graphPost, isVideo, PublishError, sleep, type PublishOutcome } from "./common";

/** Waits for an Instagram media container to finish processing. Returns false if it is still going. */
async function waitForContainer(id: string, token: string, maxMs: number): Promise<boolean> {
  const start = Date.now();
  for (;;) {
    const { status_code } = await graphGet(id, token, "status_code");
    if (status_code === "FINISHED") return true;
    if (status_code === "ERROR" || status_code === "EXPIRED") {
      throw new PublishError(`Instagram could not process the media (status ${status_code}). Check the file format: JPEG images, MP4 video.`);
    }
    if (Date.now() - start > maxMs) return false;
    await sleep(4000);
  }
}

/**
 * Publishes to an Instagram professional account in two steps: create a media container, then publish it.
 * Reels can take minutes to process; if it isn't ready yet, the container id is saved and the next
 * scheduler run picks it up.
 */
export async function publishInstagram(
  post: Post,
  conn: MetaConnection,
  prev?: ChannelResult
): Promise<PublishOutcome> {
  if (!conn.igUserId) {
    throw new PublishError("No Instagram account is linked to the Facebook Page. Link it in Meta Business Suite, then reconnect.");
  }
  const token = conn.pageToken;
  const ig = conn.igUserId;
  const caption = fullCaption(post);

  let containerId = prev?.pending?.containerId;

  if (!containerId) {
    if (post.kind === "video") {
      const video = post.media.find(isVideo);
      if (!video) throw new PublishError("No video attached.");
      const params: Record<string, string> = {
        media_type: "REELS",
        video_url: video.url,
        caption,
        share_to_feed: "true",
        access_token: token,
      };
      if (post.cover) params.cover_url = post.cover.url;
      containerId = (await graphPost(`${GRAPH}/${ig}/media`, params)).id as string;
    } else if (post.media.length === 1) {
      containerId = (
        await graphPost(`${GRAPH}/${ig}/media`, { image_url: post.media[0].url, caption, access_token: token })
      ).id as string;
    } else {
      if (post.media.length > 10) throw new PublishError("Instagram carousels allow at most 10 items.");
      const children: string[] = [];
      for (const m of post.media) {
        const params: Record<string, string> = isVideo(m)
          ? { media_type: "VIDEO", video_url: m.url, is_carousel_item: "true", access_token: token }
          : { image_url: m.url, is_carousel_item: "true", access_token: token };
        const child = (await graphPost(`${GRAPH}/${ig}/media`, params)).id as string;
        if (!(await waitForContainer(child, token, 60000))) {
          throw new PublishError("A carousel video took too long to process. It will be retried on the next run.");
        }
        children.push(child);
      }
      containerId = (
        await graphPost(`${GRAPH}/${ig}/media`, {
          media_type: "CAROUSEL",
          children: children.join(","),
          caption,
          access_token: token,
        })
      ).id as string;
    }
  }

  const ready = await waitForContainer(containerId, token, post.kind === "video" ? 90000 : 30000);
  if (!ready) {
    return { status: "processing", pending: { containerId }, note: "Instagram is still processing the video; it will publish on the next run." };
  }

  const published = await graphPost(`${GRAPH}/${ig}/media_publish`, { creation_id: containerId, access_token: token });
  let url: string | undefined;
  try {
    url = (await graphGet(published.id, token, "permalink")).permalink;
  } catch {
    /* permalink is optional */
  }
  return { status: "posted", postId: published.id, url };
}
