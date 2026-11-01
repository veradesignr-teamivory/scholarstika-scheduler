/**
 * Admin sign-in. The admin account is created in the app on first visit (/setup) and stored in the
 * database; ADMIN_PASSWORD in Vercel still works as an override. Uses only Web Crypto and fetch, so it
 * also runs in middleware.
 */
import { Redis } from "@upstash/redis/cloudflare"; // fetch-only build: runs in middleware (edge) and in Node

export const COOKIE = "sk_session";

let client: Redis | null = null;
function kv(): Redis | null {
  if (client) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  client = new Redis({ url, token });
  return client;
}

export type StoredAdmin = { salt: string; hash: string; createdAt: string };

export const hex = (buf: ArrayBuffer | Uint8Array) =>
  Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export function randomHex(bytes = 32): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return hex(a);
}

/** True once an admin password exists (in the database, or ADMIN_PASSWORD in Vercel). */
export async function adminExists(): Promise<boolean> {
  if (process.env.ADMIN_PASSWORD) return true;
  const r = kv();
  if (!r) return false;
  return !!(await r.get("auth:admin"));
}

export async function getStoredAdmin(): Promise<StoredAdmin | null> {
  return (await kv()?.get<StoredAdmin>("auth:admin")) || null;
}

/** The secret that signs sign-in cookies. Created at setup; changing the password replaces it, signing everyone out. */
async function authSecret(): Promise<string | null> {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  const r = kv();
  if (!r) return process.env.ADMIN_PASSWORD ? `env|${process.env.ADMIN_PASSWORD}` : null;
  const s = await r.get<string>("auth:secret");
  if (s) return s;
  return process.env.ADMIN_PASSWORD ? `env|${process.env.ADMIN_PASSWORD}` : null;
}

export async function sessionToken(): Promise<string> {
  const secret = await authSecret();
  if (!secret) throw new Error("No admin account yet.");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("scholarstika-admin|v2")));
}

export async function isValidSession(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  try {
    return value === (await sessionToken());
  } catch {
    return false;
  }
}

/** The key GitHub Actions sends to /api/cron. CRON_SECRET in Vercel overrides the one generated at setup. */
export async function cronSecret(): Promise<string | null> {
  if (process.env.CRON_SECRET) return process.env.CRON_SECRET;
  return (await kv()?.get<string>("auth:cron")) || null;
}

export function cookieOptions() {
  return { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 30 };
}

export function appUrl(fallbackOrigin: string): string {
  return (process.env.APP_URL || fallbackOrigin).replace(/\/$/, "");
}
