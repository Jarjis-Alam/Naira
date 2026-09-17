# Phase 19 — Placement Application OS — Implementation Report

## Mission

Extend Placement OS from *"Am I prepared for placements?"* to *"Where am I applying, what stage am I in, what do I need to do next, and how prepared am I for that application?"* — completing the lifecycle **Target → Resume → Prepare → Simulate → Apply → Track → Interview → Offer** by integrating with Phases 14–18 instead of duplicating them.

## What was built

### Data (additive only)
Five new tables in `src/db/schema.ts`, applied via hand-authored migration `0015_phase_19_applications.sql` (+ journal entry, applied to the local DB):

| Table | Purpose |
| --- | --- |
| `applications` | One row per company+role the student is tracking (status, deadlines, JD, source, location, package text, notes, resume association) |
| `application_events` | **Append-only** timeline: created / status changed / deadline added-changed / resume attached / assessment scheduled / interview scheduled-completed / offer received / rejected / withdrawn / reopened / note added / JD attached |
| `application_interviews` | Round number, type (Technical, Coding, HR, Managerial, Behavioral, GD, Other), scheduled/completed dates, interviewer + user notes, result |
| `application_assessments` | Name, type, scheduled date, deadline, status, user-provided score text, notes |
| `application_offers` | Offer date, compensation text (verbatim user data), location, joining date, offer deadline — multiple offers supported |

No existing table was touched. Historical accuracy: company/role names are snapshotted onto the application at creation; renaming the catalog never rewrites history (covered by a test).

### Domain library (`src/lib/applications/domain.ts`)
Pure, deterministic logic: the 10-status set, legal transition table (INTERESTED→…→OFFER forward chain; REJECTED/WITHDRAWN/CLOSED terminal except the explicit reopen targets), status labels, pipeline order, event types + labels, checklist derivation strictly from real state (`ChecklistFacts`), and display-only deadline math (`describeDeadline` — never invents a date).

### Service layer (`src/server/application-intelligence.ts`)
- **Creation** defaults to the student's Phase 16 target company + role, resolves both from the existing catalog (no second company database), rejects a second *active* application for the same company+role, and stamps `appliedAt` only when the start status is APPLIED or beyond.
- **Status transitions** guarded by the domain table; rejections name the legal alternatives. Reopens are first-class events with `reopenedCount`.
- **Timeline** is append-only via `recordEvent`; nothing is ever updated or deleted.
- **Resume association** reuses Phase 18 variants (`getResumeVariant` validates ownership), snapshotting label + ATS + target-match scores at attach time; detaching keeps the history event.
- **JD** is analyzed by the Phase 18 analyzer (`analyzeJobDescription`) — parse must succeed before storing.
- **Readiness snapshot** surfaces the four existing dimensions (Phase 15 preparation, Phase 16 target, Phase 18 resume ATS, Phase 17 interview) **independently** — no combined percentage exists anywhere in the type or code.
- **Skill gaps** typed by source (`preparation` / `simulation` / `resume`), each with an explanation and, where applicable, Phase 18 resume coverage evidence — never claiming a skill gap merely because it is absent from the resume.
- **Interviews, assessments, offers** with owner checks; assessments never overwrite Placement OS test attempts.
- **Board / dashboard card / upcoming events** derived only from stored rows; the dashboard card carries counts + next real deadline and explicitly no history.

### APIs (all `runtime = "nodejs"`, owner-scoped)
`/api/student/applications` (GET board, POST create) · `/[id]` (GET detail, PATCH `?action=status` guarded transition or field update incl. deadlines/resume/JD, DELETE) · `/[id]/events` (GET timeline, POST note) · `/[id]/interviews` (POST schedule, PATCH complete) · `/[id]/records` (`?kind=assessment` POST/PATCH, `?kind=offer` POST) · `/applications/calendar` (GET upcoming, `withinDays` 1–365).

Error mapping (`api-response.ts`): validation → 400, ownership → 403 (never 404, so probing cannot distinguish "not yours" from "does not exist"), unexpected → generic 500 with the detail logged server-side.

