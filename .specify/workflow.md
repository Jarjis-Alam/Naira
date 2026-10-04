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

NAIRA integrates four complementary frameworks into a disciplined engineering stack:

```
NAIRA Constitution (Governing Invariants & Rules)
       ↓
GitHub Spec Kit (Feature Lifecycle: Specify → Plan → Tasks → Implement → Converge)
       ↓
Karpathy Guidelines (Coding Discipline: Simplicity, Surgical Changes, Think First)
       ↓
Everything Claude Code [ECC] (Engineering Capabilities: TDD, Code Review, Security, Verification)
       ↓
Implementation & Targeted Tests
       ↓
Spec Kit Convergence
```

### Roles and Boundaries

1. **NAIRA Constitution** (`.specify/memory/constitution.md`):
   - Non-negotiable project laws: zero unapproved DB schema mutation, strict tenant isolation, deterministic source of truth, Groq API isolation, technical monochrome aesthetics.
2. **GitHub Spec Kit** (`.specify/`, `specs/`):
   - Feature lifecycle governance: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement` → `/speckit-converge`.
3. **Karpathy Guidelines** (`.agents/skills/karpathy-guidelines/`):
   - Implementation mindset: inspect before modifying, surface assumptions, simplest correct solution, surgical changes, no drive-by refactoring.
4. **Everything Claude Code (ECC)** (`.agents/`):
   - Reusable engineering capabilities deployed within implementation and review phases:
     - `tdd-workflow`: Test-driven development discipline.
     - `verification-loop`: Verification loops for regression and lint confidence.
     - `browser-qa`: Browser-based responsive, accessibility, and visual DOM verification.
     - Specialized agents (`code-reviewer`, `security-reviewer`, `typescript-reviewer`, `a11y-architect`).
     - Architectural decision records (`architecture-decision-records`), click-path audits, and delivery gates.

This hierarchy ensures that ECC enhances development capabilities without overriding the NAIRA Constitution or bypassing the Spec Kit lifecycle.

