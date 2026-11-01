"use client";
import { useEffect, useState } from "react";

type Config = {
  meta: { appId: string; pageId: string; configId: string; hasSecret: boolean; lockedByEnv: boolean };
  linkedin: { clientId: string; orgId: string; hasSecret: boolean; lockedByEnv: boolean };
  wordpress: { siteUrl: string; username: string; status: string; categoryId: string; hasSecret: boolean; lockedByEnv: boolean };
};
type Check = Record<string, { ok: boolean; detail: string }>;
type Platform = "meta" | "linkedin" | "wordpress";

function Status({ ok, keys, detail }: { ok?: boolean; keys: boolean; detail?: string }) {
  const [cls, label] = ok ? ["s-posted", "Connected"] : keys ? ["s-posting", "Keys saved · not connected yet"] : ["s-draft", "Not set up"];
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <span className={`pill ${cls}`} style={{ justifySelf: "start" }}>{label}</span>
      {detail && <span className="muted" style={{ fontSize: 13 }}>{detail}</span>}
    </div>
  );
}

function CopyBox({ label, value }: { label: string; value: string }) {
  const [msg, setMsg] = useState("");
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
        <code style={{ flex: 1, minWidth: 0, padding: "6px 8px", overflowWrap: "anywhere" }}>{value}</code>
        <button
          type="button"
          className="ghost small"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setMsg("Copied");
            } catch {
              setMsg("Select and copy it manually");
            }
            setTimeout(() => setMsg(""), 2000);
          }}
        >
          {msg || "Copy"}
        </button>
      </div>
    </div>
  );
}

const ext = { target: "_blank", rel: "noreferrer" } as const;
const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <li style={{ display: "grid", gridTemplateColumns: "26px 1fr", gap: 8, alignItems: "start" }}>
    <span className="mono" style={{ width: 22, height: 22, borderRadius: 11, display: "grid", placeItems: "center", background: "var(--ink)", color: "var(--paper)", fontWeight: 700 }}>{n}</span>
    <div style={{ display: "grid", gap: 6, minWidth: 0 }}>{children}</div>
  </li>
);

