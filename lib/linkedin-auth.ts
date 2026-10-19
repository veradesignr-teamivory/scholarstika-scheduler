import { getLinkedInConnection, saveLinkedInConnection } from "./db";
import type { LinkedInConnection } from "./types";

/** Returns a usable LinkedIn connection, refreshing the token first if it expires within 7 days and a refresh token exists. */
export async function liveLinkedIn(): Promise<LinkedInConnection | null> {
  const conn = await getLinkedInConnection();
  if (!conn || conn.source === "env" || !conn.expiresAt) return conn;
  const left = new Date(conn.expiresAt).getTime() - Date.now();
  if (left > 7 * 864e5 || !conn.refreshToken) return conn;

  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: conn.refreshToken,
      client_id: process.env.LINKEDIN_CLIENT_ID || "",
      client_secret: process.env.LINKEDIN_CLIENT_SECRET || "",
    }),
  });
  if (!res.ok) return conn;
  const t = await res.json();
  const next: LinkedInConnection = {
    ...conn,
    accessToken: t.access_token,
    expiresAt: new Date(Date.now() + t.expires_in * 1000).toISOString(),
    refreshToken: t.refresh_token || conn.refreshToken,
  };
  await saveLinkedInConnection(next);
  return next;
}
