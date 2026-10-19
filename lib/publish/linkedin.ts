import { fullCaption, linkedInCommentary } from "../caption";
import type { ChannelResult, LinkedInConnection, Post } from "../types";
import { isVideo, PublishError, sleep, type PublishOutcome } from "./common";

const API = "https://api.linkedin.com/rest";

/** LinkedIn's versioned API needs a YYYYMM version it still supports. Defaults to two months ago. */
export function linkedInVersion(): string {
  if (process.env.LINKEDIN_API_VERSION) return process.env.LINKEDIN_API_VERSION;
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 2);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function headers(token: string, json = true): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": linkedInVersion(),
    "X-Restli-Protocol-Version": "2.0.0",
  };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

async function liFetch(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...headers(token), ...(init.headers || {}) } });
  if (!res.ok) {
    const body = await res.text();
    let msg = body;
    try {
      msg = JSON.parse(body).message || body;
    } catch {}
    throw new PublishError(`LinkedIn ${res.status}: ${msg.slice(0, 300)}`);
  }
  return res;
}

async function download(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new PublishError(`Could not read the attached file (${res.status}).`);
  return res.arrayBuffer();
}

async function uploadImage(url: string, conn: LinkedInConnection): Promise<string> {
  const init = await liFetch("/images?action=initializeUpload", conn.accessToken, {
    method: "POST",
    body: JSON.stringify({ initializeUploadRequest: { owner: conn.author } }),
  });
  const { value } = await init.json();
  const bytes = await download(url);
  const put = await fetch(value.uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${conn.accessToken}` },
    body: bytes,
  });
  if (!put.ok) throw new PublishError(`LinkedIn image upload failed (${put.status}).`);
  return value.image as string;
}

async function uploadVideo(url: string, conn: LinkedInConnection): Promise<string> {
  const bytes = await download(url);
  const init = await liFetch("/videos?action=initializeUpload", conn.accessToken, {
    method: "POST",
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: conn.author,
        fileSizeBytes: bytes.byteLength,
        uploadCaptions: false,
        uploadThumbnail: false,
      },
    }),
  });
  const { value } = await init.json();
  const etags: string[] = [];
  for (const part of value.uploadInstructions as { uploadUrl: string; firstByte: number; lastByte: number }[]) {
    const put = await fetch(part.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: bytes.slice(part.firstByte, part.lastByte + 1),
    });
    if (!put.ok) throw new PublishError(`LinkedIn video upload failed (${put.status}).`);
    etags.push(put.headers.get("etag") || "");
  }
  await liFetch("/videos?action=finalizeUpload", conn.accessToken, {
    method: "POST",
    body: JSON.stringify({
      finalizeUploadRequest: { video: value.video, uploadToken: value.uploadToken || "", uploadedPartIds: etags },
    }),
  });
  return value.video as string;
}

async function videoAvailable(urn: string, conn: LinkedInConnection, maxMs: number): Promise<boolean> {
  const start = Date.now();
  for (;;) {
    const res = await liFetch(`/videos/${encodeURIComponent(urn)}`, conn.accessToken, { method: "GET" });
    const { status } = await res.json();
    if (status === "AVAILABLE") return true;
    if (status === "PROCESSING_FAILED") throw new PublishError("LinkedIn could not process the video. Use an MP4 (H.264) under 200 MB.");
    if (Date.now() - start > maxMs) return false;
    await sleep(5000);
  }
}

/** Publishes to a LinkedIn member profile or company page (whichever `author` URN is connected). */
export async function publishLinkedIn(
  post: Post,
  conn: LinkedInConnection,
  prev?: ChannelResult
): Promise<PublishOutcome> {
  let content: Record<string, unknown>;

  if (post.kind === "video") {
    let videoUrn = prev?.pending?.videoUrn;
    if (!videoUrn) {
      const video = post.media.find(isVideo);
      if (!video) throw new PublishError("No video attached.");
      videoUrn = await uploadVideo(video.url, conn);
    }
    if (!(await videoAvailable(videoUrn, conn, 60000))) {
      return { status: "processing", pending: { videoUrn }, note: "LinkedIn is still processing the video; it will post on the next run." };
    }
    content = { media: { title: post.heading, id: videoUrn } };
  } else {
    const images = post.media.filter((m) => !isVideo(m));
    if (images.length === 0) throw new PublishError("No image attached.");
    const urns: string[] = [];
    for (const img of images.slice(0, 20)) urns.push(await uploadImage(img.url, conn));
    content =
      urns.length === 1
        ? { media: { id: urns[0], altText: post.heading.slice(0, 120) } }
        : { multiImage: { images: urns.map((id) => ({ id, altText: post.heading.slice(0, 120) })) } };
  }

  const res = await liFetch("/posts", conn.accessToken, {
    method: "POST",
    body: JSON.stringify({
      author: conn.author,
      commentary: linkedInCommentary(fullCaption(post)),
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      content,
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });
  const urn = res.headers.get("x-restli-id") || "";
  return { status: "posted", postId: urn, url: urn ? `https://www.linkedin.com/feed/update/${urn}` : undefined };
}
