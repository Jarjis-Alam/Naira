# Implementation Plan: NAIRA Product-Wide Information Density and UI Hierarchy Polish

**Branch**: `001-ui-hierarchy-polish`  
**Date**: 2026-10-04  
**Spec**: [Feature Specification](file:///Users/munshijarjisalam/Documents/Projects/nexora/specs/001-ui-hierarchy-polish/spec.md)  
**Status**: Ready for User Review (Implementation On Hold as Requested)  

---

## 1. Summary & Technical Approach

This plan details the technical execution for **"NAIRA Product-Wide Information Density and UI Hierarchy Polish"**. Guided by the core directive **"LESS UI, MORE SIGNAL"**, we address layout congestion, filler typography, and nested card structures across NAIRA's key student surfaces (`/dashboard`, `/profile`, `/resume`, `/analytics`, `/applications`, and `/outcomes`).

### Technical Strategy
1. **Zero Logic Mutation**: All changes are strictly confined to the presentation layer (`src/app/(protected)/*` and `src/components/*`). Server-side services (`src/server/*`), database schemas (`src/db/*`), and calculations remain 100% bit-for-bit unchanged.
2. **Component Simplification**:
   - Replace heavy multi-layered `<MetricCardV2>` and `<Card>` wrappers with a lightweight, high-contrast `<MetricRibbon>` or compact grid.
   - Standardize page headers with a clean two-tier hierarchy (Title + optional single-line subtitle).
   - Eliminate redundant eyebrow labels (`EXECUTIVE OVERVIEW`, `SYSTEM // 2.0`, `VERIFIED CANDIDATE`).
3. **Progressive Disclosure**:
   - High-density modules (ATS Resume taxonomy matches, detailed interview evaluations, deep outcome breakdowns) will render executive highlights by default, placing exhaustive item lists behind accessible collapsible disclosure controls.
4. **Preserve Technical Monochrome Brand**:
   - Maintain obsidian canvas (`#000000`), zinc hairlines (`#27272a`), and crisp white focal points (`#ffffff`). No introducing arbitrary colors or gradients.

---

## 2. Technical Context

| Attribute | Specification |
|---|---|
| **Framework** | Next.js 16.3.5 (App Router, Server Components + Client Primitives) |
| **Language** | TypeScript 5.x (Strict Mode) |
| **Styling** | Tailwind CSS v4 + CSS Custom Properties (`globals.css`) |
| **Component Primitives** | Custom React 19 UI Primitives (`components/ui/*`), Lucide React icons |
| **Database & Schema** | PostgreSQL 16+ via Drizzle ORM (Zero schema or migration changes) |
| **Authentication** | Auth.js (NextAuth v5 beta) — Server-side `auth()` session validation |
| **Target Viewports** | Mobile (375px+), Tablet (768px+), Laptop (1024px+), Desktop (1440px+) |

---

## 3. Constitution Compliance Check

*GATE: Must pass all 10 NAIRA Constitution Principles before any code implementation.*

| # | Constitution Principle | Status | Compliance Verification |
|---|---|---|---|
| **I** | **Preserve Existing Architecture** | **PASS** | Keeps existing Next.js 16 + React 19 + TypeScript architecture intact. No new frameworks or architectural shifts. |
| **II** | **Database Safety** | **PASS** | Zero database modifications. No schema changes, no migrations generated, no `db:push` run. |
| **III** | **Auth & Tenant Isolation** | **PASS** | Session derivation via `auth()` in page loaders and Server Actions is preserved without alteration. |
| **IV** | **No Fabricated Data** | **PASS** | Empty states remain honest, clean, and uncalibrated when data is absent. Zero vanity progress bars or synthesized metrics. |
| **V** | **Deterministic Source of Truth** | **PASS** | All scores (Readiness, ATS score, Grading, Next Best Action) remain calculated by deterministic server engines. |
| **VI** | **Groq Security & Provider Decoupling** | **PASS** | No changes to AI provider architecture or `GROQ_API_KEY` handling. |
| **VII** | **UI Consistency** | **PASS** | Reinforces the pure technical monochrome visual identity (dark-first, zinc hairlines, crisp white highlights, restrained typography). |
| **VIII** | **UX Over Complexity** | **PASS** | Directly implements this principle by pruning redundant headings, filler chips, and multi-layered cards. |
| **IX** | **Test Before Release** | **PASS** | Verifies strict TypeScript compilation (`tsc --noEmit`), schema parity, and automated regression test suites. |
| **X** | **Small, Reviewable Changes** | **PASS** | Organized into focused page-by-page refactoring phases with zero cross-system side effects. |

---

## 4. Page-by-Page Polish Scope & Component Architecture

### Phase 1 — Dashboard & Profile Performance Dimensions (`/dashboard`, `/profile`)
- **Problem**: 
  - `/profile` has a large hero card with 4 redundant status chips, followed by four independent large `<MetricCardV2>` components with duplicate progress bars and helper text.
  - `/dashboard` has multiple stacked banner containers and nested cards.
- **Solution**:
  - Replace four standalone cards with a consolidated 4-metric strip (`<CompactPerformanceStrip>`):
    `[ Preparation: 82% ]  [ Target Fit: 74% ]  [ Resume ATS: 88% ]  [ Interview: -- ]`
  - Strip redundant badges (`"Active Cycle"`, `"Verified"`, `"CS CORE"` when already shown in details).
  - Clarify primary action on dashboard: "Continue Diagnostic Test" or "Next Best Action" as a high-contrast pill button.

### Phase 2 — ATS Resume Intelligence Workspace (`/resume`)
- **Problem**: 
  - `ResumeDossierView` displays heavy accordion panels with 12 sections expanded by default, cluttered with tags and disclaimers.
- **Solution**:
  - Introduce clean tabbed or progressive view:
    - **Tab 1: ATS Findings & Score** (Executive ATS breakdown + Top 3 High-Impact Suggestions).
    - **Tab 2: Keyword & Skill Match** (Grouped into Matched vs Missing as compact pill chips).
    - **Tab 3: Document Content & Editor** (Clean preview with side-by-side diff acceptance).
  - Simplify suggestion cards: display the exact bullet diff with a clean `[Accept] / [Dismiss]` control, removing duplicate severity tags.

### Phase 3 — Placement Analytics & Practice Hub (`/analytics`, `/practice`)
- **Problem**:
  - `/analytics` contains stacked informative callouts, dense tables with redundant subheadings, and competing visual weights between charts and text.
- **Solution**:
  - Combine radar visualization and discipline cards into a unified 2-column layout.
  - Clean up the 7 Core Disciplines table: Title, Mastery Pill, Accuracy %, and a clean "Practice" link. Remove verbose explanatory subheads.
  - Compact empty states for uncalibrated disciplines.

### Phase 4 — Applications Pipeline & Outcome Workspace (`/applications`, `/outcomes`)
- **Problem**:
  - Kanban board cards contain repetitive text labels and excessive container padding.
  - `/outcomes` has multi-layered cards for CTC breakdown.
- **Solution**:
  - Streamline Kanban cards: Company, Role, Status Pill, Next Event Date in a minimalist compact card.
  - Clean offer analyzer: Large prominent CTC figure at top, with Base/Bonus/Equity cleanly itemized in a single borderless breakdown table.

---

## 5. File Modifications Plan (Presentation Layer Only)

```text
frontend/src/
├── app/(protected)/
│   ├── dashboard/page.tsx               # Streamline top section, consolidate metrics
│   ├── profile/page.tsx                 # Replace 4-card metric block with compact performance strip
│   ├── resume/page.tsx                  # Clean dossier container wrapper
│   ├── analytics/page.tsx               # Streamline 7-discipline matrix layout
│   ├── applications/page.tsx            # Clean Kanban header and action toolbar
│   └── outcomes/page.tsx                # Simplify offer breakdown containers
└── components/
    ├── ui/
    │   ├── metric-card-v2.tsx           # Refactor into compact, low-noise variant
    │   └── compact-performance-strip.tsx# (New) Reusable high-density 4-metric strip
    ├── resume/
    │   ├── resume-dossier-view.tsx      # Progressive disclosure tabs & clean diff cards
    │   └── suggestions-panel.tsx        # Compact suggestion rows with inline actions
    └── applications/
        └── applications-new-dialog.tsx  # Simplified form fields and clear primary CTA
```

*Note: No files in `src/server/`, `src/db/`, or `src/lib/` are altered.*

---

## 6. Verification & Quality Assurance Strategy

1. **Static Type Safety**:
   ```bash
   cd frontend && npx tsc --noEmit
   ```
2. **Schema Integrity Pre-Check**:
   ```bash
   cd frontend && npm run verify:schema
   ```
3. **Automated Regression Test Suite**:
   ```bash
   npx tsx src/test/phase-14-placement-intelligence.ts
   npx tsx src/test/phase-15-placement-execution.ts
   npx tsx src/test/phase-16-placement-target-strategy.ts
   npx tsx src/test/phase-17-placement-readiness-simulation.ts
   npx tsx src/test/phase-18-ats-resume-intelligence.ts
   npx tsx src/test/phase-19-applications.ts
   npx tsx src/test/phase-20-placement-outcome-intelligence.ts
   npx tsx src/test/phase-26-ai-interview-coach.ts
   npx tsx src/test/security-audit.ts
   npx tsx src/test/ui-responsive-qa.ts
   ```
4. **Visual & Responsive QA**:
   - Validate desktop (1440px), laptop (1024px), tablet (768px), and mobile (375px).
   - Ensure zero horizontal scrolling or broken line-wrapping.
   - Confirm dark-first monochrome visual hierarchy is crisp, premium, and calm.

---

## 7. Review Gate & Execution Handoff

> **IMPORTANT**: As instructed by the user prompt, **implementation is paused here**.  
> The feature specification (`spec.md`) and implementation plan (`plan.md`) are complete and ready for human review before any code is written.
