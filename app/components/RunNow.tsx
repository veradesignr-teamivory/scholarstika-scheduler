"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Publishes everything that is ready and due right now (the same thing the cron job does). */
export default function RunNow() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function run() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/run", { method: "POST" });
      const json = await res.json();
      if (json.skipped) setMsg(json.skipped);
      else if (!json.due) setMsg("Nothing is due. Posts publish when they are Ready and their time arrives.");
      else setMsg(`Processed ${json.done.length} of ${json.due} due post(s)${json.errors?.length ? `, ${json.errors.length} error(s)` : ""}.`);
      router.refresh();
    } catch {
      setMsg("Could not reach the scheduler. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="row">
      <button onClick={run} disabled={busy}>{busy ? "Running…" : "Run scheduler now"}</button>
      {msg && <span className="muted" role="status">{msg}</span>}
    </div>
  );
}
