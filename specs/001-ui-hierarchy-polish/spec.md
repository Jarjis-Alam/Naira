# Feature Specification: NAIRA Product-Wide Information Density and UI Hierarchy Polish

**Feature Branch**: `001-ui-hierarchy-polish`  
**Feature Number**: `001`  
**Created**: 2026-10-04  
**Status**: Specified / Planned (Ready for Review)  
**Input**: User requirement: "NAIRA Product-Wide Information Density and UI Hierarchy Polish — LESS UI MORE SIGNAL"  

---

## 1. Executive Summary & Design Vision

NAIRA has grown across 26 major functional phases into a comprehensive engineering placement operating system. While the functional depth is exceptionally high (diagnostic exams, 7 core disciplines, target simulation, ATS parsing, Kanban pipeline, offer comparison, AI coaching), the user interface currently suffers from **cognitive overload and layout congestion**:
- Pervasive filler subheadings and redundant eyebrow chips (`EXECUTIVE INTELLIGENCE`, `ACTIVE CYCLE`, `VERIFIED CANDIDATE`).
- Excessive card nesting (cards inside cards inside bordered sections).
- Congested analytics tables and dense radar cards competing for attention.
- Cluttered Resume workspace with repetitive explanations and excessive decorative badges.
- Overly technical internal terminology presented to candidates where clear, human language is needed.

### Core Philosophy: **LESS UI, MORE SIGNAL**
This specification governs a product-wide UI hierarchy polish. **No backend calculations, deterministic scoring formulas, database models, or student capabilities will be removed or altered.** The goal is to maximize information velocity, prioritize primary user decisions, and eliminate visual friction through disciplined hierarchy and progressive disclosure.

---

## 2. User Scenarios & Acceptance Criteria *(Prioritized)*

### User Story 1 — Streamlined Dashboard & Calibrated Performance Overview (Priority: P1)
As a student candidate landing on `/dashboard` and `/profile`,  
I want to instantly grasp my current preparation standing, target alignment, and immediate next action without wading through multi-layered banners, nested card containers, and redundant badge rows,  
So that I can immediately focus on the single highest-value action without visual fatigue.

**Why this priority**: The Dashboard and Profile Performance Dimensions are the daily launchpads for every student. First impressions and cognitive load directly affect user engagement and focus.

**Independent Test**: Navigate to `/dashboard` and `/profile` with both calibrated and uncalibrated accounts. Verify that above-the-fold content shows:
1. Candidate greeting and single Next Best Action callout.
2. Unified 4-dimension performance row (Preparation, Target Fit, Resume ATS, Interview) with compact, readable metric badges instead of oversized layered cards.
3. Zero redundant eyebrow labels (e.g. removing "CANDIDATE INTELLIGENCE DOSSIER", "EXECUTIVE OVERVIEW").

**Acceptance Scenarios**:
1. **Given** a student with active test results, **When** they load `/dashboard`, **Then** the page renders a compact primary action banner, a streamlined 4-metric strip, and direct access to recent activity without scroll-jacking or multi-card nesting.
2. **Given** a new student without baseline calibration, **When** they view Performance Dimensions on `/profile`, **Then** empty states are clean and compact ("Complete baseline test to unlock"), using inline status text rather than expansive empty placeholder cards.
3. **Given** any viewport (desktop 1440px to mobile 375px), **When** reviewing performance dimensions, **Then** typography scales cleanly with no awkward card wrapping or horizontal overflow.

---

### User Story 2 — Decoupled & Clear Resume Intelligence Dossier (Priority: P2)
As a candidate reviewing my ATS resume analysis on `/resume`,  
I want a clear, two-column or tabbed workspace that separates the parsed document from the actionable suggestions,  
So that I can evaluate gaps and accept/reject diffs without visual clutter, repetitive disclaimers, or excessive pill badges.

