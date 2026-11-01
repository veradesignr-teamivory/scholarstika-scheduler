import { headers } from "next/headers";
import { getRuns } from "@/lib/db";
import { linkedInVersion } from "@/lib/publish/linkedin";
import { formatWat } from "@/lib/time";
import RunNow from "../components/RunNow";
import SetupError from "../components/SetupError";
import TopBar from "../components/TopBar";
import AdminPanel from "./AdminPanel";
import Link from "next/link";
import { publicConfig } from "@/lib/credentials";
import { adminExists, cronSecret } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Settings({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; welcome?: string }> }) {
  const { ok, error, welcome } = await searchParams;
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
    password: await adminExists().catch(() => false),
    cron: !!(await cronSecret().catch(() => null)),
    blob: !!process.env.BLOB_READ_WRITE_TOKEN,
    db: !dbError,
    meta: false,
    linkedin: false,
    wordpress: false,
  };
  let orgId = "";
  if (!dbError) {
    const c = await publicConfig().catch(() => null);
    if (c) {
      env.meta = !!c.meta.appId && c.meta.hasSecret;
      env.linkedin = !!c.linkedin.clientId && c.linkedin.hasSecret;
      env.wordpress = !!c.wordpress.siteUrl && c.wordpress.hasSecret;
      orgId = c.linkedin.orgId;
    }
  }
  const check = (v: boolean) => <b style={{ color: v ? "var(--ok)" : "var(--bad)" }}>{v ? "Set" : "Missing"}</b>;

  return (
    <main className="wrap">
      <TopBar current="settings" />
      <h1>Settings</h1>
      {welcome && (
        <div className="notice ok">
          Admin account created and you&apos;re signed in. Next: add the two GitHub secrets shown under “Admin &amp; scheduler key” below, then open <Link href="/connect">Connect accounts</Link>.
        </div>
      )}
      {ok && <div className="notice ok">{ok}</div>}
      {error && <div className="notice bad">{error}</div>}
      {dbError && <SetupError message={dbError} />}

      <div className="grid2">
        <section className="card">
          <h2>Social accounts</h2>
          <p className="muted" style={{ margin: 0 }}>Facebook, Instagram, LinkedIn and WordPress are connected on their own page, with step-by-step instructions for each.</p>
          <Link className="btn" href="/connect" style={{ justifySelf: "start" }}>Open Connect accounts</Link>
        </section>
        <AdminPanel appUrl={origin} />

        <section className="card">
          <h2>Setup checklist</h2>
          <div className="results">
            <div>{check(env.db)} Database (Upstash Redis)</div>
            <div>{check(env.blob)} File storage (Vercel Blob)</div>
            <div>{check(env.password)} Admin account</div>
            <div>{check(env.cron)} Scheduler key (add it to GitHub as <code>CRON_SECRET</code>)</div>
            <div>{check(env.meta)} Facebook &amp; Instagram keys (<Link href="/connect#facebook">set up</Link>)</div>
            <div>{check(env.linkedin)} LinkedIn keys (<Link href="/connect#linkedin">set up</Link>)</div>
            <div>{check(env.wordpress)} WordPress details (<Link href="/connect#wordpress">set up</Link>)</div>
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            LinkedIn API version in use: <code>{linkedInVersion()}</code>
            {orgId ? ` · posting as company page ${orgId}` : " · posting to your personal profile"}
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
