import { headers } from "next/headers";
import { getRuns } from "@/lib/db";
import { linkedInVersion } from "@/lib/publish/linkedin";
import { formatWat } from "@/lib/time";
import RunNow from "../components/RunNow";
import SetupError from "../components/SetupError";
import TopBar from "../components/TopBar";
import Connections from "./Connections";

export const dynamic = "force-dynamic";

export default async function Settings({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const h = await headers();
  const origin = process.env.APP_URL || `https://${h.get("host")}`;

  let runs: Array<Record<string, unknown>> = [];
  let dbError = "";
  try {
    runs = await getRuns();
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  const env = {
    password: !!process.env.ADMIN_PASSWORD,
    cron: !!process.env.CRON_SECRET,
    blob: !!process.env.BLOB_READ_WRITE_TOKEN,
    db: !dbError,
    meta: !!(process.env.META_APP_ID && process.env.META_APP_SECRET),
    linkedin: !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET),
    wordpress: !!(process.env.WP_URL && process.env.WP_USERNAME && process.env.WP_APP_PASSWORD),
  };
  const check = (v: boolean) => <b style={{ color: v ? "var(--ok)" : "var(--bad)" }}>{v ? "Set" : "Missing"}</b>;

  return (
    <main className="wrap">
      <TopBar current="settings" />
      <h1>Connections &amp; settings</h1>
      {ok && <div className="notice ok">{ok}</div>}
      {error && <div className="notice bad">{error}</div>}
      {dbError && <SetupError message={dbError} />}

      <div className="grid2">
        <Connections metaReady={env.meta} linkedinReady={env.linkedin} />

        <section className="card">
          <h2>Setup checklist</h2>
          <div className="results">
            <div>{check(env.db)} Database (Upstash Redis)</div>
            <div>{check(env.blob)} File storage (Vercel Blob)</div>
            <div>{check(env.password)} <code>ADMIN_PASSWORD</code></div>
            <div>{check(env.cron)} <code>CRON_SECRET</code> (lets the scheduler run every 15 minutes)</div>
            <div>{check(env.meta)} Meta app (<code>META_APP_ID</code>, <code>META_APP_SECRET</code>)</div>
            <div>{check(env.linkedin)} LinkedIn app (<code>LINKEDIN_CLIENT_ID</code>, <code>LINKEDIN_CLIENT_SECRET</code>)</div>
            <div>{check(env.wordpress)} WordPress (<code>WP_URL</code>, <code>WP_USERNAME</code>, <code>WP_APP_PASSWORD</code>)</div>
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            <span className="eyebrow">Redirect URLs to register</span>
            <div className="mono">Meta: {origin}/api/auth/meta/callback</div>
            <div className="mono">LinkedIn: {origin}/api/auth/linkedin/callback</div>
            <div className="muted" style={{ fontSize: 13 }}>
              LinkedIn API version in use: <code>{linkedInVersion()}</code>
              {process.env.LINKEDIN_ORG_ID
                ? ` · posting as company page ${process.env.LINKEDIN_ORG_ID}`
                : " · posting to your personal profile (set LINKEDIN_ORG_ID to post as the company page)"}
            </div>
          </div>
        </section>
      </div>

      <section className="card">
        <h2>Scheduler</h2>
        <p className="muted" style={{ margin: 0 }}>
          Runs automatically every 15 minutes. Each run publishes every post that is marked Ready and whose time has arrived,
          retries failed channels up to 3 times, and finishes Instagram and LinkedIn videos that were still processing.
        </p>
        <RunNow />
        <div style={{ display: "grid", gap: 6 }}>
          <span className="eyebrow">Recent runs that did something</span>
          {runs.length === 0 && <span className="muted">None yet.</span>}
          {runs.map((r, i) => (
            <div key={i} className="mono" style={{ borderTop: "1px solid var(--rule)", paddingTop: 6 }}>
              {formatWat(String(r.at))} · {String(r.trigger)} · {String(r.due)} due
              {Array.isArray(r.done) &&
                (r.done as Array<{ heading: string; channels: Record<string, string> }>).map((d, j) => (
                  <div key={j} style={{ paddingLeft: 12 }}>
                    {d.heading}: {Object.entries(d.channels).map(([c, s]) => `${c} ${s}`).join(" · ")}
                  </div>
                ))}
              {Array.isArray(r.errors) && (r.errors as string[]).map((e, j) => (
                <div key={`e${j}`} style={{ paddingLeft: 12, color: "var(--bad)" }}>{e}</div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
