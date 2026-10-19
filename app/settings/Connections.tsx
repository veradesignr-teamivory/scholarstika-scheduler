"use client";
import { useEffect, useState } from "react";

type Check = Record<string, { ok: boolean; detail: string }>;

export default function Connections({ metaReady, linkedinReady }: { metaReady: boolean; linkedinReady: boolean }) {
  const [check, setCheck] = useState<Check | null>(null);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    try {
      const res = await fetch("/api/connections", { cache: "no-store" });
      setCheck(await res.json());
    } catch {
      setErr("Could not check the connections. Reload to try again.");
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function disconnect(which: "meta" | "linkedin") {
    await fetch(`/api/connections?which=${which}`, { method: "DELETE" });
    load();
  }

  const row = (key: string, label: string) => {
    const c = check?.[key];
    return (
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="row" style={{ gap: 8 }}>
          <span className={`ch ${key}`}>{label}</span>
          <span style={{ color: !c ? "var(--muted)" : c.ok ? "var(--ok)" : "var(--bad)" }}>
            {!c ? "Checking…" : c.ok ? `Connected · ${c.detail}` : c.detail}
          </span>
        </span>
      </div>
    );
  };

  return (
    <section className="card">
      <h2>Accounts</h2>
      {err && <div className="notice bad">{err}</div>}
      {row("facebook", "Facebook")}
      {row("instagram", "Instagram")}
      <div className="row">
        {metaReady ? (
          <a className="btn" href="/api/auth/meta/start">
            {check?.facebook?.ok ? "Reconnect Facebook & Instagram" : "Connect Facebook & Instagram"}
          </a>
        ) : (
          <span className="muted">Add META_APP_ID and META_APP_SECRET in Vercel to enable this button.</span>
        )}
        {check?.facebook?.ok && <button className="ghost small" onClick={() => disconnect("meta")}>Disconnect</button>}
      </div>
      <hr style={{ border: 0, borderTop: "1px solid var(--rule)", width: "100%" }} />
      {row("linkedin", "LinkedIn")}
      <div className="row">
        {linkedinReady ? (
          <a className="btn" href="/api/auth/linkedin/start">
            {check?.linkedin?.ok ? "Reconnect LinkedIn" : "Connect LinkedIn"}
          </a>
        ) : (
          <span className="muted">Add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in Vercel to enable this button.</span>
        )}
        {check?.linkedin?.ok && <button className="ghost small" onClick={() => disconnect("linkedin")}>Disconnect</button>}
      </div>
      <hr style={{ border: 0, borderTop: "1px solid var(--rule)", width: "100%" }} />
      {row("wordpress", "WordPress")}
      <span className="muted" style={{ fontSize: 13 }}>
        WordPress connects with an Application Password set in Vercel (see the setup guide), so there is no button here.
      </span>
      <button className="ghost small" onClick={load} style={{ justifySelf: "start" }}>Test connections again</button>
    </section>
  );
}
