---
name: "speckit-bug-test"
description: "Verify that a bug fix in NAIRA resolves the issue and introduces zero regressions."
compatibility: "Requires spec-kit project structure with .specify/ directory"
metadata:
  author: "naira-spec-kit"
  source: "workflows/bug-test.md"
---

## User Input

```text
$ARGUMENTS
```

## Objective
Run verification checks and regression test suites to guarantee that the bug is fully resolved with zero side effects.

## Verification Protocol
1. **Type Safety**: Run `npx tsc --noEmit` to verify strict TypeScript compilation.
2. **Schema Verification**: Run `npm run verify:schema` to confirm database schema parity.
3. **Targeted Bug Test**: Verify the specific scenario that previously failed.
4. **Phase Regression Suites**: Run relevant test scripts in `src/test/` (e.g. `phase-18-ats-resume-intelligence.ts`, `security-audit.ts`).
5. **Report**: Summarize test results, passing assertions, and confirm release readiness.
