# AGENTS.md

> Repository operating guide for coding agents (Codex, CI assistants, bots).
> 
> **How to use this file:** keep the structure, edit the values/placeholders, and delete sections you do not want enforced.

## 1) Project overview

- **Project name:** `sailingwhiteboard`
- **Primary stack:** React + Vite + TypeScript/JSX + Tailwind + Ant Design
- **Primary goals:**
  - Build and maintain a sailing race whiteboard/animation builder
  - Keep UX fast, predictable, and mobile-friendly
  - Preserve scenario compatibility and import/export stability

## 2) Agent priorities (highest → lowest)

1. Correctness and data integrity
2. Clear, maintainable code
3. Backward compatibility (especially scenario JSON schema)
4. UX consistency with existing patterns
5. Performance and bundle impact
6. Delivery speed

## 3) Working norms for agents

### 3.1 Before coding
- Read only the files needed for the task first; expand scope only when blocked.
- Prefer existing patterns/components/hooks over introducing new abstractions.
- If requirements are ambiguous, implement the safest minimal change and document assumptions.

### 3.2 During coding
- Keep changes tightly scoped to the task.
- Avoid broad refactors unless explicitly requested.
- Add comments only when logic is non-obvious.
- Preserve existing behavior unless the task requests behavior change.

### 3.3 After coding
- Run relevant checks/tests and report results clearly.
- Include migration notes when schema/API behavior changes.
- Summarize risk areas and follow-up suggestions.

## 4) Repo-specific technical guidance

### 4.1 Architecture preferences
- Prefer composable hooks and focused components.
- Keep state close to where it is used unless it must be shared globally.
- Reuse existing utility modules (`src/lib/*`) before creating new helpers.

### 4.2 Data and schema safety
- Treat project/scenario JSON as a versioned interface.
- Maintain compatibility with existing `ProjectFile`/`ScenarioFile` formats.
- Validate imports defensively; fail gracefully with useful messages.

### 4.3 UI/UX conventions
- Match current styling system (Tailwind utility classes + existing component styling).
- Keep desktop and mobile experiences aligned in capability unless intentionally different.
- Respect timeline/editor interaction patterns already present in the app.

## 5) Code style guardrails

- Follow existing naming and file organization conventions.
- Keep functions small and purpose-driven.
- Prefer explicit types in shared boundaries and public utilities.
- Do not introduce unrelated dependencies without clear justification.

## 6) Testing and validation policy

- **Minimum required checks for most code changes:**
  - `npm run build`
  - `npm run lint` (if configured for the changed files)
- For logic-heavy changes, add/update focused tests where test infrastructure exists.
- For UI changes, validate key interaction path(s) manually and note what was verified.

## 7) Performance and reliability expectations

- Avoid per-frame allocations in animation-critical paths.
- Prevent unnecessary rerenders in large timeline/canvas views.
- Prefer memoization only where it demonstrably reduces work.

## 8) Git and PR conventions

### 8.1 Commit style
Use one of:
- `feat: ...`
- `fix: ...`
- `refactor: ...`
- `docs: ...`
- `test: ...`
- `chore: ...`

### 8.2 PR expectations
PR description should include:
1. What changed
2. Why it changed
3. How it was validated
4. Any risk/rollback notes

## 9) Directory-scoped overrides (optional)

> Add nested `AGENTS.md` files in subdirectories for more specific instructions.
> More deeply nested files override parent guidance.

Suggested folders for overrides:
- `src/builder/`
- `src/components/`
- `src/canvas/`
- `src/animation/`

## 10) Customization checklist (fill this in)

- [ ] Replace project overview with your exact goals
- [ ] Set mandatory commands in Section 6
- [ ] Add any forbidden changes (e.g., “no schema changes without approval”)
- [ ] Add release constraints (branching, versioning, changelog)
- [ ] Add domain rules (e.g., racing rules references)
- [ ] Add ownership map (who reviews what)

## 11) Optional strict mode block (uncomment to enforce)

<!--
STRICT MODE:
- Do not modify more than 5 files unless explicitly requested.
- Do not change JSON schema versions without explicit instruction.
- Do not add dependencies.
- Always run: npm run build && npm run lint.
- Include a rollback plan in every PR body.
-->

---

## Maintainer notes

Use this file as your “default operating contract” with agents.
If behavior drifts, tighten this file with concrete, testable rules.
