# RRS content pack (Markdown + frontmatter)

## What this contains
- `content/rrs/` : Markdown source-of-truth for rules, organized as:
  - `content/rrs/part1/..`
  - `content/rrs/part2/sectionA/..` etc
- `content/rrs/manifest.json` : generated index pointing to each rule file
- `scripts/build-rrs-rules.mjs` : regenerates `src/data/rrsRules.json` from markdown
- `scripts/generate-rrs-manifest.mjs` : regenerates the manifest from markdown

## Suggested package.json scripts
- "rrs:build": "node scripts/build-rrs-rules.mjs --in content/rrs --out src/data/rrsRules.json"
- "rrs:manifest": "node scripts/generate-rrs-manifest.mjs --in content/rrs --out content/rrs/manifest.json"
