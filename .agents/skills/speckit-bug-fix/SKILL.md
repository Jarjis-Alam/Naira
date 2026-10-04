---
name: "speckit-bug-fix"
description: "Apply a minimal, targeted fix for a triaged bug in NAIRA, preserving existing business logic."
compatibility: "Requires spec-kit project structure with .specify/ directory"
metadata:
  author: "naira-spec-kit"
  source: "workflows/bug-fix.md"
---

## User Input

```text
$ARGUMENTS
```

## Objective
Implement the minimal, focused code change needed to resolve the bug assessed by `/speckit-bug-assess`.

## Constraints & Rules
- Do NOT perform opportunistic refactoring.
- Do NOT modify unrelated features or tables.
- Respect all 10 Constitution principles (never break session auth, never run `db:push` against prod, preserve technical monochrome UI).
- Ensure changes are small, reviewable, and strictly targeted.

## Next Step
Transition to `/speckit-bug-test` to verify resolution.