**Why this priority**: The Resume Intelligence page is one of the most content-dense areas in the application (combining PDF extraction, ATS scores, 60+ skills, JD gap analysis, version history, and suggestions).

**Independent Test**: Upload a resume and evaluate `/resume`. Verify that:
1. Overall ATS score and top 3 high-impact gaps appear in a single uncluttered header summary.
2. Detailed keyword tables and section audits use progressive disclosure (collapsible accordions or tabbed views) rather than displaying 12 expanded sections simultaneously.
3. Suggestion cards emphasize the actionable diff (`Current` vs `Recommended`) with clean Accept/Reject controls, eliminating duplicate severity labels and boilerplate explanations.

**Acceptance Scenarios**:
1. **Given** an uploaded resume with 10+ recommendations, **When** the candidate views `/resume`, **Then** suggestions are prioritized with the highest severity first, and resolved items collapse cleanly.
2. **Given** the Job Description match module, **When** viewing missing vs matched skills, **Then** skills render as compact, scannable tags with status indicators instead of full-width table rows with empty cells.

---

### User Story 3 — Focused Placement Analytics & Diagnostic Matrices (Priority: P3)
As a student analyzing technical weaknesses on `/analytics` and `/practice`,  
I want to view my accuracy across the 7 Core Disciplines without stacked informational alerts, repetitive descriptions, and visual hierarchy competition between charts and tables,  
So that I can diagnose concept gaps in seconds.

**Why this priority**: High-stakes exam preparation requires rapid diagnosis. Dense tables with redundant headers slow down learning cycles.

**Independent Test**: Inspect `/analytics` across desktop and tablet. Verify that the Radar chart and Discipline Breakdown share a coherent visual grid, with technical terms simplified and auxiliary stats tucked behind progressive hover or expand controls.

**Acceptance Scenarios**:
1. **Given** student test attempts across multiple disciplines, **When** viewing the 7 disciplines matrix, **Then** each discipline displays its score, status pill (`Strong`, `Calibrated`, `Needs Focus`), and direct "Practice" launch action in a unified row.
2. **Given** empty discipline data, **When** uncalibrated, **Then** an elegant single-line empty state is shown rather than empty charts with zeroed axes.

---

### User Story 4 — Simplified Application Pipeline & Outcome Intelligence (Priority: P4)
As a candidate managing campus job offers and interview stages on `/applications` and `/outcomes`,  
I want a Kanban pipeline and offer evaluator with clear visual hierarchy, legible typography, and consolidated action menus,  
So that my active job applications are easy to organize without clutter.

**Why this priority**: Stressful interview cycles require calm, distraction-free organizational tools.

**Independent Test**: Create 3 mock applications in `/applications`. Verify that cards display Company, Role, Stage, and Next Date without secondary filler text, and offer breakdown cards on `/outcomes` show CTC and Base prominently with breakdown details in an expandable drawer.

---

## 3. Edge Cases & Boundary Conditions

| Scenario | Risk | Mitigation / Expected Behavior |
|---|---|---|
| **Uncalibrated Student Account** | Cluttered empty states showing multiple `--%` cards and "No data available" boxes. | Render a single, welcoming "Get Calibrated" hero banner with a direct link to the diagnostic exam. Suppress secondary empty metric cards until baseline completion. |
| **High Suggestion Volume on Resume (20+ items)** | Endless page scroll and browser slowdown. | Paginate or progressively disclose suggestions in batches of 5, grouping by section (Skills, Experience, Format). |
| **Mobile Breakpoints (<640px)** | Multicolumn metric grids squishing numbers and truncating labels. | Stack metrics into clean 2x2 grids or compact vertical rows with consistent padding. |
| **Candidate with 30+ Job Applications** | Kanban columns overflowing vertically and obscuring stage summaries. | Keep stage headers sticky with item counts, using virtualized or compact cards with truncated notes. |

---

## 4. Functional Requirements

