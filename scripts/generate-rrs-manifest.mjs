#!/usr/bin/env node
/**
 * Generate content/rrs/manifest.json from Markdown + frontmatter.
 *
 * Usage:
 *   node scripts/generate-rrs-manifest.mjs --in content/rrs --out content/rrs/manifest.json
 */
import fs from "node:fs";
import path from "node:path";

function readText(p) { return fs.readFileSync(p, "utf8"); }
function writeText(p, s) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, s, "utf8");
}
function parseFrontmatter(text) {
  if (!text.startsWith("---")) return { fm: {}, body: text };
  const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!m) return { fm: {}, body: text };
  const fm = {};
  for (const line of m[1].split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf(":");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (val === "null") { fm[key] = null; continue; }
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      fm[key] = val;
      continue;
    }
    fm[key] = val;
  }
  return { fm, body: m[2] };
}
function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (ent.isFile() && ent.name.toLowerCase().endsWith(".md")) out.push(p);
  }
  return out;
}
function partSortKey(k) {
  const m = /^part(\d+)$/i.exec(k);
  return m ? [0, Number(m[1])] : [1, k];
}
function sectionSortKey(k) {
  const m = /^section([a-z]+)$/i.exec(k);
  return m ? [0, m[1].toUpperCase()] : [1, k];
}
function ruleSort(a, b) {
  const ai = /^\d+$/.test(a.id) ? Number(a.id) : 9999;
  const bi = /^\d+$/.test(b.id) ? Number(b.id) : 9999;
  return ai - bi || a.title.localeCompare(b.title);
}

function getArg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

const inRoot = getArg("--in", "content/rrs");
const outFile = getArg("--out", "content/rrs/manifest.json");

const files = walk(inRoot);
const items = [];
for (const fp of files) {
  const raw = readText(fp);
  const { fm } = parseFrontmatter(raw);
  if (!fm.id || !fm.title) continue;
  items.push({
    id: String(fm.id),
    title: String(fm.title),
    partKey: String(fm.partKey || ""),
    partTitle: String(fm.partTitle || ""),
    sectionKey: fm.sectionKey == null ? null : String(fm.sectionKey),
    sectionTitle: fm.sectionTitle == null ? null : String(fm.sectionTitle),
    file: path.relative(inRoot, fp).replaceAll("\\", "/"),
  });
}

const partsMap = new Map();
for (const it of items) {
  const pk = it.partKey || "unknownPart";
  if (!partsMap.has(pk)) {
    partsMap.set(pk, { key: pk, title: it.partTitle || pk, rules: [], sections: new Map() });
  }
  const part = partsMap.get(pk);
  if (it.sectionKey) {
    if (!part.sections.has(it.sectionKey)) {
      part.sections.set(it.sectionKey, { key: it.sectionKey, title: it.sectionTitle || it.sectionKey, rules: [] });
    }
    part.sections.get(it.sectionKey).rules.push({ id: it.id, title: it.title, file: it.file });
  } else {
    part.rules.push({ id: it.id, title: it.title, file: it.file });
  }
}

const parts = Array.from(partsMap.values())
  .sort((a, b) => {
    const ka = partSortKey(a.key);
    const kb = partSortKey(b.key);
    return ka[0] - kb[0] || (ka[1] > kb[1] ? 1 : ka[1] < kb[1] ? -1 : 0);
  })
  .map((p) => ({
    key: p.key,
    title: p.title,
    rules: (p.rules || []).sort(ruleSort),
    sections: Array.from(p.sections.values())
      .sort((a, b) => {
        const ka = sectionSortKey(a.key);
        const kb = sectionSortKey(b.key);
        return ka[0] - kb[0] || (ka[1] > kb[1] ? 1 : ka[1] < kb[1] ? -1 : 0);
      })
      .map((s) => ({ key: s.key, title: s.title, rules: s.rules.sort(ruleSort) })),
  }));

const out = {
  schemaVersion: 1,
  generatedAtIso: new Date().toISOString(),
  root: inRoot,
  parts,
};

writeText(outFile, JSON.stringify(out, null, 2) + "\n");
console.log(`✅ Wrote ${outFile}`);
