// scripts/build-rrs-static-pages.mjs
import fs from "node:fs";
import path from "node:path";
import MarkdownIt from "markdown-it";

const ROOT = process.cwd();
const RRS_ROOT = path.join(
  ROOT,
  "rrs_markdown_content_scripts",
  "content",
  "rrs",
);
const MANIFEST_PATH = path.join(RRS_ROOT, "manifest.json");

const OUT_ROOT = path.join(ROOT, "public", "rrs");
const OUT_RULES = path.join(OUT_ROOT, "rules");

// Markdown renderer (safe defaults for SEO pages)
const md = new MarkdownIt({
  html: false, // don't allow raw HTML in md
  linkify: true, // autolink URLs
  typographer: true, // smart quotes, etc.
  breaks: false,
});

// Optional: if you want ALL links to open in same tab, keep as-is.
// If you want external links to open new tab w/ rel, you can add a small renderer override later.

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pageHtml({ title, description, canonicalPath, bodyHtml }) {
  const canonical = canonicalPath
    ? `https://sailingwhiteboard.com${canonicalPath}`
    : null;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  ${description ? `<meta name="description" content="${escapeHtml(description)}" />` : ""}
  ${canonical ? `<link rel="canonical" href="${canonical}" />` : ""}
  <style>
    :root{
      --bg: #0b1220;
      --card: #0f1a30;
      --text: #e7eefc;
      --muted: #b9c6e4;
      --link: #7ab7ff;
      --codebg: rgba(255,255,255,0.06);
      --border: rgba(255,255,255,0.10);
      --radius: 14px;
      --maxw: 980px;
      --pad: 22px;
      font-synthesis-weight: none;
    }
    body{
      margin:0;
      background: linear-gradient(180deg, #070b14 0%, var(--bg) 55%, #070b14 100%);
      color: var(--text);
      font: 16px/1.55 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
    }
    a{ color: var(--link); text-decoration: none; }
    a:hover{ text-decoration: underline; }
    .wrap{ max-width: var(--maxw); margin: 0 auto; padding: 40px 18px; }
    .topbar{ display:flex; gap:14px; align-items:center; margin-bottom: 18px; }
    .badge{ font-size: 12px; padding: 4px 10px; border:1px solid var(--border); border-radius:999px; color: var(--muted); }
    .card{
      background: rgba(15,26,48,0.85);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: var(--pad);
      box-shadow: 0 18px 60px rgba(0,0,0,0.35);
      backdrop-filter: blur(10px);
    }
    h1,h2,h3{ line-height:1.15; margin: 0.8em 0 0.4em; }
    h1{ font-size: 34px; margin-top: 0; }
    h2{ font-size: 22px; color: var(--text); }
    h3{ font-size: 18px; color: var(--muted); }
    p{ margin: 0.7em 0; color: var(--text); }
    ul{ margin: 0.6em 0 0.9em 1.2em; }
    code{
      background: var(--codebg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 2px 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 0.95em;
    }
    pre code{
      display:block;
      padding: 12px 14px;
      overflow:auto;
      border-radius: 12px;
    }
    hr{ border:0; border-top:1px solid var(--border); margin: 18px 0; }
    .actions{
      display:flex; flex-wrap:wrap; gap:10px; margin-top: 18px;
    }
    .btn{
      display:inline-flex; align-items:center; gap:8px;
      padding: 10px 14px;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: rgba(255,255,255,0.06);
      color: var(--text);
    }
    .btn:hover{ background: rgba(255,255,255,0.10); text-decoration:none; }
    .footer{ margin-top: 18px; color: var(--muted); font-size: 13px; }

    /* markdown-it table defaults if RRS markdown contains tables */
    table{ width:100%; border-collapse: collapse; margin: 14px 0; }
    th, td{ border:1px solid var(--border); padding: 8px 10px; vertical-align: top; }
    th{ color: var(--text); background: rgba(255,255,255,0.04); }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="topbar">
      <a href="/" class="badge">Sailing Whiteboard</a>
      <a href="/rrs/" class="badge">RRS Index</a>
    </div>
    <div class="card">
      ${bodyHtml}
    </div>
    <div class="footer">© ${new Date().getFullYear()} Sailing Whiteboard</div>
  </div>
</body>
</html>`;
}

function flattenRules(manifest) {
  const out = [];
  for (const part of manifest.parts || []) {
    for (const r of part.rules || []) out.push({ ...r, partTitle: part.title });
    for (const sec of part.sections || []) {
      for (const r of sec.rules || [])
        out.push({ ...r, partTitle: part.title, sectionTitle: sec.title });
    }
  }
  return out;
}

function ruleSlug(rule) {
  // stable & readable url: /rrs/rules/10/
  return String(rule.id).trim();
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const rules = flattenRules(manifest);

  // index page (keep this as simple HTML - no markdown needed)
  const indexBody = `
<h1>Racing Rules of Sailing</h1>
<p>Browse rules and jump into matching Sailing Whiteboard scenarios.</p>
<h2>Rules</h2>
<ul>
  ${rules
    .map(
      (r) =>
        `<li><a href="/rrs/rules/${escapeHtml(ruleSlug(r))}/">Rule ${escapeHtml(
          r.id,
        )} — ${escapeHtml(r.title)}</a></li>`,
    )
    .join("\n")}
</ul>`;

  writeFile(
    path.join(OUT_ROOT, "index.html"),
    pageHtml({
      title: "Racing Rules of Sailing (RRS) — Sailing Whiteboard",
      description:
        "RRS reference pages with links to Sailing Whiteboard scenarios.",
      canonicalPath: "/rrs/",
      bodyHtml: indexBody,
    }),
  );

  // rule pages
  const sitemapUrls = ["/rrs/"];

  for (const r of rules) {
    const mdPath = path.join(RRS_ROOT, r.file);
    const mdSource = fs.readFileSync(mdPath, "utf8");

    // markdown-it does all parsing (headings, lists, emphasis, code, etc.)
    const contentHtml = md.render(mdSource);

    // scenario deep link placeholder (we’ll implement parsing later)
    const scenarioHref = `/?scenario=rrs-${encodeURIComponent(String(r.id))}`;

    const body = `
<h1>Rule ${escapeHtml(r.id)} — ${escapeHtml(r.title)}</h1>
<p style="color: var(--muted); margin-top: -6px;">
  ${escapeHtml(r.partTitle || "")}${r.sectionTitle ? ` • ${escapeHtml(r.sectionTitle)}` : ""}
</p>
<div class="actions">
  <a class="btn" href="${scenarioHref}">Open matching scenario</a>
  <a class="btn" href="/rrs/">Back to RRS index</a>
</div>
<hr />
${contentHtml}
`;

    const outDir = path.join(OUT_RULES, ruleSlug(r));
    writeFile(
      path.join(outDir, "index.html"),
      pageHtml({
        title: `RRS Rule ${r.id}: ${r.title} — Sailing Whiteboard`,
        description: `RRS Rule ${r.id} (${r.title}) with Sailing Whiteboard scenario links.`,
        canonicalPath: `/rrs/rules/${ruleSlug(r)}/`,
        bodyHtml: body,
      }),
    );

    sitemapUrls.push(`/rrs/rules/${ruleSlug(r)}/`);
  }

  // sitemap
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls
  .map((u) => `  <url><loc>https://sailingwhiteboard.com${u}</loc></url>`)
  .join("\n")}
</urlset>`;
  writeFile(path.join(OUT_ROOT, "sitemap.xml"), sitemap);

  console.log(`[rrs] wrote ${rules.length} rule pages to ${OUT_ROOT}`);
}

main();
