# Tasks: NAIRA Global UI Normalization / De-Pill / De-Clutter Pass

**Input**: Design documents from `/specs/004-global-ui-normalization/`  
**Prerequisites**: `spec.md`, `plan.md`, `checklists/requirements.md`

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel
- **[Story]**: User story mapping (US1, US2, US3, US4)

---

## Phase 1: Shared Primitives & Tokens (User Story 1 - Priority: P1) 🎯 MVP

**Purpose**: Update global tokens and shared UI primitives to establish the restrained 0–4 shape language.

- [ ] T001 [US1] Update design tokens in `frontend/src/app/globals.css` (refine `--radius-buttons` to 6px, `--radius-cards` to 8px, reserve `--radius-pills` for circular/avatar elements).
- [ ] T002 [US1] Update `frontend/src/components/ui/button.tsx` to enforce restrained geometry (`rounded-md`) across all button variants and sizes.
- [ ] T003 [US1] Refactor `frontend/src/components/ui/pill.tsx` to default to `rounded-md` / `rounded-sm` geometry, add `shape="pill"` prop for strict Level 4 indicators, and add `variant="inline"` / `variant="plain"` for typography-first metadata.
- [ ] T004 [US1] Update `frontend/src/components/ui/badge.tsx` to use restrained geometry (`rounded-md` / `rounded-sm`) instead of forced `rounded-full`.
- [ ] T005 [US1] Update `frontend/src/components/ui/card.tsx` to use restrained radius (`rounded-lg`), subtle hairline borders (`border-zinc-800/60`), and remove nested double-border styles.

**Checkpoint**: Shared primitives normalized. Run `npx tsc --noEmit` to verify type safety.

---

## Phase 2: Page Headers, Status Strips & Resume Dossier (User Story 2 - Priority: P2)

**Purpose**: Eliminate the giant pill status strip and cluttered horizontal control rows highlighted in the user screenshot.

- [ ] T006 [US2] Update `frontend/src/components/ui/page-header.tsx` and `frontend/src/components/ui/section-header.tsx` to enforce clear typography hierarchy and clean action grouping.
- [ ] T007 [US2] Refactor the top status strip in `frontend/src/app/(protected)/resume/resume-dossier-view.tsx` (remove outer `rounded-full` capsule; implement a clean Level 1 subtle bar with restrained geometry).
- [ ] T008 [US2] Transform the ATS readiness score and metadata strip in `frontend/src/app/(protected)/resume/resume-dossier-view.tsx` from nested pill capsules into bold editorial typography with clean inline dividers.
- [ ] T009 [US2] Reorganize the top control row in `frontend/src/app/(protected)/resume/resume-dossier-view.tsx` into clear primary vs. secondary action groups with natural responsive wrapping.
- [ ] T010 [US2] De-nest the right diagnostic sidebar cards (Resume Analysis, Strengths, Gaps, Recommendations) in `frontend/src/app/(protected)/resume/resume-dossier-view.tsx` into clean editorial list items without card-inside-card borders.

**Checkpoint**: Resume Dossier matches editorial technical aesthetic. Typecheck passes.

---

## Phase 3: Major Surfaces De-Pill & De-Clutter (User Story 3 - Priority: P3)

**Purpose**: Normalize remaining major application surfaces (Test Catalog, Target Strategy, Interview Coach, Roadmap, Dashboard).

- [ ] T011 [P] [US3] Normalize `frontend/src/app/(protected)/tests/test-catalog.tsx` (restrain category tabs, test card containers, and difficulty pill badges).
- [ ] T012 [P] [US3] Normalize `frontend/src/app/(protected)/target/page.tsx` (de-pill company cards, tier indicators, and role badges).
- [ ] T013 [P] [US3] Normalize `frontend/src/app/(protected)/interview/interview-coach-view.tsx` (normalize evaluation cards, question items, and score indicators).
- [ ] T014 [P] [US3] Normalize `frontend/src/app/(protected)/roadmap/page.tsx` (restrain milestone cards, progress bars, and timeline indicators).
- [ ] T015 [P] [US3] Normalize `frontend/src/app/(protected)/dashboard/page.tsx` and dashboard metric components to remove unnecessary nested cards and decorative pills.

**Checkpoint**: Core product surfaces follow the typography-led, restrained container hierarchy.

---

## Phase 4: Shell Chrome Normalization (User Story 4 - Priority: P4)

**Purpose**: Ensure persistent application chrome (Sidebar and Top Header) feels calm and unobtrusive.

- [ ] T016 [US4] Normalize `frontend/src/components/layout/sidebar.tsx` (restrain active nav item styling to `rounded-md`, clean up Momentum widget and user profile container).
- [ ] T017 [US4] Normalize `frontend/src/components/layout/top-header.tsx` (restrain breadcrumbs, status indicators, and header action buttons).

---

## Phase 5: Verification, Quality Gates & Spec Kit Convergence

**Purpose**: Verify all quality gates, regression suites, and compute before/after visual hierarchy metrics.

- [ ] T018 Run `npx tsc --noEmit` in `frontend/` to confirm 0 compilation errors.
- [ ] T019 Run `npm run verify:schema` to confirm 0 database regressions.
- [ ] T020 Run `npm run build` in `frontend/` to verify clean production compilation.
- [ ] T021 Run regression test scripts (`scripts/start-test-regression.ts`, `suite.ts`).
- [ ] T022 Audit before/after `rounded-full` counts and card-nesting metrics.
- [ ] T023 Update checklists and converge Spec Kit artifacts.