### UI
- **`/applications`** — totals (active / assessments / interviews / offers), full pipeline strip across all 10 statuses, upcoming events list, per-application cards (status chip, snapshot scores, next event), empty state for new students, and a **New Application** dialog pre-defaulted to the Phase 16 target.
- **`/applications/[id]`** — header (company, role, status, deadlines or "No deadline provided"), four-dimension Application Readiness (with the "never combined" note), resume section (variant link, ATS + target match), gaps by source, state-based checklist, interviews, assessments, offers, vertical timeline, private notes, JD extraction (required/preferred skills, responsibilities, qualifications, warnings, collapsible raw text), and an Actions panel (status buttons limited to legal transitions, four deadline types, resume variant attach/detach, JD attach, interview scheduling, assessment recording, offer recording).
- **Dashboard integration** — compact Application Pipeline card (counts + next deadline + Track link) between the Phase 18 Resume Health card and the Phase 17 Simulation card. No dashboard redesign, no history overload.
- **Sidebar** — "Applications" nav item (`work` icon) between Resume and Simulation.
- **Roadmap strip** — when the next application event is within 30 days, the roadmap shows "«Company» «event» in N days" with the top 3 recommended focus items pulled from the existing Phase 15 daily plan and "Practice Now →" links that launch the existing practice flow. No second preparation engine.

## The integration bug the live test caught

The unit suite (79/79) passed, but the **live HTTP verification failed on create** with a 400. Root cause: Zod v4's `z.string().uuid()` rejects the canonical catalog's deterministic ids (`00000000-…-000000000703`) because they are not a valid RFC UUID variant. Every application for a seeded canonical company therefore failed validation at the API boundary while the service layer worked fine. Fixed by validating catalog ids with a UUID-shaped regex matching the catalog's actual id format (schema `catalogId` in `src/lib/validations/applications.ts`). This is exactly why an HTTP-level gate is worth running.

## Verification gate

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | PASS (0 errors) |
| `npm run lint` | PASS — **0 errors** (152 pre-existing warnings, none in Phase 19 files) |
| `npm run build` | PASS — all Phase 19 routes in the manifest |
| **Phase 19 suite** | **79 / 0** |
| Phase 19 live HTTP | **27 / 0** |
| Phase 18 / 17 / 16 / 15 / 14 / suite | 234 / 56 / 79 / 81 / 45 / 19 — identical to baseline |

The Phase 19 suite covers: domain transition rules (incl. forbidden INTERESTED→OFFER and explicit reopen), state-based checklist, deadline display math, creation defaults + historical accuracy through a catalog rename + duplicate rejection, guarded transitions with append-only timeline verification, Phase 18 resume + JD reuse, the four-dimension readiness snapshot (asserting **no combined score exists**), gap source typing, interview/assessment/offer records, board + upcoming events + dashboard card shape, terminal-status reopen, owner-only delete, and cross-tenant denial on every sub-resource with complete data isolation between users.

The live HTTP verification registers real users, logs in over cookies, and verifies: auth gates (307 on pages and API), empty board, create → detail (readiness keys, 8-item checklist, timeline, legal transitions) → duplicate rejection → illegal transition rejected with the legal alternatives in the message → legal transition → interview scheduling → calendar contents (only real deadline kinds, sorted) → cross-tenant read/transition denial → cleanup.

Manual browser-level checks via curl with a session cookie: `/applications` and `/applications/[id]` render 200 with the session, redirect to login without it; every action on the detail page goes through the same verified API routes.

## Honest notes

- The Actions panel is functional rather than polished: it uses pragmatic single-purpose forms (a "Load my resume variants" fetch instead of an always-populated selector, inline forms for each action type). The UX could be richer (e.g. inline edit of interview results) without touching the service layer.
- `application_interviews`/`assessments`/`offers` cascade with their application; deleting an application deletes its timeline — intentional (student-owned tracking data), but it means "delete" is a real destructive action and the UI does not yet add a confirmation step.
- Deadline reminders are derived, not pushed — there is no scheduler/notification subsystem; the calendar and strips compute "days remaining" on load.
- The resume-variant insert used in the unit test bypasses the normal Phase 18 variant-creation path for fixture simplicity; the integration contract tested is the application-side one.
