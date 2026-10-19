import Link from "next/link";
import { getPosts } from "@/lib/db";
import { formatWat, monthKey } from "@/lib/time";
import { CHANNEL_LABEL, type Post, type PostStatus } from "@/lib/types";
import RunNow from "./components/RunNow";
import SetupError from "./components/SetupError";
import TopBar from "./components/TopBar";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<PostStatus, string> = {
  draft: "Draft",
  ready: "Ready",
  posting: "Posting",
  posted: "Posted",
  failed: "Failed",
  manual: "Website (manual)",
};
const MONTH_NAME: Record<string, string> = { "2026-10": "October", "2026-11": "November", "2026-12": "December" };

export default async function Home({ searchParams }: { searchParams: Promise<{ status?: string; month?: string }> }) {
  const { status, month } = await searchParams;
  let posts: Post[];
  try {
    posts = await getPosts();
  } catch (e) {
    return (
      <main className="wrap">
        <TopBar current="posts" />
        <SetupError message={e instanceof Error ? e.message : String(e)} />
      </main>
    );
  }

  const now = Date.now();
  const counts = posts.reduce<Record<string, number>>((a, p) => ((a[p.status] = (a[p.status] || 0) + 1), a), {});
  const next = posts.find((p) => p.status === "ready" && new Date(p.scheduledAt).getTime() > now);
  const needsMediaSoon = posts.filter(
    (p) => p.status === "draft" && new Date(p.scheduledAt).getTime() > now && new Date(p.scheduledAt).getTime() < now + 3 * 864e5
  ).length;

  const shown = posts.filter((p) => (!status || p.status === status) && (!month || monthKey(p.scheduledAt) === month));
  const months = [...new Set(posts.map((p) => monthKey(p.scheduledAt)))];

  const link = (s?: string, m?: string) => {
    const q = new URLSearchParams();
    if (s) q.set("status", s);
    if (m) q.set("month", m);
    const qs = q.toString();
    return qs ? `/?${qs}` : "/";
  };

  let lastMonth = "";
  return (
    <main className="wrap">
      <TopBar current="posts" />
      <section style={{ display: "grid", gap: 10 }}>
        <h1>Content plan to 31 December</h1>
        <div className="stats">
          <span><b>{posts.length}</b> posts</span>
          <span>Draft <b>{counts.draft || 0}</b></span>
          <span>Ready <b>{counts.ready || 0}</b></span>
          <span>Posted <b>{counts.posted || 0}</b></span>
          <span>Failed <b>{counts.failed || 0}</b></span>
          <span>Next post: <b>{next ? formatWat(next.scheduledAt) : "none scheduled"}</b></span>
        </div>
        {needsMediaSoon > 0 && (
          <div className="notice warn">
            {needsMediaSoon} post{needsMediaSoon > 1 ? "s" : ""} in the next 3 days {needsMediaSoon > 1 ? "are" : "is"} still a draft.
            Add the images, video or article and mark {needsMediaSoon > 1 ? "them" : "it"} Ready, or {needsMediaSoon > 1 ? "they" : "it"} won&apos;t go out.
          </div>
        )}
        <RunNow />
      </section>

      <div style={{ display: "grid", gap: 8 }}>
        <div className="filters">
          <Link href={link(undefined, month)} aria-current={!status ? "true" : undefined}>All statuses</Link>
          {(["draft", "ready", "posting", "posted", "failed"] as PostStatus[]).map((s) => (
            <Link key={s} href={link(s, month)} aria-current={status === s ? "true" : undefined}>
              {STATUS_LABEL[s]} ({counts[s] || 0})
            </Link>
          ))}
        </div>
        <div className="filters">
          <Link href={link(status)} aria-current={!month ? "true" : undefined}>All months</Link>
          {months.map((m) => (
            <Link key={m} href={link(status, m)} aria-current={month === m ? "true" : undefined}>
              {MONTH_NAME[m] || m}
            </Link>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>When (WAT)</th>
              <th>Post</th>
              <th>Channels</th>
              <th>Media</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">No posts match these filters.</td>
              </tr>
            )}
            {shown.flatMap((p) => {
              const m = monthKey(p.scheduledAt);
              const rows = [];
              if (m !== lastMonth) {
                lastMonth = m;
                rows.push(
                  <tr key={`m-${m}`} className="month-row">
                    <td colSpan={5}>{MONTH_NAME[m] || m}</td>
                  </tr>
                );
              }
              const overdue = p.status === "draft" && new Date(p.scheduledAt).getTime() < now;
              rows.push(
                <tr key={p.id}>
                  <td className="when">{formatWat(p.scheduledAt)}</td>
                  <td style={{ minWidth: 260 }}>
                    <Link className="title" href={`/posts/${p.id}`}>{p.heading}</Link>
                    <div className="muted" style={{ fontSize: 12, display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                      <span>{p.format}</span>
                      {p.type !== "regular" && <span className="tag">{p.type === "flyer" ? "New month" : "Holiday"}</span>}
                      {overdue && <span style={{ color: "var(--warn)" }}>Date passed</span>}
                    </div>
                  </td>
                  <td>
                    <div className="chips">
                      {p.channels.map((c) => (
                        <span key={c} className={`ch ${c}`} title={p.results[c]?.error || p.results[c]?.status || ""}>
                          {CHANNEL_LABEL[c]}
                          {p.results[c]?.status === "posted" ? " ✓" : p.results[c]?.status === "failed" ? " ✕" : ""}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="mono">
                    {p.kind === "blog"
                      ? `${(p.article || "").trim().split(/\s+/).filter(Boolean).length} words`
                      : `${p.media.length}${p.kind === "carousel" ? " slides" : ""}`}
                  </td>
                  <td>
                    <span className={`pill s-${p.status}`}>{STATUS_LABEL[p.status]}</span>
                  </td>
                </tr>
              );
              return rows;
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
