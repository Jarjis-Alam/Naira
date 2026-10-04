# Implementation Tasks: NAIRA Product-Wide Information Density and UI Hierarchy Polish

**Feature**: `001-ui-hierarchy-polish`  
**Spec**: [Feature Specification](file:///Users/munshijarjisalam/Documents/Projects/nexora/specs/001-ui-hierarchy-polish/spec.md)  
**Plan**: [Implementation Plan](file:///Users/munshijarjisalam/Documents/Projects/nexora/specs/001-ui-hierarchy-polish/plan.md)  
**Status**: Ready for Implementation  

---

## Task Overview & Invariant Checklist

All tasks in this specification adhere to the [NAIRA Constitution](file:///Users/munshijarjisalam/Documents/Projects/nexora/.specify/memory/constitution.md):
- [x] Zero changes to backend business logic, calculations, or scoring formulas.
- [x] Zero changes to PostgreSQL schemas, tables, migrations, or Drizzle configuration.
- [x] Zero changes to REST API endpoints, parameters, or session authorization (`auth()`).
- [x] Zero invented metrics or placeholder statistics (Zero Fabrication).
- [x] Approved dark-first, technical monochrome visual identity strictly preserved.

---

## Phase 1: Setup & Foundational Primitives

**Purpose**: Create shared, reusable compact presentation primitives to avoid ad-hoc styling and ensure product-wide visual consistency.

- [x] T001 [P] Create `<CompactMetricStrip>` primitive in `frontend/src/components/ui/compact-metric-strip.tsx` to render a high-density, single-row metrics bar with clean hairline dividers instead of stacked multi-card wrappers.
- [x] T002 [P] Create `<DisclosurePanel>` primitive in `frontend/src/components/ui/disclosure-panel.tsx` to provide standard progressive disclosure (collapsible secondary details with accessible chevron controls).
- [x] T003 [P] Refactor `<MetricCardV2>` in `frontend/src/components/ui/metric-card-v2.tsx` to support a compact variant (`variant="compact"`) without nested outer borders or redundant footer labels.

---

## Phase 2: User Story 1 — Dashboard & Performance Dimensions (Priority: P1) 🎯 MVP

**Goal**: Transform `/dashboard` and `/profile` so the above-the-fold viewport immediately answers: *How am I doing? What needs attention? What should I do next?* without multi-layered card sprawl.

### Verification for User Story 1
- [x] T004 Run baseline TypeScript check `cd frontend && npx tsc --noEmit` before editing dashboard/profile.

### Implementation for User Story 1
- [x] T005 [US1] Refactor page header and above-the-fold greeting in `frontend/src/app/(protected)/dashboard/page.tsx`:
  - Replace nested banner cards with a clean greeting line and high-contrast primary action CTA ("Resume Diagnostic" or "Today's Study Focus").
  - Remove redundant eyebrow badges (`"SYSTEM // 2.0"`, `"PLACEMENT OS"`).
- [x] T006 [US1] Streamline the 4 core metric cards on `frontend/src/app/(protected)/dashboard/page.tsx` into a unified, single-tier `<CompactMetricStrip>` (Preparation, Target Fit, Resume ATS, Simulation).
- [x] T007 [US1] Reorganize secondary dashboard sections on `frontend/src/app/(protected)/dashboard/page.tsx`:
  - Flatten nested card containers in the daily execution agenda and recent activity feed.
  - Simplify copy: replace "DETERMINISTIC PERFORMANCE TRENDS" with "Performance", "PRIORITIZED NEXT ACTIONS & INSIGHTS" with "Focus Areas".
- [x] T008 [US1] Refactor `frontend/src/app/(protected)/profile/page.tsx`:
  - Prune redundant eyebrow chips (`"Active Cycle"`, `"Verified"`, `"CS CORE"`) from the candidate hero.
  - Replace the 4 standalone `<MetricCardV2>` blocks with a compact, scannable performance ribbon.
  - Ensure uncalibrated states render clean inline indicators ("Pending baseline") rather than empty cards.
- [x] T009 [US1] Refactor the 14 Performance Dimensions in `frontend/src/components/analytics/placement-intelligence-2-view.tsx`:
  - Preserve all 14 dimensions and their underlying calculations.
  - Replace the massive wall of cards with a compact, tabular/scannable list grouped into *Measured Evidence* vs *Insufficient Evidence*.
  - Keep the deep evidence audit trail accessible via click-to-expand progressive disclosure.

**Checkpoint**: User Story 1 complete. Dashboard and Profile render with high signal-to-noise ratio in the first viewport.

---

## Phase 3: User Story 2 — Resume Intelligence Dossier (Priority: P2)

**Goal**: Deliver a scannable, uncluttered ATS Resume workspace on `/resume` that prioritizes: 1. Status, 2. ATS Score, 3. Critical issues, 4. Action diff, 5. Document preview.

### Implementation for User Story 2
- [x] T010 [US2] Refactor `frontend/src/components/resume/resume-dossier-view.tsx`:
  - Eliminate redundant outer card wrappers and duplicate disclaimers.
  - Present top-level summary in a clean header: ATS Score, Primary Role Target, and Top 3 High-Impact Suggestions.
  - Organize detailed findings into clean tabs (`ATS Audit`, `Keyword & Skill Match`, `Document Editor`) using progressive disclosure.
- [x] T011 [US2] Streamline suggestion cards in `frontend/src/components/resume/suggestions-panel.tsx`:
  - Focus card surface on the exact bullet diff (`Current` vs `Recommended`).
  - Replace bulky severity badges with subtle inline indicators (`High`, `Med`, `Low`).
  - Provide direct, single-click `[Accept]` and `[Dismiss]` actions without modal clutter.
- [x] T012 [US2] Compact the Keyword & Skill Match table in `frontend/src/components/resume/job-description-panel.tsx` and related subcomponents:
  - Render skills as clean monochrome pill tags with status dots (`✓ Matched`, `○ Missing`) instead of sprawling table rows with empty cells.
- [x] T013 [US2] Verify that upload, parsing, editing, variant switching, export, and version history remain 100% operational.

**Checkpoint**: User Story 2 complete. The Resume page is calm, actionable, and rapid to audit.

---

## Phase 4: User Story 3 — Analytics & Practice Density (Priority: P3)

**Goal**: Clean up `/analytics` and `/practice` so students can diagnose concept vulnerabilities and launch practice drills in seconds without vertical scrolling fatigue.

### Implementation for User Story 3
- [x] T014 [US3] Streamline `/analytics` layout in `frontend/src/app/(protected)/analytics/page.tsx`:
  - Organize page into clear logical flow: Summary → Readiness → Evidence → Dimensions → Trends → Strengths / Focus → Target Alignment → Next Actions.
  - Combine radar chart and discipline accuracy into a unified two-column grid.
  - Remove duplicate section intro paragraphs and filler badges.
- [x] T015 [US3] Simplify copy in `frontend/src/app/(protected)/analytics/page.tsx`:
  - "MULTI-DIMENSIONAL EVIDENCE BASELINE" → "Evidence Summary"
  - "DISCIPLINE MASTERY & ACCURACY RADAR" → "Curriculum Breakdown"
- [x] T016 [US3] Polish Practice Hub launcher in `frontend/src/app/(protected)/practice/page.tsx` and `frontend/src/components/practice/practice-launcher-view.tsx`:
  - Streamline topic filters and difficulty pills into a compact bar.
  - Replace oversized topic cards with a clean, high-density topic list with inline accuracy indicators.

**Checkpoint**: User Story 3 complete. Analytics and Practice pages provide immediate diagnostic clarity.

---

## Phase 5: User Story 4 — Applications Pipeline & Outcome Workspace (Priority: P4)

**Goal**: Make the job application lifecycle and offer compensations immediately clear without card sprawl.

### Implementation for User Story 4
- [x] T017 [US4] Refactor Kanban pipeline in `frontend/src/app/(protected)/applications/page.tsx`:
  - Streamline Kanban column headers with compact count pills.
  - Reduce padding on individual application cards, displaying Company, Role, Stage, and Next Event cleanly.
  - Keep detailed interview logs and post-interview reflections accessible in an expandable slide-out or dialog.
- [x] T018 [US4] Polish Offer Analyzer in `frontend/src/app/(protected)/outcomes/page.tsx` and `frontend/src/components/applications/outcome-panel.tsx`:
  - Display headline compensation (CTC & Base) prominently at the top.
  - Place granular ESOPs, bonuses, and rejection post-mortems in an expandable breakdown drawer.
  - Preserve all cohort benchmarking and offer decision tracking functions.

**Checkpoint**: User Story 4 complete. Applications and Outcomes operate as crisp, distraction-free workspaces.

---

## Phase 6: Cross-Cutting Polish, Copy Cleanliness & Empty States

**Purpose**: Systematic review across all remaining candidate surfaces to enforce consistent hierarchy, accessible contrast, and authentic empty states.

- [x] T019 [P] Polish empty states across `/dashboard`, `/tests`, `/applications`, `/resume`, and `/outcomes`:
  - Replace large empty placeholder boxes with concise, one-line notices and a single primary action button.
- [x] T020 [P] Conduct copy review across all modified screens:
  - Eliminate repetitive technical filler words ("Deterministic", "Executive", "Industrial-grade") from routine UI chrome.
  - Ensure labels are clear, dignified, and outcome-oriented.
- [x] T021 [P] Accessibility and contrast audit:
  - Verify white buttons (`bg-white` or `bg-lime-pulse`) have dark text (`text-black` or `text-void-black`) with ≥ 4.5:1 contrast.
  - Ensure disabled controls are visibly dimmed (`opacity-40 cursor-not-allowed`).

---

## Phase 7: Verification, Regression Testing & Convergence

**Purpose**: Complete verification across type safety, schema parity, test suites, responsive breakpoints, and convergence against the specification.

- [x] T022 Run TypeScript static typecheck: `cd frontend && npx tsc --noEmit`.
- [x] T023 Run database schema parity check: `cd frontend && npm run verify:schema`.
- [x] T024 Run targeted regression test suites:
  - `phase-14-placement-intelligence.ts`
  - `phase-15-placement-execution.ts`
  - `phase-16-placement-target-strategy.ts`
  - `phase-17-placement-readiness-simulation.ts`
  - `phase-18-ats-resume-intelligence.ts`
  - `phase-19-applications.ts`
  - `phase-20-placement-outcome-intelligence.ts`
  - `phase-23-placement-intelligence-2.ts`
  - `phase-26-ai-interview-coach.ts`
  - `security-audit.ts`
  - `ui-responsive-qa.ts`
- [x] T025 Run production build: `cd frontend && npm run build`.
- [x] T026 Execute `/speckit-converge` to audit specification compliance and verify zero unbuilt requirements.
