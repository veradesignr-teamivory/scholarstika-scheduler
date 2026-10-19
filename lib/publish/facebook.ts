import { fullCaption } from "../caption";
import type { MetaConnection, Post } from "../types";
import { GRAPH, GRAPH_VERSION, graphPost, isVideo, PublishError, type PublishOutcome } from "./common";

/** Publishes to a Facebook Page: one photo, a multi-photo post (carousel), or a video. */
export async function publishFacebook(post: Post, conn: MetaConnection): Promise<PublishOutcome> {
  const token = conn.pageToken;
  const message = fullCaption(post);
  const page = conn.pageId;
  const media = post.media;

  if (post.kind === "video") {
    const video = media.find(isVideo);
    if (!video) throw new PublishError("No video attached.");
    const json = await graphPost(`https://graph-video.facebook.com/${GRAPH_VERSION}/${page}/videos`, {
      file_url: video.url,
      description: message,
      title: post.heading,
      access_token: token,
    });
    return { status: "posted", postId: json.id, url: `https://www.facebook.com/${json.id}` };
  }

  const images = media.filter((m) => !isVideo(m));
  if (images.length === 0) throw new PublishError("No image attached.");

  if (images.length === 1) {
    const json = await graphPost(`${GRAPH}/${page}/photos`, {
      url: images[0].url,
      caption: message, // Graph API: `caption` is the photo's post text (`message` is deprecated here)
      access_token: token,
    });
    const id = json.post_id || json.id;
    return { status: "posted", postId: id, url: `https://www.facebook.com/${id}` };
  }

  // Carousel: upload each photo unpublished, then attach them all to one feed post.
  const params: Record<string, string> = { message, access_token: token };
  for (let i = 0; i < images.length; i++) {
    const photo = await graphPost(`${GRAPH}/${page}/photos`, {
      url: images[i].url,
      published: "false",
      access_token: token,
    });
    params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: photo.id });
  }
  const json = await graphPost(`${GRAPH}/${page}/feed`, params);
  return { status: "posted", postId: json.id, url: `https://www.facebook.com/${json.id}` };
}
