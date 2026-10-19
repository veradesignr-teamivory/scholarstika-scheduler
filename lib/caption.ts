import type { Post } from "./types";

/** Caption text plus hashtags, as posted on Facebook and Instagram. */
export function fullCaption(post: Pick<Post, "caption" | "hashtags">): string {
  const tags = post.hashtags.trim();
  return tags ? `${post.caption.trim()}\n\n${tags}` : post.caption.trim();
}

/**
 * LinkedIn's Posts API reads `commentary` in its "little text" format, where
 * \ | { } @ [ ] ( ) < > # * _ ~ are reserved. Unescaped, a post can be cut off
 * or rejected. Hashtags become {hashtag|\#|tag} so they stay clickable.
 */
export function linkedInCommentary(text: string): string {
  return text
    .split(/(#[\p{L}\p{N}_]+)/u)
    .map((part) => {
      const tag = /^#([\p{L}\p{N}_]+)$/u.exec(part);
      if (tag) return `{hashtag|\\#|${tag[1]}}`;
      return part.replace(/[\\|{}@\[\]()<>#*_~]/g, (c) => `\\${c}`);
    })
    .join("");
}
