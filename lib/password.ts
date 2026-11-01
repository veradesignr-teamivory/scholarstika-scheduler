import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { redis } from "./db";
import { getStoredAdmin, randomHex, type StoredAdmin } from "./session";

const scrypt = promisify(scryptCb) as (pw: string, salt: string, len: number) => Promise<Buffer>;

export const MIN_PASSWORD = 10;

async function hashPassword(password: string): Promise<StoredAdmin> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 64)).toString("hex");
  return { salt, hash, createdAt: new Date().toISOString() };
}

function sameString(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Checks a sign-in attempt against ADMIN_PASSWORD (if set in Vercel) or the stored admin account. */
export async function verifyPassword(password: string): Promise<boolean> {
  if (process.env.ADMIN_PASSWORD) return sameString(password, process.env.ADMIN_PASSWORD);
  const admin = await getStoredAdmin();
  if (!admin) return false;
  const hash = (await scrypt(password, admin.salt, 64)).toString("hex");
  return sameString(hash, admin.hash);
}

/**
 * Creates the admin account on first run. Uses SET NX so only the very first submission wins, even if
 * two people open /setup at once. Also creates the cookie-signing secret and the GitHub scheduler key.
 */
export async function createAdmin(password: string): Promise<boolean> {
  const r = redis();
  const admin = await hashPassword(password);
  const created = await r.set("auth:admin", admin, { nx: true });
  if (!created) return false;
  await r.set("auth:secret", `as_${randomHex(32)}`);
  if (!(await r.get("auth:cron"))) await r.set("auth:cron", `ck_${randomHex(24)}`);
  return true;
}

/** Replaces the stored password and the cookie secret, which signs out every other browser. */
export async function changePassword(password: string): Promise<void> {
  const r = redis();
  await r.set("auth:admin", await hashPassword(password));
  await r.set("auth:secret", `as_${randomHex(32)}`);
}

export async function regenerateCronSecret(): Promise<string> {
  const s = `ck_${randomHex(24)}`; // prefix keeps it a string (never parsed as a number)
  await redis().set("auth:cron", s);
  return s;
}
