import type { Post } from "./types";

const isVideo = (t: string) => t.startsWith("video/");

/** Problems that would stop a post from publishing. Empty array = good to go. */
export function readinessProblems(post: Post): string[] {
  const p: string[] = [];
  if (post.kind === "blog") {
    if (!post.heading.trim()) p.push("The blog post needs a title.");
    const words = (post.article || "").trim().split(/\s+/).filter(Boolean).length;
    if (words < 150) p.push(`Write or paste the article (${words} words so far; at least 150 needed).`);
    if (post.media.some((m) => isVideo(m.contentType))) p.push("The featured image must be an image, not a video.");
    if (post.media.length > 1) p.push("Attach only one featured image.");
    return p;
  }
  if (post.channels.length === 0) p.push("Pick at least one channel.");
  if (!post.caption.trim()) p.push("The caption is empty.");

  const images = post.media.filter((m) => !isVideo(m.contentType));
  const videos = post.media.filter((m) => isVideo(m.contentType));

  if (post.kind === "video") {
    if (videos.length !== 1) p.push("Attach exactly one video (MP4).");
  } else if (post.kind === "carousel") {
    if (post.media.length < 2) p.push("A carousel needs at least 2 slides.");
    if (post.media.length > 10) p.push("Carousels can have at most 10 slides (Instagram's limit).");
  } else if (images.length < 1) {
    p.push("Attach an image.");
  }

  if (post.channels.includes("instagram")) {
    const nonJpeg = images.filter((m) => !/jpe?g/.test(m.contentType));
    if (nonJpeg.length) p.push("Instagram only accepts JPEG images. In Canva, download as JPG.");
    if (post.caption.length + post.hashtags.length > 2150) p.push("Instagram captions are limited to 2,200 characters.");
    if ((post.hashtags.match(/#/g) || []).length > 30) p.push("Instagram allows at most 30 hashtags.");
  }
  if (post.channels.includes("linkedin") && post.caption.length + post.hashtags.length > 2950) {
    p.push("LinkedIn posts are limited to 3,000 characters.");
  }
  return p;
}
