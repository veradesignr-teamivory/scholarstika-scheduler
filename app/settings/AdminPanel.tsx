"use client";
import { useEffect, useState } from "react";

/** Scheduler key for GitHub, plus password change. */
export default function AdminPanel({ appUrl }: { appUrl: string }) {
  const [key, setKey] = useState<string | null>(null);
  const [fromEnv, setFromEnv] = useState({ password: false, cron: false });
  const [shown, setShown] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmNew, setConfirmNew] = useState(false);

  useEffect(() => {
    fetch("/api/admin", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        setKey(j.cronKey);
        setFromEnv(j.fromEnv);
      })
      .catch(() => setMsg({ kind: "bad", text: "Could not load the scheduler key. Reload the page." }));
  }, []);

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMsg({ kind: "ok", text: `${label} copied.` });
    } catch {
      setShown(true);
      setMsg({ kind: "bad", text: "Copy failed. Select the text and copy it manually." });
    }
  }

  async function post(body: Record<string, string>) {
    const res = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json();
    setMsg(res.ok ? { kind: "ok", text: j.message } : { kind: "bad", text: j.error });
    return { ok: res.ok, j };
  }

  return (
    <section className="card">
      <h2>Admin &amp; scheduler key</h2>
      {msg && <div className={`notice ${msg.kind}`} role="status">{msg.text}</div>}

      <div style={{ display: "grid", gap: 8 }}>
        <span className="eyebrow">GitHub secrets for the 15-minute schedule</span>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          In GitHub, open the repository → Settings → Secrets and variables → Actions → New repository secret, and add these two:
        </p>
        <div className="row" style={{ gap: 8 }}>
          <code>APP_URL</code>
          <code>{appUrl}</code>
          <button className="ghost small" onClick={() => copy(appUrl, "APP_URL")}>Copy</button>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <code>CRON_SECRET</code>
          {key ? (
            <>
              <code>{shown ? key : "•".repeat(16)}</code>
              <button className="ghost small" onClick={() => setShown(!shown)}>{shown ? "Hide" : "Show"}</button>
              <button className="ghost small" onClick={() => copy(key, "CRON_SECRET")}>Copy</button>
            </>
          ) : (
            <span className="muted">Loading…</span>
          )}
        </div>
        {!fromEnv.cron && key && (
          <div className="row">
            {!confirmNew ? (
              <button className="ghost small" onClick={() => setConfirmNew(true)}>Make a new key</button>
            ) : (
              <>
                <span style={{ fontSize: 13 }}>The old key stops working until you update GitHub. Continue?</span>
                <button className="danger small" onClick={async () => { setConfirmNew(false); const r = await post({ action: "cron" }); if (r.ok) setKey(r.j.cronKey); }}>Yes, new key</button>
                <button className="ghost small" onClick={() => setConfirmNew(false)}>Cancel</button>
              </>
            )}
          </div>
        )}
      </div>

      <hr style={{ border: 0, borderTop: "1px solid var(--rule)", width: "100%" }} />

      <div style={{ display: "grid", gap: 8 }}>
        <span className="eyebrow">Change admin password</span>
        {fromEnv.password ? (
          <span className="muted" style={{ fontSize: 14 }}>The password is set by <code>ADMIN_PASSWORD</code> in Vercel, so change it there.</span>
        ) : (
          <form
            style={{ display: "grid", gap: 8 }}
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await post({ action: "password", current, next });
              if (r.ok) { setCurrent(""); setNext(""); }
            }}
          >
            <label>Current password<input id="cur-pw" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></label>
            <label>New password (at least 10 characters)<input id="new-pw" type="password" autoComplete="new-password" minLength={10} value={next} onChange={(e) => setNext(e.target.value)} required /></label>
            <button type="submit" style={{ justifySelf: "start" }}>Change password</button>
          </form>
        )}
      </div>
    </section>
  );
}
