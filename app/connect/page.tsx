import { headers } from "next/headers";
import { publicConfig } from "@/lib/credentials";
import SetupError from "../components/SetupError";
import TopBar from "../components/TopBar";
import ConnectClient from "./ConnectClient";

export const dynamic = "force-dynamic";

export default async function ConnectPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const h = await headers();
  const origin = (process.env.APP_URL || `https://${h.get("host")}`).replace(/\/$/, "");
  let config;
  try {
    config = await publicConfig();
  } catch (e) {
    return (
      <main className="wrap">
        <TopBar current="connect" />
        <SetupError message={e instanceof Error ? e.message : String(e)} />
      </main>
    );
  }
  return (
    <main className="wrap">
      <TopBar current="connect" />
      <section style={{ display: "grid", gap: 8 }}>
        <h1>Connect accounts</h1>
        <p className="muted" style={{ margin: 0, maxWidth: "70ch" }}>
          Connect each place you post to. Each card walks you through it: create a free developer app, paste its two keys
          here, then click Connect and approve. Posts only go to accounts that show <b style={{ color: "var(--ok)" }}>Connected</b>.
        </p>
      </section>
      {ok && <div className="notice ok">{ok}</div>}
      {error && <div className="notice bad">{error}</div>}
      <ConnectClient origin={origin} initial={config} />
    </main>
  );
}
