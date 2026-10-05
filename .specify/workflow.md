# NAIRA Spec Kit Development Workflow Guide

This document defines the standard engineering workflows for **NAIRA** using **GitHub Spec Kit** and Antigravity. All future engineering, architectural additions, and bug fixes must follow these workflows.

---

## 1. Core Principles & Mindset

NAIRA is an existing brownfield project. Every workflow must respect the [NAIRA Constitution](file:///Users/munshijarjisalam/Documents/Projects/nexora/.specify/memory/constitution.md) and the established [System Baseline](file:///Users/munshijarjisalam/Documents/Projects/nexora/.specify/memory/naira-baseline.md).

- **Spec-Driven Development (SDD)**: High-impact features are specified, planned, broken into discrete tasks, implemented incrementally, and converged with test verification.
- **Scope-Appropriate Governance**: Do **NOT** force minor styling tweaks, typo corrections, or straightforward 1-line bug fixes through a massive 5-step specification cycle. Use judgment based on risk and scope.
- **Source of Truth**: The active codebase and the Constitution remain the ultimate source of truth.

---

## 2. Standard Workflows

### Flow A: New Feature (Standard SDD Flow)
Use this workflow for new capabilities, architectural changes, database schema additions, or cross-cutting user experiences.

```
/speckit-specify
       ↓
 /speckit-plan
       ↓
 /speckit-tasks
       ↓
/speckit-implement
       ↓
/speckit-converge
```

1. **`/speckit-specify <feature description>`**
   - Creates the feature specification under `specs/<NNN>-<short-name>/spec.md`.
   - Defines user scenarios, functional requirements, success criteria, and explicit non-goals.
   - *Optional helper*: `/speckit-clarify` can be run before planning to resolve ambiguities.

2. **`/speckit-plan`**
   - Generates the technical architecture plan under `specs/<NNN>-<short-name>/plan.md`.
   - Documents database migrations, API contracts, UI component hierarchy, and security checks.
   - Verifies compliance against all 10 Constitution principles.
   - *Optional helper*: `/speckit-checklist` generates verification checklists.

3. **`/speckit-tasks`**
   - Generates actionable, ordered task units under `specs/<NNN>-<short-name>/tasks.md`.
   - Groups tasks by phase (contracts → backend → UI → tests).
   - Identifies parallelizable vs sequential dependencies.
   - *Optional helper*: `/speckit-analyze` produces a consistency report across spec, plan, and tasks.

4. **`/speckit-implement`**
   - Executes implementation tasks systematically in small, reviewable increments.
   - Keeps business logic and deterministic engines isolated.
   - Runs unit tests and type checks (`npx tsc --noEmit`) along the way.

5. **`/speckit-converge`**
   - Evaluates implementation against original spec requirements.
   - Verifies schema parity, regression tests, and responsive UI.
   - Appends any remaining punchlist items as follow-up tasks until the feature is converged.

---

### Flow B: Bug Remediation (Triaged Flow)
Use this workflow for unexpected exceptions, regression defects, UI glitches, or production drift.

```
/speckit-bug-assess
       ↓
  /speckit-bug-fix
       ↓
 /speckit-bug-test
```

1. **`/speckit-bug-assess <bug report or error message>`**
   - Reproduces and isolates the issue without making code changes.
   - Identifies root cause (database schema drift, session authorization, component state, etc.).
   - Assesses blast radius and checks related test suites.

2. **`/speckit-bug-fix`**
   - Applies the minimal, targeted correction to resolve the defect.
   - Preserves unrelated systems and avoids opportunistic refactoring.

3. **`/speckit-bug-test`**
   - Runs specific regression tests and asserts that the bug is eliminated.
   - Runs `npx tsc --noEmit` and relevant phase test suites (`src/test/`).

---

### Flow C: Idea & Concept Assessment
Use this workflow when an initiative is speculative or needs technical de-risking before committing to a full specification.

1. Run an exploratory assessment using `/speckit-clarify` or interactive analysis.
2. Verify alignment with NAIRA's deterministic engine and Constitution (Principles 4 & 5).
3. If validated, transition into `/speckit-specify`. If rejected, document the rationale in `.specify/memory/` and close.

---

## 3. Scope Decision Matrix

| Scope of Change | Recommended Workflow | Artifacts Required |
|---|---|---|
| **Major Feature** (e.g. New Placement Engine, Schema Migration) | Full SDD (`/speckit-specify` → `/speckit-converge`) | `spec.md`, `plan.md`, `tasks.md`, tests |
| **Complex UI Redesign** (e.g. Product-wide density polish) | Specification + Plan (`/speckit-specify`, `/speckit-plan`) | `spec.md`, `plan.md`, `tasks.md` |
| **Critical Bug / Regression** | Bug Flow (`/speckit-bug-assess` → `/speckit-bug-test`) | Bug report notes, targeted test |
| **Minor UI Tweak / Typo** | Fast-path Direct Edit + Local Check | Direct diff + `npx tsc --noEmit` |

---

## 4. Antigravity Skill Reference

The Spec Kit workflow skills are registered in `.agents/skills/` and can be invoked directly in conversation:

- `/speckit-constitution` — Create or amend NAIRA's governing principles
- `/speckit-specify` — Initialize and draft a feature specification
- `/speckit-plan` — Generate architectural plan and component designs
- `/speckit-tasks` — Decompose the plan into dependency-ordered tasks
- `/speckit-implement` — Incrementally execute tasks
- `/speckit-converge` — Assess implementation completeness and close gaps
- `/speckit-clarify` — Resolve requirements ambiguities
- `/speckit-analyze` — Cross-artifact consistency audit
- `/speckit-checklist` — Generate quality assurance checklists
- `/speckit-bug-assess` — Triage and isolate a bug
- `/speckit-bug-fix` — Implement a minimal fix
- `/speckit-bug-test` — Verify the fix with regression tests

---

## 5. Engineering Stack Hierarchy

NAIRA integrates five complementary frameworks into a disciplined, multi-layered engineering stack:

```
NAIRA Constitution (Governing Invariants & Non-Negotiable Boundaries)
       ↓
GitHub Spec Kit (Feature Specification & Requirements Authority: specs/)
       ↓
GSD Core (Orchestration, Fresh-Context Execution, & Multi-Phase Management)
       ↓
Karpathy Guidelines (Coding Discipline: Simplicity, Surgical Changes, Think First)
       ↓
Everything Claude Code [ECC] (Engineering Capabilities: TDD, Code Review, Security, Verification)
       ↓
Implementation & Targeted Tests
       ↓
Verification
       ↓
Spec Kit Convergence
```

### Roles and Precedence Boundaries

1. **NAIRA Constitution** (`.specify/memory/constitution.md`):
   - **Precedence Level**: 1 (Supreme Authority).
   - Non-negotiable platform laws: zero unapproved DB schema mutation, strict tenant isolation, deterministic source of truth, Groq API isolation, technical monochrome aesthetics.
   - GSD Core and all other frameworks must NEVER override or bypass the Constitution.

2. **Existing Production Architecture & Security Rules** (`.specify/memory/naira-baseline.md`):
   - **Precedence Level**: 2.
   - Governs real architectural boundaries (Next.js 16, React 19, Auth.js v5 beta, Postgres 16 via Drizzle ORM, server-only Groq provider).

3. **GitHub Spec Kit** (`.specify/`, `specs/`):
   - **Precedence Level**: 3 (Feature Authority).
   - Authoritative for all feature specifications, requirements, user scenarios, and acceptance criteria (`specs/<NNN>-<short-name>/spec.md`).
   - GSD must NEVER bypass Spec Kit for substantial feature work.

4. **GSD Core** (`.agents/skills/gsd-*`, `.agents/gsd-core/`):
   - **Precedence Level**: 4 (Orchestration & Context Management).
   - Manages execution phases, wave-based parallel subagent execution, and context engineering.
   - Keeps the primary Antigravity context lean by running heavy research, planning, and task execution in isolated fresh-context subagents.
   - GSD must NEVER declare a feature complete without passing NAIRA's Spec Kit convergence and verification gates.

5. **Karpathy Guidelines** (`.agents/skills/karpathy-guidelines/`):
   - **Precedence Level**: 5 (Implementation Mindset).
   - Coding discipline: inspect before modifying, surface assumptions, simplest correct solution, surgical changes, zero drive-by refactoring.

6. **Everything Claude Code [ECC]** (`.agents/`):
   - **Precedence Level**: 6 (Engineering Capabilities).
   - Specialized capabilities deployed during implementation and verification:
     - `tdd-workflow`: Test-driven development discipline.
     - `verification-loop`: Six-phase build, lint, and regression test verification.
     - `browser-qa`: Browser-based responsive, accessibility, and visual DOM verification.
     - Specialized review agents (`code-reviewer`, `security-reviewer`, `typescript-reviewer`, `a11y-architect`).
     - Architectural decision records (`architecture-decision-records`), click-path audits, and delivery gates.

7. **Individual Task Instructions**:
   - **Precedence Level**: 7 (Tactical Execution).

---

## 6. GSD Core Usage & Lifecycle Rules

### A. Large Feature Lifecycle (Spec Kit + GSD Harmony)
For major NAIRA features requiring multi-step execution:
```
/speckit-specify <feature>
       ↓
/speckit-plan (ratify architecture & constitutional compliance)
       ↓
/gsd-discuss-phase (capture tactical trade-offs before execution)
       ↓
/gsd-plan-phase (break into execution waves & context-isolated tasks)
       ↓
/gsd-execute-phase (execute in fresh-context subagents)
       ↓
/gsd-verify-work (walkthrough & gap diagnosis)
       ↓
/speckit-converge (evaluate against original spec requirements)
       ↓
Ship (PR & release gating)
```

### B. Small Changes & Bug Fixes
- **Do NOT force the full GSD lifecycle** for small UI tweaks, text adjustments, or straightforward component refinements.
- **For bugs**: Continue using the existing Spec Kit bug workflow (`/speckit-bug-assess` → `/speckit-bug-fix` → `/speckit-bug-test`).
- Do not create unnecessary planning artifacts (`.planning/`) for minor changes.

### C. Context Engineering & Artifact Separation
Context engineering prevents context window rot during heavy development:
- **Fresh-Context Subagents**: Use fresh-context work for repository research, architecture analysis, large implementation plans, independent implementation waves, test analysis, verification, and debugging.
- **Avoid Knowledge Duplication**:
  - `specs/<NNN>-<feature>/` is the **authoritative** source for feature requirements, acceptance criteria, and technical plans.
  - `.specify/memory/constitution.md` and `naira-baseline.md` are the **authoritative** sources for system architecture and platform laws.
  - `.planning/` (if used during GSD execution) is strictly for ephemeral execution tracking, subagent wave status, and phase state (`STATE.md`). It must NEVER contradict or duplicate the baseline or spec artifacts.
- **Hooks Policy**:
  - GSD lifecycle hooks are kept **disabled** by default in `.agents/settings.json` to prevent execution latency, unexpected tool blocking, and interference with Antigravity and ECC.
  - Antigravity permissions in `.agents/settings.json` allow read and execution of GSD assets without repeated approval friction.


