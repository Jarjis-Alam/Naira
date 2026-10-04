<!--
Sync Impact Report:
- Version change: Initial Draft -> 1.0.0
- Added sections: Core Principles (Principles 1 through 10), Architecture & Technology Constraints, Verification & Release Quality Gates, Governance
- Modified principles: N/A (initial project ratification)
- Removed sections: N/A
- Follow-up TODOs: None. All 10 NAIRA core principles explicitly codified.
-->

# NAIRA Constitution

## Core Principles

### I. Preserve the Existing Architecture
NAIRA uses its existing Next.js + TypeScript architecture. Do not rewrite the application in another language or framework without an explicit architectural decision. Spec Kit and any future workflows must operate alongside the existing repository without scaffolding duplicate apps or replacing established structural boundaries.

### II. Database Safety
PostgreSQL is the source of persistent application data. Production schema changes **MUST** use versioned migrations generated and tracked via Drizzle (`src/db/migrations/`).
- **NEVER** use `drizzle-kit push` (`npm run db:push`) against production environments.
- Never make destructive database changes (dropping tables/columns, truncating, altering types in place) without explicit approval and an accompanying verified rollback/forward runbook.
- Schema verification (`npm run verify:schema`) must pass before any release or build.

### III. Authentication & Tenant Isolation
Every protected resource **MUST** derive identity strictly from the authenticated server session (`auth()`).
- Never trust a client-provided user ID or query parameter for authorization.
- Students must never access another student's:
  - assessments
  - attempts
  - intelligence
  - plans
  - simulations
  - resumes & uploaded files
  - applications
  - outcomes
  - interview sessions
  - interview evaluations
- Authorization checks must be strictly enforced and tested for both read and write operations across all route handlers and server actions.

### IV. No Fabricated Data
NAIRA must never invent:
- student performance
- scores
- evidence
- company requirements
- resume facts
- interview results
- analytics
- placement outcomes
Empty data must produce honest, explicit empty states. Missing evidence must remain recorded as missing evidence ("Not detected" / "Not provided" / "Not measured"). Never use vanity progress bars or placeholder metrics.

### V. Deterministic Source of Truth
Business-critical calculations remain deterministic and evidence-driven. Large Language Models (LLMs) must **NOT** become the source of truth for:
- readiness scores
- eligibility
- company targeting
- ATS factual detection
- question selection
- study planning
- outcome diagnosis
- placement predictions
AI may explain, tutor, converse, and coach around deterministic system outputs, but it must never synthesize core metrics or override deterministic scoring models.

### VI. Groq Security & AI Provider Decoupling
Groq is accessed exclusively from trusted server-side code.
- `GROQ_API_KEY` must remain server-side:
  - never use `NEXT_PUBLIC_`
  - never appear in client bundles
  - never be returned through APIs
  - never be logged
  - never be stored in the database
  - never be committed to Git
- AI features must remain decoupled behind the `AIProvider` interface abstraction (`src/server/ai/provider.ts`), with `MockAIProvider` available for offline environments and CI test suites. The platform must remain 100% resilient and operable if the AI provider is unavailable.

### VII. UI Consistency
NAIRA's approved visual identity must be preserved across all screens:
- dark-first
- monochrome (pure obsidian `#000000`, zinc hairlines, crisp white accents)
- premium
- technical
- restrained
- pill-based where appropriate
- strong typography (Inter Variable & Space Grotesk / display faces)
- minimal visual noise
Do not turn every piece of information into a card. Do not add filler headings. Do not add unnecessary metrics. Prioritize clear hierarchy and progressive disclosure.

### VIII. UX Over Complexity
Every UI element should help the user:
- understand something
- make a decision
- take an action
- understand state or progress
Remove unnecessary visual and textual complexity. Eliminate redundant eyebrow tags, repetitive helper descriptions, and congested multi-layer containers.

### IX. Test Before Release
Every implementation must preserve:
- TypeScript correctness (`npx tsc --noEmit`)
- schema parity and migration audit integrity
- regression tests across all historical phases (Phases 14–26)
- strict session authorization
- responsive behavior across desktop, tablet, and mobile breakpoints
- clean production build (`npm run build`)
A feature is not complete merely because the code compiles.

### X. Small, Reviewable Changes
Prefer focused, incremental changes over large rewrites.
- Do not modify unrelated systems while implementing a feature.
- Do not silently change business behavior during UI work.
- Maintain documentation integrity and record explicit implementation reports for major functional phases.

## Architecture & Technology Constraints
- **Framework**: Next.js 16 (App Router) + React 19
- **Language**: TypeScript 5.x in strict mode
- **Styling**: Tailwind CSS v4 + Vanilla CSS custom properties (`globals.css`) adhering to the technical monochrome design system
- **Database & Persistence**: PostgreSQL 16+ via Drizzle ORM (36+ normalized tables, versioned SQL migrations in `src/db/migrations/`)
- **Authentication**: Auth.js (NextAuth v5 beta) with secure HTTP-only cookies and JWT sessions
- **Validation**: Zod for contract verification across API routes and forms
- **AI Integration**: Groq SDK wrapped inside server-side provider abstraction (`AIProvider`)

## Development Workflow & Quality Gates
Future development in NAIRA adheres to the Spec Kit Spec-Driven Development (SDD) lifecycle:
1. **Constitution** (`/speckit-constitution`): Enforce permanent platform rules and boundaries.
2. **Specify** (`/speckit-specify`): Define requirements, user scenarios, and non-goals with zero assumptions.
3. **Plan** (`/speckit-plan`): Establish technical architecture, schema decisions, and security review.
4. **Tasks** (`/speckit-tasks`): Generate discrete, dependency-ordered, testable implementation units.
5. **Implement** (`/speckit-implement`): Execute tasks incrementally with regression test verification.
6. **Converge** (`/speckit-converge`): Verify full system behavior, assess residual gaps, and finalize tests.

## Governance
This Constitution supersedes all informal practices and serves as the highest architectural authority for NAIRA.
- All Pull Requests, agent prompts, and feature designs **MUST** verify compliance against these principles before merging.
- Any architectural change or exception to these principles requires an explicit Decision Record and formal Constitution amendment.
- Semantic Versioning:
  - **MAJOR**: Incompatible principle redefinitions or framework/persistence migrations.
  - **MINOR**: New governance rules, sections, or materially expanded principles.
  - **PATCH**: Wording improvements, clarifications, and non-semantic formatting.

**Version**: 1.0.0 | **Ratified**: 2026-10-04 | **Last Amended**: 2026-10-04
