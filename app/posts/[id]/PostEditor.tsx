"use client";
import { upload } from "@vercel/blob/client";
import Link from "next/link";
import { useRef, useState } from "react";
import { isoToWat, formatWat, watToIso } from "@/lib/time";
import { CHANNEL_LABEL, CHANNELS, type Channel, type Media, type Post } from "@/lib/types";

const KIND_HELP: Record<Post["kind"], string> = {
  image: "Attach 1 image. For Instagram, export from Canva as JPG.",
  carousel: "Attach 2–10 slides in order. Export each Canva page as JPG.",
  video: "Attach 1 MP4 video (vertical 9:16 for Reels). Optionally add a cover image for Instagram.",
  blog: "Optional: attach 1 featured image (JPG or PNG). It becomes the post's featured image in WordPress.",
};

export default function PostEditor({ initial, initialProblems }: { initial: Post; initialProblems: string[] }) {
  const [post, setPost] = useState(initial);
  const [problems, setProblems] = useState(initialProblems);
  const wat = isoToWat(initial.scheduledAt);
  const [date, setDate] = useState(wat.date);
  const [time, setTime] = useState(wat.time);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const [confirmPost, setConfirmPost] = useState(false);
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const locked = post.status === "posting" || post.status === "posted";
  const isBlog = post.kind === "blog";

  function edit<K extends keyof Post>(key: K, value: Post[K]) {
    setPost((p) => ({ ...p, [key]: value }));
  }

  async function save(extra: Record<string, unknown> = {}, label = "Saved.") {
    setBusy("save");
    setMsg(null);
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(locked
            ? {}
            : {
                caption: post.caption,
                hashtags: post.hashtags,
                heading: post.heading,
                channels: post.channels,
                media: post.media,
                cover: post.cover ?? null,
                scheduledAt: watToIso(date, time),
                ...(isBlog ? { article: post.article || "", blogMeta: post.blog?.meta || "" } : {}),
              }),
          ...extra,
        }),
      });
      const json = await res.json();
      if (json.post) setPost(json.post);
      if (json.problems) setProblems(json.problems);
      setMsg(res.ok ? { kind: "ok", text: label } : { kind: "bad", text: json.error || "Could not save." });
      return res.ok;
    } catch {
      setMsg({ kind: "bad", text: "Could not reach the server. Your changes are not saved yet." });
      return false;
    } finally {
      setBusy("");
    }
  }

  async function addFiles(files: FileList | File[], asCover = false) {
    setBusy("upload");
    setMsg(null);
    const added: Media[] = [];
    try {
      for (const file of Array.from(files)) {
        const blob = await upload(`posts/${post.id}/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
          multipart: file.size > 20 * 1024 * 1024,
        });
        added.push({ url: blob.url, pathname: blob.pathname, contentType: file.type || blob.contentType, size: file.size });
      }
      const next = asCover ? { ...post, cover: added[0] } : { ...post, media: [...post.media, ...added] };
      setPost(next);
      // Save straight away so uploads aren't lost if the tab closes.
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(asCover ? { cover: next.cover } : { media: next.media }),
      });
      const json = await res.json();
      if (json.post) setPost(json.post);
      if (json.problems) setProblems(json.problems);
      setMsg({ kind: "ok", text: `${added.length} file${added.length > 1 ? "s" : ""} uploaded and saved.` });
    } catch (e) {
      setMsg({ kind: "bad", text: `Upload failed: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy("");
    }
  }

  function move(i: number, d: -1 | 1) {
    const m = [...post.media];
    const j = i + d;
    if (j < 0 || j >= m.length) return;
    [m[i], m[j]] = [m[j], m[i]];
    edit("media", m);
  }

  async function postNow() {
    setConfirmPost(false);
    if (!(await save({}, "Saved."))) return;
    setBusy("post");
    setMsg(null);
    try {
      const res = await fetch(`/api/posts/${post.id}/publish`, { method: "POST" });
      const json = await res.json();
      if (json.post) setPost(json.post);
      if (!res.ok) setMsg({ kind: "bad", text: json.error });
      else {
        const failed = Object.entries(json.summary.channels).filter(([, v]) => String(v).startsWith("failed"));
        setMsg(
          failed.length
            ? { kind: "bad", text: `Some channels failed. See the results below.` }
            : { kind: "ok", text: "Published. See the links below." }
        );
      }
    } catch {
      setMsg({ kind: "bad", text: "The request timed out. Reload the page to see what was posted." });
    } finally {
      setBusy("");
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMsg({ kind: "ok", text: "Copied." });
    } catch {
      setMsg({ kind: "bad", text: "Copy failed. Select the text and copy it manually." });
    }
  }

  const toggleChannel = (c: Channel) =>
    edit("channels", post.channels.includes(c) ? post.channels.filter((x) => x !== c) : CHANNELS.filter((x) => x === c || post.channels.includes(x)));

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <Link href="/" className="muted" style={{ fontSize: 14 }}>← All posts</Link>
        <div className="eyebrow">
          {post.format} · {formatWat(post.scheduledAt)} WAT
        </div>
        <h1>{post.heading}</h1>
        <div className="row">
          <span className={`pill s-${post.status}`}>{post.status}</span>
          {post.type !== "regular" && <span className="tag">{post.type === "flyer" ? "New month" : "Holiday"}</span>}
        </div>
      </div>

      {msg && <div className={`notice ${msg.kind}`} role="status">{msg.text}</div>}

      <div className="grid2">
        <div style={{ display: "grid", gap: 16 }}>
          {(
            <section className="card">
              <h2>{isBlog ? "Featured image" : "Images & video"}</h2>
              <p className="muted" style={{ margin: 0 }}>{KIND_HELP[post.kind]}</p>
              {post.media.length > 0 && (
                <div className="media">
                  {post.media.map((m, i) => (
                    <div className="thumb" key={m.url}>
                      {m.contentType.startsWith("video/") ? (
                        <video src={m.url} muted playsInline controls preload="metadata" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.url} alt={`Slide ${i + 1}`} />
                      )}
                      <div className="bar">
                        <span>{i + 1}</span>
                        {!locked && (
                          <span style={{ display: "flex", gap: 3 }}>
                            <button className="ghost" onClick={() => move(i, -1)} aria-label="Move earlier" disabled={i === 0}>←</button>
                            <button className="ghost" onClick={() => move(i, 1)} aria-label="Move later" disabled={i === post.media.length - 1}>→</button>
                            <button className="ghost" onClick={() => edit("media", post.media.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!locked && (
                <>
                  <div
                    className={`drop${over ? " over" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => fileRef.current?.click()}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setOver(true);
                    }}
                    onDragLeave={() => setOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setOver(false);
                      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
                    }}
                  >
                    {busy === "upload" ? "Uploading…" : "Drop your Canva files here, or click to choose"}
                  </div>
                  <input
                    ref={fileRef}
                    id="files"
                    type="file"
                    hidden
                    multiple={post.kind === "carousel"}
                    accept={post.kind === "video" ? "video/mp4,video/quicktime" : "image/jpeg,image/png,image/webp"}
                    onChange={(e) => e.target.files?.length && addFiles(e.target.files)}
                  />
                  {post.kind === "video" && (
                    <div className="row">
                      <button className="ghost small" onClick={() => coverRef.current?.click()}>
                        {post.cover ? "Replace cover image" : "Add Instagram cover image (optional)"}
                      </button>
                      {post.cover && (
                        <button className="ghost small" onClick={() => edit("cover", null)}>Remove cover</button>
                      )}
                      <input ref={coverRef} id="cover" type="file" hidden accept="image/jpeg" onChange={(e) => e.target.files?.length && addFiles(e.target.files, true)} />
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {isBlog && (
            <section className="card">
              <h2>Article</h2>
              <label>
                Title
                <input id="heading" type="text" value={post.heading} disabled={locked} onChange={(e) => edit("heading", e.target.value)} />
              </label>
              <label>
                Article text
                <textarea
                  id="article"
                  className="article"
                  value={post.article || ""}
                  disabled={locked}
                  placeholder={"Paste or write the article here.\n\n## A section heading\n\nA paragraph. **Bold** and [links](https://scholarstika.org) work.\n\n- A bullet point\n- Another one"}
                  onChange={(e) => edit("article", e.target.value)}
                />
              </label>
              <div className="muted" style={{ fontSize: 13 }}>
                Use <code>##</code> for headings, <code>-</code> for bullet points, <code>**bold**</code> and <code>[text](link)</code>. Pasting HTML also works.
              </div>
              <label>
                Excerpt / meta description
                <textarea
                  id="meta"
                  style={{ minHeight: 70 }}
                  value={post.blog?.meta || ""}
                  disabled={locked}
                  onChange={(e) => post.blog && edit("blog", { ...post.blog, meta: e.target.value })}
                />
              </label>
              <div className="muted mono">
                {(post.article || "").trim().split(/\s+/).filter(Boolean).length} words · meta {(post.blog?.meta || "").length}/160 characters
              </div>
            </section>
          )}

          {!isBlog && (
          <section className="card">
            <h2>Caption</h2>
            <label>
              Heading (for your reference; also the video title and image alt text)
              <input id="heading" type="text" value={post.heading} disabled={locked} onChange={(e) => edit("heading", e.target.value)} />
            </label>
            <label>
              Caption
              <textarea id="caption" value={post.caption} disabled={locked} onChange={(e) => edit("caption", e.target.value)} />
            </label>
            <label>
              Hashtags
              <input id="hashtags" type="text" value={post.hashtags} disabled={locked} onChange={(e) => edit("hashtags", e.target.value)} />
            </label>
            <div className="muted mono">{(post.caption + "\n\n" + post.hashtags).length} characters</div>
          </section>
          )}
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          {(
            <section className="card">
              <h2>Schedule</h2>
              <div className="row">
                <label>
                  Date
                  <input id="date" type="date" value={date} disabled={locked} onChange={(e) => setDate(e.target.value)} />
                </label>
                <label>
                  Time (WAT)
                  <input id="time" type="time" value={time} disabled={locked} onChange={(e) => setTime(e.target.value)} />
                </label>
              </div>
              {isBlog ? (
                <div className="row" style={{ gap: 8 }}>
                  <span className="ch wordpress">WordPress</span>
                  <span className="muted" style={{ fontSize: 13 }}>Published on your website blog at this time.</span>
                </div>
              ) : (
              <div className="checks" role="group" aria-label="Channels">
                {CHANNELS.map((c) => (
                  <label key={c}>
                    <input id={`ch-${c}`} type="checkbox" checked={post.channels.includes(c)} disabled={locked} onChange={() => toggleChannel(c)} />
                    {CHANNEL_LABEL[c]}
                  </label>
                ))}
              </div>
              )}

              {problems.length > 0 && post.status !== "posted" && (
                <div className="notice warn">
                  Before this can go out:
                  <ul>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
                </div>
              )}

              <div className="row">
                {!locked && <button className="ghost" onClick={() => save()} disabled={!!busy}>{busy === "save" ? "Saving…" : "Save"}</button>}
                {(post.status === "draft" || post.status === "failed") && (
                  <button onClick={() => save({ action: "ready" }, "Ready. It will publish automatically at its scheduled time.")} disabled={!!busy}>
                    Save &amp; mark ready
                  </button>
                )}
                {post.status === "ready" && (
                  <button className="ghost" onClick={() => save({ action: "draft" }, "Moved back to draft. It won't publish until you mark it ready.")} disabled={!!busy}>
                    Back to draft
                  </button>
                )}
                {post.status === "failed" && (
                  <button className="ghost" onClick={() => save({ action: "retry" }, "Will retry the failed channels on the next run.")} disabled={!!busy}>
                    Retry failed channels
                  </button>
                )}
              </div>
              {post.status !== "posted" && post.status !== "posting" && (
                <div className="row">
                  {!confirmPost ? (
                    <button className="ghost" onClick={() => setConfirmPost(true)} disabled={!!busy || problems.length > 0}>
                      Post now instead
                    </button>
                  ) : (
                    <>
                      <span>Publish to {post.channels.map((c) => CHANNEL_LABEL[c]).join(", ")} right now?</span>
                      <button className="danger" onClick={postNow} disabled={!!busy}>{busy === "post" ? "Posting…" : "Yes, post now"}</button>
                      <button className="ghost" onClick={() => setConfirmPost(false)}>Cancel</button>
                    </>
                  )}
                </div>
              )}
            </section>
          )}

          {Object.keys(post.results).length > 0 && (
            <section className="card">
              <h2>Results</h2>
              <div className="results">
                {post.channels.map((c) => {
                  const r = post.results[c];
                  if (!r) return null;
                  return (
                    <div key={c}>
                      <span className={`ch ${c}`}>{CHANNEL_LABEL[c]}</span>
                      <b>{r.status}</b>
                      {r.url && <a href={r.url} target="_blank" rel="noreferrer">View post ↗</a>}
                      {r.error && <span style={{ color: r.status === "failed" ? "var(--bad)" : "var(--warn)" }}>{r.error}</span>}
                      {r.at && <span className="muted mono">{formatWat(r.at)} · try {r.attempts || 1}</span>}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {post.blog && (
            <section className="card">
              <h2>Blog details</h2>
              <div><span className="eyebrow">Keyword</span><div>{post.blog.kw}</div></div>
              <div><span className="eyebrow">URL</span><div className="mono">{post.blog.slug}</div></div>
              <div>
                <span className="eyebrow">Outline</span>
                <ol style={{ margin: "4px 0 0", paddingLeft: 18 }}>{post.blog.outline.map((o) => <li key={o}>{o}</li>)}</ol>
              </div>
            </section>
          )}

          <section className="card">
            <h2>{post.kind === "video" ? "Video & cover prompts" : "Image prompts"}</h2>
            <p className="muted" style={{ margin: 0 }}>Use these in Canva&apos;s Magic Media, or any image or video generator.</p>
            {post.prompts.map((p) => (
              <div className="prompt" key={p.label}>
                <div className="head">
                  <span className="eyebrow">{p.label}</span>
                  <button className="ghost small" onClick={() => copy(p.text)}>Copy</button>
                </div>
                <div>{p.text}</div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
