# Implementation Plan: NAIRA Global UI Normalization / De-Pill / De-Clutter Pass

**Branch**: `specs/004-global-ui-normalization` | **Date**: 2026-10-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-global-ui-normalization/spec.md`

## Summary

Execute a comprehensive, systematic visual normalization of NAIRA's user interface to eliminate excessive pill-shaped controls, nested card containers, redundant borders, and cluttered horizontal control rows. The refactor follows the visual hierarchy:
`LAYOUT → TYPOGRAPHY → SPACING → DIVIDERS → SELECTIVE CONTAINERS`.

Rather than executing a blunt global find-and-replace, the architecture addresses the root causes in the shared design token system and UI primitives (`pill.tsx`, `badge.tsx`, `button.tsx`, `card.tsx`), followed by targeted normalization of core surfaces (Resume Dossier view, Test Catalog, Target Strategy, Interview Coach, Roadmap, Dashboard, Sidebar, Top Header).

---

## Technical Context

**Language/Version**: TypeScript 5.x / React 19 / Next.js 15 (App Router)  
**Primary Dependencies**: Tailwind CSS, Lucide React, Radix UI primitives, `class-variance-authority` (cva), `tailwind-merge`  
**Storage**: PostgreSQL + Drizzle ORM (Zero schema changes)  
**Testing**: TypeScript compiler (`npx tsc --noEmit`), Next.js Production Build (`npm run build`), Regression Test Suites (`verify:schema`, `suite.ts`)  
**Target Platform**: Responsive Web (Desktop, Tablet, Mobile)  
**Project Type**: Next.js Fullstack Web Application  
**Performance Goals**: Zero runtime overhead, clean CSS rendering, zero layout thrashing  
**Constraints**: Zero functional, database, auth, calculation, or scoring logic modifications.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I: Preserve the Existing Architecture** — Next.js + React architecture preserved; no new frameworks or duplicate apps.
- [x] **Principle II: Database Safety** — 0 schema changes, 0 migrations, 0 database touches.
- [x] **Principle III: Authentication & Tenant Isolation** — Auth checks and session handling untouched.
- [x] **Principle IV: No Fabricated Data** — Metrics, scores, evidence, and empty states untouched.
- [x] **Principle V: Deterministic Source of Truth** — Scoring formulas, readiness logic, ATS detection untouched.
- [x] **Principle VI: Groq Security** — Server-side AI provider untouched.
- [x] **Principle VII: UI Consistency** — Directly implements "dark-first, monochrome, restrained, strong typography, minimal visual noise, do not turn every piece of information into a card, eliminate redundant eyebrow tags".
- [x] **Principle VIII: UX Over Complexity** — Directly implements "eliminate redundant eyebrow tags, repetitive helper descriptions, and congested multi-layer containers".
- [x] **Principle IX: Test Before Release** — TypeScript verification, schema gate, build verification, and responsive verification planned.

---

## Visual Hierarchy Architecture (Levels 0–4)

1. **Level 0 (Flat content / no container)**:
   - Primary data, titles, descriptions, editorial lists, key metric numbers.
   - Grouped by whitespace and alignment.
2. **Level 1 (Subtle divider / background separation)**:
   - Status strips, metric bars, section breaks, table rows.
   - Styled with thin `border-zinc-800/60` hairlines or subtle background tint (`bg-zinc-900/30`), with restrained corners (`rounded-lg` or flat with bottom border).
3. **Level 2 (Restrained radius for interactive controls)**:
   - Buttons, input fields, dropdown triggers, compact tags, segmented tabs.
   - Standard radius: `rounded-md` (6px) or `rounded-sm` (4px). Never `rounded-full` for standard buttons.
4. **Level 3 (Moderate radius for independent surfaces)**:
   - Primary cards, dialogs, drawers, dropdown menus.
   - Standard radius: `rounded-lg` (8px) or `rounded-xl` (12px).
   - Strict rule: No card inside card unless structurally distinct (e.g. code snippet container inside a modal).
5. **Level 4 (Full pill `rounded-full` ONLY when semantically justified)**:
   - Avatars, circular icon buttons (e.g. close 'X', audio mute circle), status indicator dots (e.g. green pulse), and compact system chips.

---

## Project Structure & Planned Modifications

### Phase 1: Shared Primitives & Tokens
- `frontend/src/app/globals.css`:
  - Adjust `--radius-buttons` to `0.375rem` (6px).
  - Adjust `--radius-cards` to `0.5rem` (8px).
  - Adjust `--radius-pills` to `9999px` strictly for avatars/dots.
- `frontend/src/components/ui/button.tsx`:
  - Update `buttonVariants` to use `rounded-md` across primary, secondary, outline, accent, and ghost variants.
- `frontend/src/components/ui/pill.tsx`:
  - Change base geometry from forced `rounded-full` to `rounded-md`.
  - Add `shape="pill"` prop for genuine Level 4 indicators when needed.
  - Add `variant="inline"` / `variant="plain"` for typography-led metadata with no border box.
- `frontend/src/components/ui/badge.tsx`:
  - Change base geometry from forced `rounded-full` to `rounded-md` / `rounded-sm`.
- `frontend/src/components/ui/card.tsx`:
  - Normalize borders to subtle zinc hairlines (`border-zinc-800/60`), remove aggressive drop shadows and double borders.

### Phase 2: Page Header & Status Strip Normalization
- `frontend/src/components/ui/page-header.tsx`:
  - Clean title + description hierarchy, clean CTA grouping.
- `frontend/src/app/(protected)/resume/resume-dossier-view.tsx`:
  - De-pill the status strip (line 199: remove `rounded-full` capsule container; use clean Level 1 section).
  - De-pill ATS Score (72% becomes prominent editorial typography with clean label, not pill inside pill).
  - Replace pill metadata rows with clean inline typography separated by middots.
  - De-nest diagnostic sidebar cards (strengths, gaps, ATS analysis) into clean editorial list items.

### Phase 3: Major Surfaces Normalization
- `frontend/src/app/(protected)/tests/test-catalog.tsx`:
  - Normalize category tabs, test card containers, and difficulty badges to restrained geometry.
- `frontend/src/app/(protected)/target/page.tsx`:
  - Normalize target company cards, tier indicators, and role badges.
- `frontend/src/app/(protected)/interview/interview-coach-view.tsx`:
  - Normalize evaluation cards, score displays, and question categories.
- `frontend/src/app/(protected)/roadmap/page.tsx`:
  - Normalize milestone nodes, progress indicators, and task cards.
- `frontend/src/app/(protected)/dashboard/page.tsx`:
  - Normalize dashboard metric cards and activity feed.

### Phase 4: Shell Chrome Normalization
- `frontend/src/components/layout/sidebar.tsx`:
  - Normalize nav item active states to restrained `rounded-md`.
  - Clean up Momentum widget and user profile container.
- `frontend/src/components/layout/top-header.tsx`:
  - Normalize action buttons and status indicators.

---

## Verification & Quality Gates

1. **Compilation**: `npx tsc --noEmit` in `frontend/`
2. **Production Build**: `npm run build` in `frontend/`
3. **Database Integrity**: `npm run verify:schema`
4. **Automated Suite**: `npx tsx scripts/start-test-regression.ts` & existing test scripts
5. **Visual Audit**: DOM inspection and verification of primary pages (`/resume`, `/target`, `/tests`, `/interview`, `/roadmap`, `/dashboard`).