export default function ConnectClient({ origin, initial }: { origin: string; initial: Config }) {
  const [cfg, setCfg] = useState<Config>(initial);
  const [check, setCheck] = useState<Check | null>(null);
  const [busy, setBusy] = useState<string>("");
  const [msg, setMsg] = useState<Record<string, { kind: "ok" | "bad"; text: string } | undefined>>({});
  const [confirmRemove, setConfirmRemove] = useState<Platform | "">("");

  const [meta, setMeta] = useState({ appId: initial.meta.appId, appSecret: "", pageId: initial.meta.pageId, configId: initial.meta.configId });
  const [li, setLi] = useState({ clientId: initial.linkedin.clientId, clientSecret: "", orgId: initial.linkedin.orgId });
  const [wp, setWp] = useState({
    siteUrl: initial.wordpress.siteUrl,
    username: initial.wordpress.username,
    appPassword: "",
    status: initial.wordpress.status || "publish",
    categoryId: initial.wordpress.categoryId,
  });

  async function test() {
    setCheck(null);
    try {
      const r = await fetch("/api/connections", { cache: "no-store" });
      setCheck(await r.json());
    } catch {
      setCheck({});
    }
  }
  useEffect(() => {
    test();
  }, []);

  async function save(platform: Platform, values: Record<string, string>) {
    setBusy(platform);
    setMsg((m) => ({ ...m, [platform]: undefined }));
    try {
      const r = await fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platform, values }) });
      const j = await r.json();
      if (!r.ok) setMsg((m) => ({ ...m, [platform]: { kind: "bad", text: j.error } }));
      else {
        setCfg(j.config);
        if (platform === "meta") setMeta((v) => ({ ...v, appSecret: "" }));
        if (platform === "linkedin") setLi((v) => ({ ...v, clientSecret: "" }));
        if (platform === "wordpress") setWp((v) => ({ ...v, appPassword: "", siteUrl: j.config.wordpress.siteUrl }));
        setMsg((m) => ({
          ...m,
          [platform]: { kind: "ok", text: platform === "wordpress" ? "Saved. Testing the connection…" : "Keys saved. Now click Connect below." },
        }));
        if (platform === "wordpress") await test();
      }
    } catch {
      setMsg((m) => ({ ...m, [platform]: { kind: "bad", text: "Could not reach the app. Check your connection and try again." } }));
    } finally {
      setBusy("");
    }
  }

  async function remove(platform: Platform) {
    setConfirmRemove("");
    const r = await fetch(`/api/config?platform=${platform}`, { method: "DELETE" });
    const j = await r.json();
    if (r.ok) {
      setCfg(j.config);
      setMsg((m) => ({ ...m, [platform]: { kind: "ok", text: "Removed. Nothing will be posted here until you set it up again." } }));
      test();
    }
  }

  const note = (p: Platform) => msg[p] && <div className={`notice ${msg[p]!.kind}`} role="status">{msg[p]!.text}</div>;
  const envNote = (locked: boolean) =>
    locked && (
      <div className="notice warn">These keys are set in Vercel&apos;s Environment Variables, which take priority over this form. Change or remove them there.</div>
    );
  const removeRow = (p: Platform, label: string) =>
    confirmRemove === p ? (
      <div className="row">
        <span style={{ fontSize: 13 }}>Remove the keys and disconnect {label}?</span>
        <button type="button" className="danger small" onClick={() => remove(p)}>Yes, remove</button>
        <button type="button" className="ghost small" onClick={() => setConfirmRemove("")}>Cancel</button>
      </div>
    ) : (
      <button type="button" className="ghost small" style={{ justifySelf: "start" }} onClick={() => setConfirmRemove(p)}>Remove {label}</button>
    );

  const metaKeys = !!cfg.meta.appId && cfg.meta.hasSecret;
  const liKeys = !!cfg.linkedin.clientId && cfg.linkedin.hasSecret;
  const wpKeys = !!cfg.wordpress.siteUrl && !!cfg.wordpress.username && cfg.wordpress.hasSecret;
  const wpProfile = (wp.siteUrl || cfg.wordpress.siteUrl).trim();
  const wpProfileUrl = wpProfile
    ? `${/^https?:\/\//.test(wpProfile) ? "" : "https://"}${wpProfile.replace(/\/+$/, "")}/wp-admin/profile.php#application-passwords-section`
    : "";

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="muted" style={{ fontSize: 14 }}>Status is checked live against each platform.</span>
        <button type="button" className="ghost small" onClick={test}>{check ? "Test all connections again" : "Testing…"}</button>
      </div>

      {/* ───────── Facebook + Instagram ───────── */}
      <section className="card" id="facebook">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "start" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div className="chips"><span className="ch facebook">Facebook Page</span><span className="ch instagram">Instagram</span></div>
            <h2>Facebook &amp; Instagram</h2>
          </div>
          <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
            <Status ok={check?.facebook?.ok} keys={metaKeys} detail={check?.facebook?.ok ? check.facebook.detail : undefined} />
            {check?.facebook?.ok && <Status ok={check?.instagram?.ok} keys detail={check.instagram?.detail} />}
          </div>
        </div>
        {envNote(cfg.meta.lockedByEnv)}
        <div className="notice warn" style={{ fontSize: 13 }}>
          Before you start: your Instagram must be a <b>Business or Creator</b> account and <b>linked to the Scholarstika Facebook Page</b>{" "}
          (Meta Business Suite → Settings → Instagram accounts).
        </div>
        <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 14 }}>
          <Step n={1}>
            <span>
              <b>Create the app.</b> Open <a href="https://developers.facebook.com/apps/" {...ext}>Meta for Developers → My Apps ↗</a> (signed in with the
              Facebook account that is an admin of the Scholarstika Page) and click <b>Create App</b>. On <b>App details</b>, enter the name
              &quot;Scholarstika Scheduler&quot; and your contact email, then click Next.
            </span>
          </Step>
          <Step n={2}>
            <span>
              <b>Pick the use cases.</b> Tick <b>Manage everything on your Page</b>. If it&apos;s offered on the same screen, also tick{" "}
              <b>Manage messaging &amp; content on Instagram</b> (you can add it later from the dashboard). Click Next.
            </span>
          </Step>
          <Step n={3}>
            <span>
              <b>Business portfolio.</b> Pick the Scholarstika business portfolio if you have one, or choose <b>I don&apos;t want to connect a business
              portfolio yet</b>. Click Next through <b>Requirements</b> and <b>Overview</b>, then <b>Go to dashboard</b>. Leave the app in <b>Development</b> mode;
              no App Review is needed to post to your own Page.
            </span>
          </Step>
          <Step n={4}>
            <span>
              <b>Add the posting permissions.</b> In the dashboard, open <b>Use cases</b>. On <b>Manage everything on your Page</b> click <b>Customize</b> and
              click <b>Add</b> next to <code>pages_manage_posts</code>, <code>pages_read_engagement</code> and <code>pages_manage_engagement</code>. For
              Instagram, customize the Instagram use case, choose <b>API setup with Facebook login</b>, and add <code>instagram_basic</code> and{" "}
              <code>instagram_content_publish</code>.
            </span>
          </Step>
          <Step n={5}>
            <span>
              <b>Add the redirect link.</b> In the left menu open <b>Facebook Login for Business → Settings</b>. Paste this into{" "}
              <b>Valid OAuth Redirect URIs</b> (click <b>Check URI</b> if shown), then <b>Save changes</b>:
            </span>
            <CopyBox label="Redirect URL" value={`${origin}/api/auth/meta/callback`} />
          </Step>
          <Step n={6}>
            <span>
              <b>Create a login configuration.</b> Open <b>Facebook Login for Business → Configurations → Create configuration</b>. Name it
              &quot;Scheduler&quot;, choose login variation <b>General</b>, access token <b>User access token</b>, expiration <b>Never</b> (or the longest offered).
              For assets choose <b>Pages</b> and <b>Instagram accounts</b>. Tick these permissions: <code>pages_show_list</code>,{" "}
              <code>pages_read_engagement</code>, <code>pages_manage_posts</code>, <code>pages_manage_engagement</code>, <code>business_management</code>,{" "}
              <code>instagram_basic</code>, <code>instagram_content_publish</code>. Click Create and copy the <b>Configuration ID</b>.
            </span>
          </Step>
          <Step n={7}>
            <span>
              <b>Copy the keys.</b> Go to <b>App settings → Basic</b>. Copy the <b>App ID</b> and the <b>App secret</b> (click Show, then enter your Facebook
              password if asked). Paste them and the Configuration ID below, then click <b>Save keys</b>.
            </span>
            <form
              style={{ display: "grid", gap: 10 }}
              onSubmit={(e) => {
                e.preventDefault();
                save("meta", meta);
              }}
            >
              <div className="row">
                <label>App ID<input id="meta-app-id" type="text" inputMode="numeric" autoComplete="off" value={meta.appId} onChange={(e) => setMeta({ ...meta, appId: e.target.value })} placeholder="e.g. 1234567890123456" /></label>
                <label>
                  App secret
                  <input id="meta-app-secret" type="password" autoComplete="off" value={meta.appSecret} onChange={(e) => setMeta({ ...meta, appSecret: e.target.value })} placeholder={cfg.meta.hasSecret ? "Saved · leave blank to keep" : "Paste the App secret"} />
                </label>
              </div>
              <label>
                Configuration ID <span className="muted" style={{ fontWeight: 400 }}>(from step 6)</span>
                <input id="meta-config-id" type="text" inputMode="numeric" autoComplete="off" value={meta.configId} onChange={(e) => setMeta({ ...meta, configId: e.target.value })} placeholder="e.g. 987654321098765" />
              </label>
              <label>
                Facebook Page ID <span className="muted" style={{ fontWeight: 400 }}>(optional, only if you manage several Pages)</span>
                <input id="meta-page-id" type="text" inputMode="numeric" autoComplete="off" value={meta.pageId} onChange={(e) => setMeta({ ...meta, pageId: e.target.value })} placeholder="Page → About → Page transparency → Page ID" />
              </label>
              <button type="submit" disabled={busy === "meta" || cfg.meta.lockedByEnv} style={{ justifySelf: "start" }}>{busy === "meta" ? "Saving…" : "Save keys"}</button>
            </form>
            {note("meta")}
          </Step>
          <Step n={8}>
            <span>
              <b>Connect.</b> Click the button, log in if asked, and when Facebook asks which Pages and Instagram accounts to allow, <b>tick the Scholarstika
              Page and its Instagram account</b>. You&apos;ll come back here with both showing Connected.
            </span>
            {metaKeys ? (
              <a className="btn" style={{ justifySelf: "start" }} href="/api/auth/meta/start">{check?.facebook?.ok ? "Reconnect Facebook & Instagram" : "Connect Facebook & Instagram"}</a>
            ) : (
              <button type="button" disabled style={{ justifySelf: "start" }}>Connect Facebook &amp; Instagram (save keys first)</button>
            )}
          </Step>
        </ol>
        {(metaKeys || check?.facebook?.ok) && removeRow("meta", "Facebook & Instagram")}
      </section>

      {/* ───────── LinkedIn ───────── */}
      <section className="card" id="linkedin">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "start" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div className="chips"><span className="ch linkedin">LinkedIn</span></div>
            <h2>LinkedIn</h2>
          </div>
          <Status ok={check?.linkedin?.ok} keys={liKeys} detail={check?.linkedin?.detail && (check.linkedin.ok || liKeys) ? check.linkedin.detail : undefined} />
        </div>
        {envNote(cfg.linkedin.lockedByEnv)}
        <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 14 }}>
          <Step n={1}>
            <span>
              Open <a href="https://www.linkedin.com/developers/apps/new" {...ext}>LinkedIn Developers → Create app ↗</a>. Name it &quot;Scholarstika Scheduler&quot;,
              choose the <b>Scholarstika company page</b>, upload the logo, tick the agreement and click Create app.
            </span>
          </Step>
          <Step n={2}>
            <span>On the <b>Products</b> tab, click Request access on <b>Share on LinkedIn</b> and on <b>Sign In with LinkedIn using OpenID Connect</b>. Both are approved instantly.</span>
          </Step>
          <Step n={3}>
            <span>On the <b>Auth</b> tab, under <b>Authorized redirect URLs for your app</b>, click the pencil, add this link and click Update:</span>
            <CopyBox label="Redirect URL" value={`${origin}/api/auth/linkedin/callback`} />
          </Step>
          <Step n={4}>
            <span>On the same <b>Auth</b> tab, copy the <b>Client ID</b> and <b>Primary Client Secret</b> into the boxes below and click Save keys.</span>
            <form
              style={{ display: "grid", gap: 10 }}
              onSubmit={(e) => {
                e.preventDefault();
                save("linkedin", li);
              }}
            >
              <div className="row">
                <label>Client ID<input id="li-client-id" type="text" autoComplete="off" value={li.clientId} onChange={(e) => setLi({ ...li, clientId: e.target.value })} placeholder="e.g. 78abc123def456" /></label>
                <label>
                  Primary Client Secret
                  <input id="li-client-secret" type="password" autoComplete="off" value={li.clientSecret} onChange={(e) => setLi({ ...li, clientSecret: e.target.value })} placeholder={cfg.linkedin.hasSecret ? "Saved · leave blank to keep" : "Paste the Client Secret"} />
                </label>
              </div>
              <label>
                Company page ID <span className="muted" style={{ fontWeight: 400 }}>(optional · leave blank to post to your personal profile)</span>
                <input id="li-org-id" type="text" inputMode="numeric" autoComplete="off" value={li.orgId} onChange={(e) => setLi({ ...li, orgId: e.target.value })} placeholder="The number in linkedin.com/company/12345678/admin" />
              </label>
              <span className="muted" style={{ fontSize: 13 }}>
                Posting as the company page needs LinkedIn&apos;s <b>Community Management API</b> product on your app, which LinkedIn reviews (days to weeks). Until then, leave it blank.
              </span>
              <button type="submit" disabled={busy === "linkedin" || cfg.linkedin.lockedByEnv} style={{ justifySelf: "start" }}>{busy === "linkedin" ? "Saving…" : "Save keys"}</button>
            </form>
            {note("linkedin")}
          </Step>
          <Step n={5}>
            <span>Click Connect and approve. LinkedIn connections last <b>60 days</b>; this card will show the days left, then click Reconnect.</span>
            {liKeys ? (
              <a className="btn" style={{ justifySelf: "start" }} href="/api/auth/linkedin/start">{check?.linkedin?.ok ? "Reconnect LinkedIn" : "Connect LinkedIn"}</a>
            ) : (
              <button type="button" disabled style={{ justifySelf: "start" }}>Connect LinkedIn (save keys first)</button>
            )}
          </Step>
        </ol>
        {(liKeys || check?.linkedin?.ok) && removeRow("linkedin", "LinkedIn")}
      </section>

      {/* ───────── WordPress ───────── */}
      <section className="card" id="wordpress">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "start" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div className="chips"><span className="ch wordpress">WordPress</span></div>
            <h2>WordPress blog</h2>
          </div>
          <Status ok={check?.wordpress?.ok} keys={wpKeys} detail={check?.wordpress && wpKeys ? check.wordpress.detail : undefined} />
        </div>
        {envNote(cfg.wordpress.lockedByEnv)}
        <form
          style={{ display: "grid", gap: 14 }}
          onSubmit={(e) => {
            e.preventDefault();
            save("wordpress", wp);
          }}
        >
          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 14 }}>
            <Step n={1}>
              <label>
                Your website address
                <input id="wp-url" type="text" inputMode="url" autoComplete="off" value={wp.siteUrl} onChange={(e) => setWp({ ...wp, siteUrl: e.target.value })} placeholder="https://scholarstika.org" />
              </label>
            </Step>
            <Step n={2}>
              <span>
                {wpProfileUrl ? (
                  <a href={wpProfileUrl} {...ext}>Open your WordPress profile ↗</a>
                ) : (
                  <>In WordPress admin, go to <b>Users → Profile</b></>
                )}{" "}
                (use an Administrator, Editor or Author account). Scroll to <b>Application Passwords</b>, type &quot;Scholarstika Scheduler&quot; as the name and click{" "}
                <b>Add New Application Password</b>. Copy the code it shows; it&apos;s only shown once.
              </span>
            </Step>
            <Step n={3}>
              <div className="row">
                <label>WordPress username (not email)<input id="wp-user" type="text" autoComplete="off" value={wp.username} onChange={(e) => setWp({ ...wp, username: e.target.value })} /></label>
                <label>
                  Application Password
                  <input id="wp-app-pw" type="password" autoComplete="off" value={wp.appPassword} onChange={(e) => setWp({ ...wp, appPassword: e.target.value })} placeholder={cfg.wordpress.hasSecret ? "Saved · leave blank to keep" : "xxxx xxxx xxxx xxxx xxxx xxxx"} />
                </label>
              </div>
              <div className="row">
                <label>
                  New blog posts are
                  <select id="wp-status" value={wp.status} onChange={(e) => setWp({ ...wp, status: e.target.value })} style={{ font: "inherit", fontSize: 14, padding: "8px 10px", border: "1px solid var(--rule)", borderRadius: 7, background: "var(--paper)", color: "var(--ink)" }}>
                    <option value="publish">Published straight away</option>
                    <option value="draft">Saved as drafts for me to review</option>
                  </select>
                </label>
                <label>Category ID <span className="muted" style={{ fontWeight: 400 }}>(optional)</span><input id="wp-cat" type="text" inputMode="numeric" autoComplete="off" value={wp.categoryId} onChange={(e) => setWp({ ...wp, categoryId: e.target.value })} placeholder="e.g. 5" /></label>
              </div>
              <button type="submit" disabled={busy === "wordpress" || cfg.wordpress.lockedByEnv} style={{ justifySelf: "start" }}>{busy === "wordpress" ? "Saving…" : "Save & test WordPress"}</button>
              {note("wordpress")}
            </Step>
          </ol>
        </form>
        {check?.wordpress && !check.wordpress.ok && wpKeys && (
          <details>
            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>WordPress test failing? Common fixes</summary>
            <ul style={{ fontSize: 14, margin: "8px 0 0", paddingLeft: 18, display: "grid", gap: 4 }}>
              <li>No Application Passwords section: the site must be on HTTPS, and security plugins (e.g. Wordfence) must not disable application passwords.</li>
              <li>401 with a correct password: add <code>SetEnvIf Authorization &quot;(.*)&quot; HTTP_AUTHORIZATION=$1</code> to the top of <code>.htaccess</code>.</li>
              <li>Blocked: Hostinger or Cloudflare bot protection may block the app; allow <code>/wp-json/</code>.</li>
            </ul>
          </details>
        )}
        {(wpKeys || check?.wordpress?.ok) && removeRow("wordpress", "WordPress")}
      </section>
    </div>
  );
}
