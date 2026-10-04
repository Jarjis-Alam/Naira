# NAIRA — Current System Baseline & Architecture Reference

> **Document Status**: Authoritative Baseline  
> **Repository**: [Jarjis-Alam/Naira](https://github.com/Jarjis-Alam/Naira)  
> **Source Directory**: `frontend/` (Next.js Application Root) & Repository Root  
> **Ratified Date**: 2026-10-04  

This document captures the real, verified technical baseline of **NAIRA (Nexora / Placement OS)** as it exists in the brownfield codebase. It serves as the primary architectural reference for all Spec Kit specifications, plans, and implementations.

---

## 1. Application Architecture

NAIRA is a full-stack, enterprise-grade Placement Operating System engineered for engineering students, university placement cells, and career coaches.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CLIENT (React 19 / Next.js 16)                   │
│  - App Router: (public) Landing & Auth, (protected) Dashboard, Tests,       │
│    Roadmap, Target, Simulation, Resume, Applications, Outcomes, Admin       │
│  - State: React 19 Concurrent Primitives, React Query, Local UI State       │
│  - Styling: Pure Technical Monochrome (Void Black, Zinc Hairlines, White)   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTPS / HTTP-only Cookies
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SECURITY & MIDDLEWARE LAYER                              │
│  - Auth.js (NextAuth v5 beta) JWT Sessions via HTTP-only Cookies            │
│  - Next.js Proxy & Strict Content Security Policy (CSP) Headers             │
│  - Server-side Session Verification (`auth()`) on every protected route      │
│  - Role-Based Access Control (RBAC): `STUDENT` vs `ADMIN`                   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CORE SERVER SERVICE LAYER (`src/server/`)                │
│  - Diagnostic & Exam State Machine (`tests.ts`, `grading.ts`)               │
│  - Placement Readiness & Disciplines (`readiness.ts`, `analytics.ts`)       │
│  - Execution OS & Roadmap (`placement-execution.ts`, `roadmap.ts`)          │
│  - Hiring Simulation Engine (`placement-simulation.ts`)                     │
│  - ATS Resume Intelligence (`resume-intelligence.ts`, `lib/resume/`)        │
│  - Application Pipeline (`application-intelligence.ts`)                     │
│  - Outcome & Offer Intelligence (`outcome-intelligence.ts`)                 │
│  - Adaptive Study Planner (`adaptive-study-planner.ts`)                     │
│  - Practice & Question Engine (`practice-question-intelligence.ts`)         │
│  - AI Interview Coach (`interview-coach.ts` + `ai/provider.ts`)             │
└───────────────────┬─────────────────────────────────────┬───────────────────┘
                    │                                     │
                    ▼                                     ▼
┌──────────────────────────────────────┐  ┌───────────────────────────────────┐
│     PERSISTENCE LAYER (Postgres 16)  │  │        AI PROVIDER LAYER          │
│  - Drizzle ORM 0.45.2                │  │  - `AIProvider` Interface         │
│  - 36 Normalized Relational Tables   │  │  - `GroqProvider` (Server-Only)   │
│  - 20 Applied SQL Migrations         │  │  - Model: llama-3.3-70b-versatile │
│  - Snapshot Hardening for Attempts   │  │  - `MockAIProvider` for CI / Test │
└──────────────────────────────────────┘  └───────────────────────────────────┘
```

### Architectural Tenets
1. **Server-Side Determinism**: All calculations for student performance, accuracy, penalties, ATS scoring, and interview evaluations are computed server-side with deterministic algorithms.
2. **Zero Fabrication Principle**: If data does not exist, the system presents an honest empty state ("Not measured", "Not provided", "Uncalibrated"). No vanity numbers or synthetic metrics.
3. **Decoupled AI Layer**: Groq AI is strictly an interactive and conversational augmentation layer. The core platform remains 100% operational if AI services are disabled or offline.

---

## 2. Frontend Structure

The frontend is contained entirely in `frontend/` and follows Next.js App Router conventions:

```
frontend/src/
├── app/
│   ├── (public)/                     # Unauthenticated routes (Landing, Auth)
│   │   ├── page.tsx                  # Cinematic landing page
│   │   └── auth/                     # Sign In & Registration pages
│   ├── (protected)/                  # Authenticated routes (wrapped in SessionProvider & Sidebar)
│   │   ├── layout.tsx                # Master dashboard shell with Sidebar & top navigation
│   │   ├── dashboard/page.tsx        # Executive Placement OS dashboard
│   │   ├── tests/                    # Diagnostic tests catalog, test player, result breakdown
│   │   ├── assessment/page.tsx       # Live assessment view
│   │   ├── analytics/page.tsx        # Competency radar & 7 disciplines matrix
│   │   ├── profile/page.tsx          # Academic profile & target configuration
│   │   ├── roadmap/page.tsx          # Engineering placement preparation roadmap
│   │   ├── target/page.tsx           # Company & career role target explorer
│   │   ├── simulation/               # Placement Readiness Mock Hiring loops
│   │   ├── resume/                   # ATS Resume Builder, JD matcher, suggestions
│   │   ├── applications/             # Kanban application pipeline & interview calendar
│   │   ├── outcomes/page.tsx         # Offer analyzer, CTC breakdown, rejection diagnostics
│   │   ├── planner/page.tsx          # Adaptive Study Planner agenda & milestones
│   │   ├── practice/page.tsx         # Question Bank practice launcher & topic drilldown
│   │   ├── interview/page.tsx        # AI Interview Coach interactive conversational session
│   │   └── admin/                    # Placement cell administration
│   │       ├── analytics/            # Cohort performance, item discrimination index
│   │       ├── questions/            # Question bank authoring & topic tagging
│   │       ├── tests/                # Test Builder, sections, scheduling, question pools
│   │       ├── companies/            # Canonical target company management
│   │       └── roles/                # Standard role definitions & competency requirements
│   ├── api/                          # REST API route handlers
│   ├── globals.css                   # Technical Monochrome Design System tokens & utilities
│   ├── layout.tsx                    # Root HTML layout with Google & local font imports
│   ├── error.tsx & not-found.tsx     # Global error boundaries
├── components/                       # Modular UI components
│   ├── ui/                           # Core primitives (Button, Pill, Modal, Card, ProfileCard)
│   ├── layout/                       # Responsive Sidebar, TopNav, NavItem
│   ├── landing/                      # Cinematic hero, feature showcases
│   ├── assessment/                   # Exam engine, question palette, review tables
│   ├── analytics/                    # Competency radars, discipline breakdowns
│   ├── simulation/                   # Multi-round simulation runner & debrief cards
│   ├── resume/                       # ATS score cards, keyword matches, suggestions panel
│   ├── applications/                 # Kanban boards, event logs, offer dialogs
│   ├── planner/                      # Study calendar, milestone cards, daily tasks
│   ├── practice/                     # Practice session launcher, topic filters
│   ├── interview/                    # Interactive chat interface, turn bubble, rubric card
│   └── admin/                        # Admin tables, forms, filters, test builder
```

---

## 3. Backend & Service Layer

All server-side business logic resides in `frontend/src/server/`:

| Module | Responsibilities |
|---|---|
| `actions.ts` | Next.js Server Actions for test submissions, profile updates, and form handlers |
| `tests.ts` | Test authoring, publishing lifecycle (`draft` → `scheduled` → `published` → `closed` → `archived`), attempt creation, and snapshot generation |
| `grading.ts` | Server-evaluated grading, configurable negative marking (`-0.25`, `-0.33`, `-0.50`), and score verification |
| `readiness.ts` | Multi-dimensional placement readiness calculation across 7 core disciplines |
| `student-intelligence.ts` | Next Best Action engine, topic vulnerability identification, diagnostic radar generation |
| `placement-execution.ts` | Daily execution agenda, task tracking, and milestone checkmarks |
| `roadmap.ts` | Syllabus progression tracker across foundational, intermediate, and advanced engineering topics |
| `company-role-intelligence.ts`| Company tier classification (Tier 1 FAANG, Tier 2 Unicorns, Product, Startups) and role skill mapping |
| `placement-target-strategy.ts`| Primary and secondary role alignment, target company prioritization |
| `placement-simulation.ts` | 4-round mock hiring cycle controller (OA → Tech Screen → System Design → HR) with dynamic difficulty |
| `resume-intelligence.ts` | PDF/DOCX text parsing, skill taxonomy extraction (60+ competencies), ATS score calculation, JD keyword matching, and truth-verified suggestion diffs |
| `application-intelligence.ts` | Job application stage tracking (`Wishlist` through `Offer`/`Rejected`), interview calendar, and post-interview reflection logs |
| `outcome-intelligence.ts` | Offer package analyzer (CTC, Base, Bonus, RSUs), decision logs, and rejection post-mortem diagnostics |
| `placement-intelligence-2.ts`| Advanced multi-variable cohort intelligence and performance velocity tracking |
| `adaptive-study-planner.ts` | Personalized dynamic study schedules, target milestones, and spaced repetition |
| `practice-question-intelligence.ts` | Dynamic pool question sampling, difficulty calibration, and untimed practice drills |
| `interview-coach.ts` | Conversational interview state machine, turn orchestration, and multi-rubric evaluation |
| `admin-analytics.ts` | Live candidate monitoring drawer, Question Discrimination Index, and cohort comparison |

---

## 4. Persistence Layer (PostgreSQL & Drizzle ORM)

### Database Infrastructure
- **Engine**: PostgreSQL 16+
- **ORM**: Drizzle ORM `0.45.2` with `drizzle-kit 0.31.10`
- **Schema Location**: `frontend/src/db/schema.ts`
- **Migrations Directory**: `frontend/src/db/migrations/`
- **Connection Management**: `frontend/src/db/index.ts` (connection pooling with fail-fast validation)
- **Bootstrap & Seeding**: `frontend/src/db/bootstrap.ts` (idempotent reference data) and `seed.ts` (development fixtures)

### Migrations Inventory (20 Versioned Migrations)
1. `0000_violet_kid_colt.sql` — Base schema (users, profiles, subjects, topics, questions, tests, attempts, answers)
2. `0001_phase_6c_test_sections.sql` — Test sections with independent time limits
3. `0002_phase_7a_negative_marking.sql` — Negative marking rates per test and section
4. `0003_phase_7b_question_randomization.sql` — Question shuffling per attempt
5. `0004_phase_7c_option_randomization.sql` — Option shuffling per attempt
6. `0005_phase_7c1_question_snapshot_hardening.sql` — Question snapshot freezing at attempt creation
7. `0006_phase_7d_attempt_limits.sql` — Maximum attempt constraints
8. `0007_phase_7e_test_instructions.sql` — Rich test instruction modals
9. `0008_phase_7f_question_pools.sql` — Dynamic question pools with weighted sampling
10. `0009_phase_8_test_lifecycle_scheduling.sql` — Test status state machine and windowed scheduling
11. `0010_phase_9_admin_analytics_indexes.sql` — High-performance indexes for cohort queries
12. `0011_phase_11a_company_role_intelligence.sql` — Canonical companies, roles, and candidate targets
13. `0012_phase_11b_multiple_target_roles.sql` — Multiple career track configurations
14. `0013_phase_18_resume_intelligence.sql` — Resume files, variants, analyses, suggestions, and versions
15. `0014_resume_upload_retry_fix.sql` — Idempotent resume hash retry and deduplication
16. `0015_phase_19_applications.sql` — Job applications, stage history, interviews, and reflections
17. `0016_phase_20_outcome_intelligence.sql` — Offer breakdowns, decision states, and rejection root-causes
18. `0017_phase_17_simulation_schema.sql` — Multi-round hiring simulation sessions and round logs
19. `0018_phase_24_adaptive_study_planner.sql` — Dynamic study plans, milestones, and priority tasks
20. `0019_phase_26_ai_interview_coach.sql` — Interview sessions, dialogue turns, and multi-rubric evaluations

---

## 5. Authentication & Tenant Isolation

- **Framework**: Auth.js (`next-auth@5.0.0-beta.32`)
- **Strategy**: JWT session tokens stored in secure, `HttpOnly`, `SameSite=Lax` cookies
- **Password Security**: `bcryptjs` with salt rounds
- **Tenant Isolation Enforcement**:
  - Identity is derived strictly from `await auth()` on the server.
  - Client-submitted `userId` in request bodies or query parameters is **strictly prohibited**.
  - All database queries filter by `where(eq(table.userId, session.user.id))`.
  - Admin endpoints verify `session.user.role === 'ADMIN'`.

---

## 6. AI & Groq Integration Architecture

AI features reside in `frontend/src/server/ai/` and adhere to strict security invariants:

```typescript
// AIProvider Contract (src/server/ai/provider.ts)
export interface AIProvider {
  readonly name: string;
  generateResponse(messages: AIMessage[], options?: { jsonMode?: boolean }): Promise<string>;
  generateInterviewTurn(messages: AIMessage[]): Promise<InterviewAIResponse>;
  evaluateInterview(
    contextSummary: string,
    transcript: { role: string; content: string }[]
  ): Promise<InterviewEvaluationOutput>;
}
```

### Implementations:
- **`GroqProvider`** (`groq-provider.ts`): Uses official `groq-sdk`. Reads `GROQ_API_KEY` exclusively on the server. Defaults to `llama-3.3-70b-versatile`.
- **`MockAIProvider`** (`mock-provider.ts`): Deterministic in-memory implementation for CI/CD, offline execution, and unit tests.
- **Provider Resolution** (`index.ts`): `getAIProvider()` returns `GroqProvider` if `GROQ_API_KEY` is present; otherwise falls back gracefully to `MockAIProvider` without breaking application flows.

### Security Invariants:
- `GROQ_API_KEY` is never exposed to the client or browser bundle.
- LLM outputs are never treated as the authoritative source of truth for scores, rankings, or eligibility.
- Prompts enforce strict grounding in verified student records to prevent hallucination.

---

## 7. Design System & Visual Identity

NAIRA follows a pure **Technical Monochrome** design system defined in `frontend/src/app/globals.css` and inspired by the `2.0 ui/` and `new_ui/` token catalogs:

- **Canvas**: Pure Obsidian (`--color-void-black`: `#000000`)
- **Surfaces**: Ground Iron (`#121215`), Carbon Veil (`#1c1c21`)
- **Borders & Dividers**: Circuit Border (`#27272a`), Pine 15 (`#3f3f46`)
- **Text & Foreground**: Phosphor White (`#ffffff`), Mint Frost (`#f4f4f5`), Sage 60 (`#a1a1aa`), Deep Fern (`#71717a`)
- **Accent Philosophy**: Pure monochrome contrast gradations. White highlights (`#ffffff`) indicate active focus, selected states, and key actions. Zero chromatic color bleeding.
- **Typography**: Display/Headings in Space Grotesk / Mileast; UI chrome and data tables in Inter Variable; Code snippets in JetBrains Mono.
- **Components**: Pill-based filters and status badges, borderless panels with hairline borders, and progressive disclosure rather than endless cards.

---

## 8. Verification & Testing Strategy

The repository includes a comprehensive, multi-phase verification suite located in `frontend/src/test/`:

- **Static Analysis**: TypeScript strict compilation (`npx tsc --noEmit`)
- **Schema Parity**: `scripts/verify-schema.mjs` and `migration-schema-parity.ts` (asserts Drizzle schema matches migration SQLs)
- **Phase Test Suites** (run via `npx tsx src/test/<phase-test>.ts`):
  - `phase-11a-company-role-intelligence.ts`
  - `phase-11b-student-targeting-audit.ts`
  - `phase-12-placement-roadmap.ts`
  - `phase-13-visual-dom-verification.ts`
  - `phase-14-placement-intelligence.ts`
  - `phase-15-placement-execution.ts` & `phase-15-admin-builder.ts`
  - `phase-16-placement-target-strategy.ts`
  - `phase-17-placement-readiness-simulation.ts`
  - `phase-18-ats-resume-intelligence.ts` & `phase-18-pdf-extraction-http.ts`
  - `phase-19-applications.ts` & `phase-19-applications-http.ts`
  - `phase-20-placement-outcome-intelligence.ts`
  - `phase-21-audit-reliability-hardening.ts`
  - `phase-23-placement-intelligence-2.ts`
  - `phase-24-adaptive-study-planner.ts`
  - `phase-25-practice-question-intelligence.ts`
  - `phase-26-ai-interview-coach.ts`
  - `security-audit.ts` & `security-regression.ts`
  - `core-student-flow-qa.ts`, `advanced-features-qa.ts`, `ui-responsive-qa.ts`

---

## 9. Production Deployment & Operations

- **Hosting**: Vercel (Next.js Edge and Serverless execution)
- **Database Provisioning**: PostgreSQL managed instance
- **Migration Deployment Protocol**:
  - Versioned migration scripts are applied individually using `PRODUCTION-MIGRATION-RUNBOOK.md`.
  - Schema verification is pre-validated with `production-migration-check.sql`.
  - `npm run verify:schema` runs during `prebuild` to block builds if schema and migrations drift.
  - `npm run db:push` is **strictly forbidden** in production.
