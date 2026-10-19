/** Admin session: one password (ADMIN_PASSWORD) protects the whole app. Uses Web Crypto so it also runs in middleware. */
export const COOKIE = "sk_session";

export async function sessionToken(): Promise<string> {
  const pw = process.env.ADMIN_PASSWORD || "";
  const secret = process.env.AUTH_SECRET || process.env.CRON_SECRET || "scholarstika";
  const data = new TextEncoder().encode(`${pw}|${secret}|v1`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function isValidSession(value: string | undefined): Promise<boolean> {
  if (!process.env.ADMIN_PASSWORD || !value) return false;
  return value === (await sessionToken());
}

export function appUrl(fallbackOrigin: string): string {
  return (process.env.APP_URL || fallbackOrigin).replace(/\/$/, "");
}
