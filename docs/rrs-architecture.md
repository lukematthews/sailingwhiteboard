Here is a clean, structured summary document you can drop into your repo as:

docs/architecture/rrs-library-architecture.md


⸻

RRS Library & Scenario Architecture

Sailing Whiteboard – Content & UI Evolution Summary

1. Objective

Build a structured, extensible Racing Rules of Sailing (RRS) library inside Sailing Whiteboard that:
	•	Mirrors official rule structure (Part → Section → Rule)
	•	Stores rule text in Markdown
	•	Links multiple scenarios to each rule
	•	Supports mobile + desktop
	•	Is SEO-friendly long term
	•	Allows clean content authoring and future growth

⸻

2. Content Architecture

2.1 Rule Hierarchy Model

The rules are structured to match the official RRS format:

Part
  └─ Section
       └─ Rule

Example:

Part 2 – When Boats Meet
  Section A – Right of Way
    Rule 10 – On Opposite Tacks
    Rule 11 – On the Same Tack, Overlapped

This is represented in rrsRules.json as:

{
  "schemaVersion": 1,
  "parts": [
    {
      "key": "part2",
      "title": "Part 2 – When Boats Meet",
      "sections": [
        {
          "key": "sectionA",
          "title": "Section A – Right of Way",
          "rules": [
            {
              "id": "10",
              "title": "On Opposite Tacks",
              "markdown": "## Rule 10 – On Opposite Tacks\n\n..."
            }
          ]
        }
      ]
    }
  ]
}

Design Principles
	•	Match official structure for clarity and authority.
	•	Do not flatten rules into a single list.
	•	Preserve nested list formatting (e.g., Rule 18.1 (a)(1)(2)…).
	•	Rule IDs remain canonical (e.g., "10" not "RRS 10" internally).

⸻

3. Markdown Strategy

3.1 Why Markdown?

Markdown was selected because:
	•	Human-readable for authoring.
	•	Clean version control diffs.
	•	Supports:
	•	Nested lists
	•	Sub-clauses (a), (1), (i)
	•	Headings
	•	Structured sections (e.g. 18.1, 18.2)
	•	Future-compatible with static site generation.

3.2 Rendering Standardization

A shared Markdown renderer was introduced:

RrsMarkdown

Exported from:

RrsLibraryPanel.tsx

This ensures:
	•	Consistent rendering in:
	•	RuleDetailModal
	•	WelcomeOverlay
	•	Future rule pages
	•	Single styling source
	•	No duplication of markdown logic

Key rule:

Markdown rendering must never use whitespace-pre-wrap alone — it must use the shared renderer.

⸻

4. Scenario Architecture

4.1 Scenario → Rule Linking

Scenarios contain:

rules: ["10"]

or

rules: ["RRS 10"]

Rule matching normalizes both forms.

Matching Logic
	•	Canonical rule ID: "10"
	•	Strip "RRS " prefix when matching.
	•	Allow flexible scenario references.

⸻

4.2 Relationship Model

Rule
  ├─ Scenario A (basic)
  ├─ Scenario B (intermediate)
  └─ Scenario C (advanced)

This enables:
	•	Multiple teaching examples per rule
	•	Difficulty progression
	•	Tags (zone, overlap, tacks, obstruction, etc.)

⸻

5. Welcome Overlay Evolution

Before
	•	Derived rule chips from scenarios only.
	•	Did not display true rule hierarchy.
	•	Did not reflect Parts/Sections.

After
	•	Renders full:
	•	Part
	•	Section
	•	Rule tree
	•	Tap rule → modal shows:
	•	Rule markdown
	•	Linked scenarios
	•	Search filters rule text directly.

⸻

6. UI Principles Adopted

6.1 Compact Structure
	•	Collapsible Parts and Sections.
	•	Rule rows are lightweight.
	•	Rule detail shown in modal (not inline expansion).

6.2 Mobile-First
	•	Modal overlays for rule details.
	•	Sticky headers.
	•	Scrollable content area.
	•	Safe-area padding.

6.3 Separation of Concerns
	•	Rule data (content layer)
	•	Scenario data (animation layer)
	•	Markdown renderer (presentation layer)
	•	WelcomeOverlay (entry UX layer)

⸻

7. Future SEO Strategy

Current state:
	•	Plain React + Vite served via serve
	•	No SSR

Future direction:

Planned URL Structure

/rrs/part2/sectionA/10-on-opposite-tacks
/scenario/rrs/10/opposite-tacks-upwind

Long-Term Improvements
	•	Pre-generate static rule pages from Markdown
	•	Each rule page:
	•	Rendered rule text
	•	Linked scenarios
	•	Canonical URL
	•	Generate manifest.json from Markdown rules
	•	Build script to regenerate rrsRules.json

⸻

8. Content Authoring Direction

Future preferred structure:

content/
  rrs/
    part2/
      sectionA/
        10-on-opposite-tacks.md
        11-windward-leeward.md

Each Markdown file:

---
id: 10
title: On Opposite Tacks
part: part2
section: sectionA
---
## Rule 10 – On Opposite Tacks

When boats are on opposite tacks...

Build script responsibilities:
	•	Parse frontmatter
	•	Generate structured rrsRules.json
	•	Optionally generate static rule pages

⸻

9. Collision & Scenario Philosophy (Context)

Although separate from the rules library, this phase aligned with:
	•	Non-overlapping boats (just-touch collision model)
	•	Contact without penetration
	•	Clear representation of “keep clear”
	•	Animation showing approach to conflict

Scenarios should:
	•	Show up to the moment of decision.
	•	Not necessarily show post-penalty resolution.
	•	Emphasize the rule trigger moment.

⸻

10. Key Architectural Decisions

Decision	Reason
Hierarchical rules	Mirrors official RRS structure
Markdown storage	Author-friendly + flexible
Shared renderer	Prevents markdown drift
Rule ID normalization	Flexible scenario references
Modal rule detail	Cleaner UX
Scenario linked by rule ID	Simple relational model


⸻

11. Current State Summary

✔ Parts/Sections/Rules working
✔ Rule linking to scenarios working
✔ Markdown stored in rules
✔ WelcomeOverlay reflects rule tree
✔ Modal shows rule + scenarios
✔ Mobile layout functional

⸻

12. Next Logical Steps
	1.	Move rules fully to Markdown + frontmatter files.
	2.	Add build script to generate:
	•	rrsRules.json
	•	manifest.json
	3.	Create public rule URLs.
	4.	Improve markdown styling (RRS-specific formatting tweaks).
	5.	Add cross-linking between rules (e.g., 18 referencing 11/12).

⸻

If you’d like, I can now generate:
	•	An ADR-formatted version
	•	A commit history outline
	•	Or a roadmap for turning this into SEO-indexed rule pages