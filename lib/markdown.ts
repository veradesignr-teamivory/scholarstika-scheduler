/**
 * Turns the simple Markdown people paste into an article into WordPress-ready HTML.
 * Supports: ## / ### headings, paragraphs, - or * bullet lists, 1. numbered lists, **bold**, *italic*, [links](url).
 * Text that already starts with an HTML tag is passed through unchanged.
 */
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
}

export function markdownToHtml(src: string): string {
  const text = src.replace(/\r\n?/g, "\n").trim();
  if (!text) return "";
  if (/^<[a-z!]/i.test(text)) return text;

  const out: string[] = [];
  for (const block of text.split(/\n{2,}/)) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    if (!lines.length) continue;
    const head = /^(#{1,4})\s+(.*)$/.exec(lines[0]);
    if (head && lines.length === 1) {
      // The post title is the page's <h1>, so a single # becomes <h2>.
      const level = Math.min(Math.max(head[1].length, 2), 4);
      out.push(`<h${level}>${inline(head[2])}</h${level}>`);
      continue;
    }
    if (head) {
      const level = Math.min(Math.max(head[1].length, 2), 4);
      out.push(`<h${level}>${inline(head[2])}</h${level}>`);
      lines.shift();
    }
    if (lines.length && lines.every((l) => /^\s*[-*]\s+/.test(l))) {
      out.push(`<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ""))}</li>`).join("")}</ul>`);
    } else if (lines.length && lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
      out.push(`<ol>${lines.map((l) => `<li>${inline(l.replace(/^\s*\d+[.)]\s+/, ""))}</li>`).join("")}</ol>`);
    } else if (lines.length) {
      out.push(`<p>${lines.map(inline).join("<br>")}</p>`);
    }
  }
  return out.join("\n");
}
