import { redirect } from "next/navigation";
import { adminExists } from "@/lib/session";
import SetupError from "../components/SetupError";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  short: "Use at least 10 characters.",
  mismatch: "The two passwords don't match. Type them again.",
  db: "The database isn't connected yet, so the account couldn't be saved.",
};

export default async function Setup({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const dbReady = !!(
    (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
    (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)
  );
  if (dbReady && (await adminExists())) redirect("/login");

  return (
    <main className="wrap" style={{ maxWidth: 460, paddingTop: 64 }}>
      {!dbReady ? (
        <SetupError message="Connect the database first, then come back to this page to create your admin account." />
      ) : (
        <div className="card">
          <div className="eyebrow">Scholarstika Scheduler · First-time setup</div>
          <h1>Create the admin account</h1>
          <p className="muted" style={{ margin: 0 }}>
            This password protects the scheduler. Only one admin account can be created; after that this page closes and
            everyone goes to the sign-in page.
          </p>
          {error && <div className="notice bad">{ERRORS[error] || "Something went wrong. Try again."}</div>}
          <form method="post" action="/api/setup" style={{ display: "grid", gap: 12 }}>
            <label>
              Password (at least 10 characters)
              <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required autoFocus />
            </label>
            <label>
              Type it again
              <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
            </label>
            <button type="submit">Create admin account</button>
          </form>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Save it in your password manager. If you lose it, you can set <code>ADMIN_PASSWORD</code> in Vercel to get back in.
          </p>
        </div>
      )}
    </main>
  );
}
