# Phase 20 — Placement Outcome Intelligence & Adaptive Preparation — Implementation Report

## Mission

Close the Placement OS feedback loop: **Application → Interview → Feedback/Reflection → Terminal Outcome → Outcome Intelligence → Evidence-backed Gap → Practice Now → existing Phase 15 Practice**. The locked invariant, enforced structurally: *outcome → evidence → observation → preparation adjustment*, and **never** *outcome → assumed cause → diagnosis*.

## What was built

### Data (additive, `0016_phase_20_outcome_intelligence.sql`)
- `OUTCOME_RECORDED` value added to the `application_event_type` enum — outcomes become first-class timeline events, appended by the existing guarded `updateApplicationStatus` transition when a status reaches REJECTED / WITHDRAWN / OFFER / CLOSED.
- New `application_reflections` table (one per application: what went well / was difficult / was asked / would improve) — student-provided, never treated as facts.
- Four additive columns on `application_interviews`: `difficulty`, `topics_discussed` (jsonb), `student_confidence`, `questions_remembered` (jsonb).
- No existing table or column touched; migration applied to the local DB with journal entry.

### Pure engine (`src/lib/applications/outcome-intelligence.ts`)
- **8-type evidence model** (`assessment_score … application_status`) with `confidence: "observed" | "student_reported"` — the UI's "System detected 🟢" vs "Student reported 🟡" comes strictly from this field.
- **`deriveOutcome`**: the 8 categories strictly from Phase 19 history. Stage proof rules: REJECTED after a proven INTERVIEW/SHORTLISTED event → `REJECTED_INTERVIEW`; after ASSESSMENT → `REJECTED_ASSESSMENT`; otherwise `REJECTED_APPLICATION` with `stage: "unknown"` and the label "Rejected — Stage not recorded". **Stage inference is structurally absent.** OFFER_ACCEPTED/DECLINED only when the student's own reflection explicitly records the decision. Every classification returns dated `basis[]` citations.
- **Causal guard**: `isCausalClaim()` over causal link patterns (`caused`, `because of`, `due to`, `resulted in`, `lead(s) to`, `rejected because`, …). `renderNonCausalObservation()` is the **only** factory for gap-outcome sentences, always produces the "X was an observed gap at the time of … — this does not establish causality" form, and **throws** if its own output would read as causal. "DSA caused the rejection" is unrepresentable in the codebase.
- **`detectPatterns`**: a pattern requires the same evidence-backed gap in ≥2 outcome applications; always reports `occurrences`/`sampleSize`; returns `[]` when evidence is thin. Descriptions are descriptive, never diagnostic.
- **`buildFocusCandidates`**: only already-evidenced gaps; FIX for system-observed evidence, REVIEW when the only source is self-report; reuses Phase 15's FIX/REINFORCE/REVIEW vocabulary.
- Descriptive analytics only — no probability, prediction, employability, or "best company" concept exists anywhere in the engine's types or output.

### Service (`src/server/outcome-intelligence.ts`)
- `getOutcomeAnalysis`: derives the outcome from the application's own timeline, assembles evidence from the owning phases (Phase 14 priorities via `getPlacementIntelligence`, Phase 17 simulation scores, Phase 18 ATS/match snapshots from the application row or live variant, Phase 19 interview results, reflections as `student_note`), and produces non-causal observations, gaps, and focus candidates.
- `saveReflection` / `saveInterviewFeedback` / `getInterviewFeedback` — owner-scoped, Zod-validated; every save appends a timeline event so provenance is auditable.
- `getOutcomeAnalytics` — totals, stage distribution, cross-application patterns, aggregated focus candidates.
- `getPlacementJourney` — unified timeline; every entry cites its persisted source (Phase 16 target row, Phase 19 application events). Nothing invented.
- `getOutcomeDashboardCard`, `getOutcomeHistorySummary` (profile, counts only), `getOutcomePlanContext` (Phase 15 advisory context).
- Student-reported difficulty joins a gap **only** when the topic name literally appears in the student's own words — self-reports never create measured weaknesses by themselves.

### Phase 15 integration (advisory only)
`getDailyExecutionPlan` gains an optional additive `outcomeContext` (`headline`, `matches`, `additionalFocus`, `note`). It is populated only when a terminal outcome exists AND evidence-backed candidates overlap the plan; it can annotate a matched action or add a labeled advisory entry when the plan under-fills, but **never reorders, filters, or replaces actions** — ordering remains measured-performance-driven, and the note in the UI says exactly that. Failures in the outcome layer degrade to `undefined` silently.

### APIs (all `runtime = "nodejs"`, auth-gated, Zod, owner-scoped)
`GET /api/student/outcomes` · `GET /api/student/outcomes/[applicationId]` · `GET /api/student/outcomes/analytics` · `POST /api/student/applications/[id]/reflection` · `GET|PATCH /api/student/applications/[id]/interviews/feedback`. Ownership failures → 403 (indistinguishable from "does not exist" to a prober), unauth → 401/307.