### Visual Hierarchy & Layout Polish
- **FR-001**: Page headers across all protected routes **MUST** use a maximum of two visual levels: Page Title (`h1`, 24px–28px font-display) and an optional concise one-sentence description. Redundant eyebrow chips (e.g. `SYSTEM // 2.0`, `SECURE CANDIDATE PORTAL`) must be eliminated.
- **FR-002**: Card nesting depth **MUST NOT** exceed one level. Outer wrapper cards containing multiple internal cards must be replaced with flat divider lines (`border-t border-circuit-border`) or unified tables.
- **FR-003**: The Performance Dimensions section on `/profile` and `/dashboard` **MUST** be consolidated into a unified horizontal metric ribbon or single compact grid, replacing four oversized cards.
- **FR-004**: Primary action buttons (e.g., `Start Diagnostic`, `Upload Resume`, `Log Application`) **MUST** be visually prominent with high-contrast white styling (`bg-white text-black font-semibold rounded-full`), while secondary actions use subtle ghost or zinc borders.

### Information Density & Progressive Disclosure
- **FR-005**: High-density screens (`/resume`, `/analytics`, `/admin/analytics`) **MUST** implement progressive disclosure: high-level summaries and primary findings shown by default; secondary details, raw JSON dumps, and exhaustive breakdowns placed in collapsible disclosure panels (`<details>` or animated accordions).
- **FR-006**: Repetitive explanatory paragraphs describing what a feature does on every visit **MUST** be removed or condensed into subtle tooltip icons (`?` or `info` icon) to respect candidate time.
- **FR-007**: Empty states across all tables and cards **MUST** be compact and actionable: a one-line explanation and a single clear action button (e.g., "No applications logged yet. [Add Application]").

### Terminology Simplification
- **FR-008**: Replace internal phase numbering and complex engineering jargon in candidate-facing screens with natural, outcome-driven labels:
  - `Placement Readiness Simulation Engine` → `Interview Simulation`
  - `ATS Resume Intelligence Dossier` → `Resume Scanner & Builder`
  - `Deterministic Competency Radar` → `Skill Strengths & Vulnerabilities`
  - `Placement Execution OS Agenda` → `Daily Study Plan`
  - `Outcome Intelligence & Compensation Analysis` → `Job Offers & Decisions`

### Preservation & Zero Regression Invariants
- **FR-009**: All existing business logic in `frontend/src/server/` **MUST** remain untouched.
- **FR-010**: All calculation algorithms (Readiness formula, ATS matching, grading penalties, next best action) **MUST** produce identical numerical outputs.
- **FR-011**: All database schemas, tables, and migrations **MUST NOT** be modified.
- **FR-012**: Strict authentication and tenant isolation checks **MUST** remain active on all routes.

---

## 5. Non-Goals

1. **No Backend API or Route Changes**: No endpoints will be renamed, modified, or removed.
2. **No Data Model Alterations**: No PostgreSQL schema changes or migration files.
3. **No Feature Deprecation**: No placement preparation capabilities, analytics dimensions, or simulation rounds will be deleted.
4. **No Color Palette Inversion**: The core dark-first, technical monochrome aesthetic (`#000000`, zinc hairlines, crisp white accents) remains strictly intact.

---

## 6. Success Metrics & Verification Gate

| Metric | Target |
|---|---|
| **Visual Vertical Footprint** | Above-the-fold content increased by ≥ 35% on standard 1080p display |
| **Card Reduction** | Total nested `<Card>` wrapper instances reduced by ≥ 30% across key pages |
| **Header Cleanliness** | 100% of candidate pages limited to single `h1` + clean subtitle; 0 filler eyebrow tags |
| **TypeScript Compilation** | 0 errors (`npx tsc --noEmit`) |
| **Automated Test Regressions** | 100% of tests in `src/test/` passing with zero assertion failures |
| **Responsive Verification** | 0 horizontal scroll bugs across 375px, 768px, 1024px, and 1440px viewports |
