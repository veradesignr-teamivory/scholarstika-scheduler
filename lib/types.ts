export type Channel = "facebook" | "instagram" | "linkedin" | "wordpress";
/** Social channels a social post can be sent to. Blog posts go to "wordpress" only. */
export const CHANNELS: Channel[] = ["facebook", "instagram", "linkedin"];
export const CHANNEL_LABEL: Record<Channel, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  wordpress: "WordPress",
};

export type Kind = "image" | "carousel" | "video" | "blog";

/** draft: waiting for media · ready: will publish at its time · posting: in progress
 *  posted: every channel done · failed: a channel gave up after 3 tries · manual: blog posts (not auto-posted) */
export type PostStatus = "draft" | "ready" | "posting" | "posted" | "failed" | "manual";

export interface Media {
  url: string;
  pathname: string;
  contentType: string;
  size: number;
}

export interface ChannelResult {
  status: "pending" | "processing" | "posted" | "failed";
  attempts: number;
  postId?: string;
  url?: string;
  error?: string;
  at?: string;
  /** In-flight upload state carried between scheduler runs (e.g. an Instagram container id). */
  pending?: Record<string, string>;
}

export interface Post {
  id: string;
  week: number;
  /** ISO timestamp (UTC). Shown and edited in West Africa Time. */
  scheduledAt: string;
  kind: Kind;
  format: string;
  type: "regular" | "holiday" | "flyer";
  channels: Channel[];
  heading: string;
  caption: string;
  hashtags: string;
  prompts: { label: string; text: string }[];
  blog: null | { kw: string; slug: string; meta: string; outline: string[] };
  /** Blog posts only: the article body, in simple Markdown (## headings, - lists, **bold**, [links](url)) or HTML. */
  article?: string;
  media: Media[];
  cover?: Media | null;
  status: PostStatus;
  results: Partial<Record<Channel, ChannelResult>>;
  updatedAt: string;
}

export interface MetaConnection {
  pageId: string;
  pageName: string;
  pageToken: string;
  igUserId?: string;
  igUsername?: string;
  connectedAt: string;
  source: "oauth" | "env";
}

export interface WordPressConnection {
  siteUrl: string;
  username: string;
  appPassword: string;
  /** "publish" (default), "draft" (you review in WordPress first) or "pending". */
  status: "publish" | "draft" | "pending";
  categoryId?: number;
}

export interface LinkedInConnection {
  accessToken: string;
  expiresAt?: string;
  refreshToken?: string;
  refreshExpiresAt?: string;
  author: string;
  name: string;
  connectedAt: string;
  source: "oauth" | "env";
}