### UI
- **`/outcomes`** page: overview counts, stage distribution, evidence-backed patterns with sample sizes, preparation feedback with Practice Now links, recent outcomes, unified journey timeline, and the disclaimer rendered from the engine's constant.
- **Application detail**: "Outcome Intelligence" section — outcome, evidence with per-line provenance markers, non-causal observations, resume signal, next focus with Practice Now, reflection form, per-interview feedback form, recorded feedback display.
- **Dashboard**: compact "Placement Outcomes" card (counts, recent outcome, observed focus, disclaimer) after the Phase 19 pipeline card.
- **Roadmap**: "Recent application feedback" strip only when outcome evidence exists, explicitly labeled "(Phase 15 plan drives practice)".
- **Profile**: descriptive "Placement Outcome History" counts with "not a success score" note.
- **Sidebar**: "Outcomes" nav item.

## Verification gate

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | 0 errors (0 on all Phase 20 paths) |
| `npm run build` | PASS — `/outcomes` + 3 outcome API routes in the manifest |
| **Phase 20 suite** | **62 / 0** |
| Phase 19 / 18 / 17 / 16 / 15 / 14 / core | **79 / 234 / 56 / 79 / 81 / 45 / 19** — identical to baseline |

The Phase 20 suite includes the adversarial causality battery: rejection + recorded interview gaps must produce **zero** causal-language matches across every observation, evidence label, focus reason, resume signal, and disclaimer (scanned programmatically); the guard detects `caused` / `because of` / `resulted in`; one-occurrence gaps produce no pattern; analytics JSON must not contain probability/prediction/employability concepts; stage distribution must count "Stage not recorded" honestly; cross-tenant denial on every surface (analysis, reflection write, feedback write/read, analytics, journey, dashboard card).

## Live server verification (dev server, real HTTP, real users)

1. Registered and logged in a real student; created an application (catalog company/role) with a JD.
2. Scheduled a Technical interview; saved student-reported feedback (difficulty "hard", topics Graphs/DBMS, confidence note) — `200`.
3. Saved a reflection ("Struggled with Graph Algorithms questions.") — `201`.
4. Transitioned ELIGIBLE → APPLIED → INTERVIEW, completed the interview `not_cleared`, then REJECTED — all `200`; exactly one `OUTCOME_RECORDED` event written.
5. `GET /api/student/outcomes/[id]` → "Rejected after interview", stage `interview` (proven, not inferred), evidence types `application_status / interview_result / student_note`, student-reported evidence labeled distinctly, observation rendered as "Technical Interview was an observed interview-topic difficulty during … — this does not establish causality."
6. All six pages (`/outcomes`, `/applications`, `/applications/[id]`, `/dashboard`, `/roadmap`, `/profile`) render `200` with a session; **causal-language sweep over the rendered HTML of the three outcome-bearing pages: CLEAN**; outcome label, "Outcome Intelligence" section, "Student reported" markers, and disclaimer verified present in the DOM.
7. Cross-tenant: second real user's read of the analysis → **403**, reflection write → **403**, analytics show nothing; anonymous `/api/student/outcomes` → **307**.
8. Persistence: reflection and interview feedback re-read intact after "reload".
9. Practice flow: outcome focus candidate resolves into the existing `/practice?topicId=…&subjectCode=…` Phase 15 flow (`200`); the outcomes page renders "View plan →" links (no topicId → plan route) rather than fabricating practice targets.
10. Fixture users deleted; dev server stopped.

## Honest notes

- The observation phrasing is deliberately formulaic ("X was an observed… — this does not establish causality"). That repetition is the cost of the structural guarantee; it reads as legalistic by design.
- `readiness.target` in the analysis snapshot is `null` by design: Phase 16's target score is requirement *coverage*, not outcome evidence, and folding it in would imply a synthesis the phase forbids. The application detail page still shows the full four-dimension readiness panel from Phase 19.
- Pattern detection caps at the 20 most recent outcome applications per analytics call — plenty for a student's real history, but a documented bound.
- The dashboard/roadmap/profile integrations are read-only consumers; no new inputs or actions were introduced there.
- Offer accepted/declined detection is intentionally narrow (verbatim accept/decline words in the student's own reflection); it will miss paraphrases rather than guess.

**Nothing was committed.** Phases 14–19 files untouched except: `application-intelligence.ts` (+17-line additive `OUTCOME_RECORDED` hook), `placement-execution.ts` (+advisory `outcomeContext`), `domain.ts` (+event type/label), `schema.ts` (+additive columns/table), and the four UI pages receiving read-only sections.
