/**
 * App keys for each platform, entered on the Connect accounts page and stored in the database.
 * A matching environment variable in Vercel, if present, takes priority (handy for overrides).
 * Secrets are never sent back to the browser; the page only learns whether one is saved.
 */
import { redis } from "./db";
import type { WordPressConnection } from "./types";

export type MetaApp = { appId: string; appSecret: string; pageId?: string; configId?: string };
export type LinkedInApp = { clientId: string; clientSecret: string; orgId?: string };
export type WordPressConfig = { siteUrl: string; username: string; appPassword: string; status?: string; categoryId?: string };

type Stored = { meta?: Partial<MetaApp>; linkedin?: Partial<LinkedInApp>; wordpress?: Partial<WordPressConfig> };

async function stored(): Promise<Stored> {
  return (await redis().get<Stored>("cfg:apps").catch(() => null)) || {};
}

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export async function getMetaApp(): Promise<MetaApp | null> {
  const s = (await stored()).meta || {};
  const appId = process.env.META_APP_ID || s.appId;
  const appSecret = process.env.META_APP_SECRET || s.appSecret;
  if (!appId || !appSecret) return null;
  return {
    appId,
    appSecret,
    pageId: process.env.FB_PAGE_ID || s.pageId || undefined,
    configId: process.env.META_CONFIG_ID || s.configId || undefined,
  };
}

export async function getLinkedInApp(): Promise<LinkedInApp | null> {
  const s = (await stored()).linkedin || {};
  const clientId = process.env.LINKEDIN_CLIENT_ID || s.clientId;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET || s.clientSecret;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, orgId: process.env.LINKEDIN_ORG_ID || s.orgId || undefined };
}

export async function getWordPressConnection(): Promise<WordPressConnection | null> {
  const s = (await stored()).wordpress || {};
  const siteUrl = process.env.WP_URL || s.siteUrl;
  const username = process.env.WP_USERNAME || s.username;
  const appPassword = process.env.WP_APP_PASSWORD || s.appPassword;
  if (!siteUrl || !username || !appPassword) return null;
  const st = process.env.WP_POST_STATUS || s.status;
  const cat = process.env.WP_CATEGORY_ID || s.categoryId;
  return {
    siteUrl: siteUrl.replace(/\/+$/, ""),
    username,
    appPassword: appPassword.replace(/\s+/g, ""),
    status: st === "draft" || st === "pending" ? st : "publish",
    categoryId: cat ? Number(cat) : undefined,
  };
}

/** What the Connect page may show: plain settings, plus whether each secret is saved. Never the secrets. */
export async function publicConfig() {
  const s = await stored();
  const env = process.env;
  return {
    meta: {
      appId: env.META_APP_ID || s.meta?.appId || "",
      pageId: env.FB_PAGE_ID || s.meta?.pageId || "",
      configId: env.META_CONFIG_ID || s.meta?.configId || "",
      hasSecret: !!(env.META_APP_SECRET || s.meta?.appSecret),
      lockedByEnv: !!(env.META_APP_ID || env.META_APP_SECRET),
    },
    linkedin: {
      clientId: env.LINKEDIN_CLIENT_ID || s.linkedin?.clientId || "",
      orgId: env.LINKEDIN_ORG_ID || s.linkedin?.orgId || "",
      hasSecret: !!(env.LINKEDIN_CLIENT_SECRET || s.linkedin?.clientSecret),
      lockedByEnv: !!(env.LINKEDIN_CLIENT_ID || env.LINKEDIN_CLIENT_SECRET),
    },
    wordpress: {
      siteUrl: env.WP_URL || s.wordpress?.siteUrl || "",
      username: env.WP_USERNAME || s.wordpress?.username || "",
      status: env.WP_POST_STATUS || s.wordpress?.status || "publish",
      categoryId: env.WP_CATEGORY_ID || s.wordpress?.categoryId || "",
      hasSecret: !!(env.WP_APP_PASSWORD || s.wordpress?.appPassword),
      lockedByEnv: !!(env.WP_URL || env.WP_USERNAME || env.WP_APP_PASSWORD),
    },
  };
}

/**
 * Saves one platform's keys. A blank secret field keeps the saved secret, so you can change the
 * page ID or site address without re-typing the secret.
 */
export async function saveConfig(platform: "meta" | "linkedin" | "wordpress", input: Record<string, unknown>) {
  const s = await stored();
  if (platform === "meta") {
    const prev = s.meta || {};
    s.meta = {
      appId: clean(input.appId).replace(/\D/g, ""),
      appSecret: clean(input.appSecret) || prev.appSecret || "",
      pageId: clean(input.pageId).replace(/\D/g, ""),
      configId: clean(input.configId).replace(/\D/g, ""),
    };
  } else if (platform === "linkedin") {
    const prev = s.linkedin || {};
    s.linkedin = {
      clientId: clean(input.clientId),
      clientSecret: clean(input.clientSecret) || prev.clientSecret || "",
      orgId: clean(input.orgId).replace(/\D/g, ""),
    };
  } else {
    const prev = s.wordpress || {};
    let url = clean(input.siteUrl).replace(/\/+$/, "").replace(/\/wp-admin.*$/, "");
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
    const st = clean(input.status);
    s.wordpress = {
      siteUrl: url,
      username: clean(input.username),
      appPassword: clean(input.appPassword) || prev.appPassword || "",
      status: st === "draft" || st === "pending" ? st : "publish",
      categoryId: clean(input.categoryId).replace(/\D/g, ""),
    };
  }
  await redis().set("cfg:apps", s);
}

export async function clearConfig(platform: "meta" | "linkedin" | "wordpress") {
  const s = await stored();
  delete s[platform];
  await redis().set("cfg:apps", s);
}
