---
name: "speckit-bug-assess"
description: "Assess, isolate, and reproduce a bug report in NAIRA without modifying application code."
compatibility: "Requires spec-kit project structure with .specify/ directory"
metadata:
  author: "naira-spec-kit"
  source: "workflows/bug-assess.md"
---

## User Input

```text
$ARGUMENTS
```

## Objective
Analyze the reported issue, trace the execution path across frontend/backend/database, and identify the root cause without making premature code modifications.

## Execution Steps
1. **Analyze Bug Report & Error Stack**:
   - Parse error messages, HTTP status codes, or visual defect descriptions.
   - Cross-reference with [NAIRA Constitution](file:///Users/munshijarjisalam/Documents/Projects/nexora/.specify/memory/constitution.md) and [System Baseline](file:///Users/munshijarjisalam/Documents/Projects/nexora/.specify/memory/naira-baseline.md).
2. **Isolate Root Cause**:
   - Check if database schema drift, migration omission, or missing indexes are involved.
   - Check session authorization (`auth()`) and tenant isolation invariants.
   - Inspect component state, data contracts, or API route response formatting.
3. **Determine Blast Radius**:
   - Identify affected routes, components, and regression test suites (`src/test/`).
4. **Output Assessment Report**:
   - Root cause hypothesis with file/line references.
   - Reproduction steps.
   - Proposed minimal fix strategy to hand off to `/speckit-bug-fix`.
