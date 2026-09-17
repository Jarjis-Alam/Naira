# Phase 18 Implementation Report

## Implemented

**Resume Intelligence** is now a first-class Placement OS section: it turns an uploaded resume into a target-aware placement asset, and feeds the same intelligence loop as Phases 14–17.

- **Upload + private storage** — text-based PDF (`pdf-parse`) and DOCX (`mammoth`) extraction, plus TXT. Files are stored as bytes inside Postgres, are only served by an owner-scoped route with `Cache-Control: no-store` and `Content-Disposition: attachment`, and there is no public URL for resume content. Unsupported types, empty files and files over 5 MB are rejected *before* anything is persisted; a supported file that cannot be read is stored (so the student can see what happened and download their own document) with a typed reason. Re-uploading an identical file is idempotent via a SHA-256 content hash.
- **Verbatim-preserving parser** — section-aware parsing into a structured model (`Header`, `Summary`, `Education`, `Experience`, `Internships`, `Projects`, `Skills`, `Certifications`, `Achievements`, `Publications`, `Leadership`, `Extracurriculars`, `Links`) with per-entry verbatim `rawLines`. Entries keep the original heading line while `title`/`organization` are split out only when the heading literally contains a separator (`Role — Employer`, `Role at Employer`, `Role | Employer`); nothing is inferred. Structured data is stored separately from the uploaded document.
- **ATS compatibility score** — six dimensions (Parsing, Keywords, Skills, Experience, Formatting, Role Match), each contributing an explanation line, with `evaluatedDimensions`/`unevaluatedDimensions` so an unmeasured dimension is reported as *not measured* rather than guessed. Deliberately never phrased as a hiring prediction, and the analysis carries explicit limitations including "not evidenced is not a claim that you lack the skill".
- **Parsing/formatting analysis** — checks for standard headings, extracted text, contact info, dates, job titles, education format, bullets, skill representation, column/table signals, images, header/footer repetition, symbol density and non-standard font families, each reported with the observable detail that triggered it.
- **Job description analysis** — paste or upload a JD; extracts required skills, preferred skills, responsibilities, qualifications, tools, keywords and role terminology, with the verbatim evidence line for every extracted skill.
- **Targeting without duplication** — Phase 16 remains the single source of company/role truth. Variants inherit the student's Phase 16 primary target by default, can be retargeted from the same catalog, and an unknown catalog id is rejected.
- **Resume ↔ JD/Role match** — matched, not-evidenced and resume-only skills, with the gap type kept explicit: `resume_gap` (possibly not represented), `preparation_gap` (measured weak), `both`, `not_assessed`, or `none`. A preparation gap is only ever produced when Placement OS has real answered-question data behind it.
- **Keyword analysis** — matched / missing / overused rows, plus a note that forbids recommending a keyword the student has no truthful basis for.
- **Truth-verified suggestions** — deterministic, evidence-linked suggestions carrying `what` / `why` / `evidence`, a severity, an actionable flag and a **factual-scope verification** (`checks`, `violations`, `truthPreserving`). The guard rejects any rewrite that introduces a new number, metric, technology, employer, responsibility, certification or scope-escalating verb that is not already in the student's own text; unverifiable improvements are emitted as advisory prompts (or with a bracketed placeholder the student must fill in) and are refused application. Accept/reject is stored per suggestion, and a decided suggestion is never re-issued.
- **Builder + ATS-safe export** — a structured editor for summary, sections, bullets and skill groups, plus a single-column export (`txt` and printable `html`) using standard headings and simple lists with no tables, images, text boxes, columns or decorative glyphs. Accepted suggestions snapshot a version recorded as truth-verified.
- **Variants + version history** — multiple targeted resumes (target company/role/JD/ATS/match/last updated) with exactly one primary enforced, and version snapshots carrying the score in effect at snapshot time plus a directional comparison (score deltas, added/removed skills, rewritten bullets, changed sections).
- **Integrations** — dashboard gets a compact Resume Health card and a numbered highest-priority findings digest; Phase 15's execution plan gains optional `resumeActions` (a `RESUME` action only asks the student to add evidence, an `ALIGN` action is only raised from independently measured weakness); Phase 17's simulation report annotates each weak topic with whether it is represented in the resume (`coveredInResume: null` when no resume exists — unknown, not a gap); the profile page now shows **Preparation Readiness / Target Readiness / Resume ATS Compatibility / Interview Readiness** as separate dimensions with an explicit note that they are intentionally not averaged. The ATS score is **not** folded into the readiness formula.
- **Zero-fabrication by construction** — no LLM is used; every statement is derived from the student's own document, the JD they supplied, or measured Placement OS performance. Missing information is rendered as "Not detected" / "Not provided" / "Not measured".

## Files Changed

**New — data + engine**
- `frontend/src/db/migrations/0013_phase_18_resume_intelligence.sql`
- `frontend/src/lib/resume/types.ts`, `skill-taxonomy.ts`, `text-extraction.ts`, `parse-resume.ts`, `job-description.ts`, `ats-analysis.ts`, `suggestions.ts`, `ats-render.ts`, `api-response.ts`
- `frontend/src/lib/validations/resume.ts`
- `frontend/src/server/resume-intelligence.ts`

**New — API (18 handlers across 13 route files, all deriving identity from `auth()` only)**
- `frontend/src/app/api/student/resume/route.ts` (GET workspace)
- `.../resume/upload/route.ts` (POST, multipart + size guard)
- `.../resume/variants/route.ts` (GET/POST), `.../variants/[id]/route.ts` (GET/PATCH/DELETE)
- `.../variants/[id]/analyze/route.ts` (POST), `.../job-description/route.ts` (POST/DELETE), `.../content/route.ts` (PATCH), `.../asserted-skills/route.ts` (POST), `.../export/route.ts` (GET), `.../versions/route.ts` (GET/POST), `.../versions/compare/route.ts` (GET)
- `.../resume/files/[id]/route.ts` (GET, owner-only private download)
- `.../resume/suggestions/[id]/decision/route.ts` (POST)

**New — UI**
- `frontend/src/app/(protected)/resume/page.tsx`, `.../resume/builder/page.tsx`
- `frontend/src/components/resume/`: `ats-score-card`, `parsing-findings`, `role-match-panel`, `keyword-match-table`, `skill-match-panel`, `suggestions-panel`, `job-description-panel`, `resume-upload-panel`, `resume-target-selector`, `variants-panel`, `version-history`, `resume-builder-editor`, `resume-health-card`

**New — tests**
- `frontend/src/test/phase-18-ats-resume-intelligence.ts`

**Modified (additive)**
- `frontend/src/db/schema.ts` — resume tables + enums only; no existing table altered
- `frontend/src/db/migrations/meta/_journal.json`
- `frontend/src/server/placement-execution.ts` — optional `resumeActions` on the daily plan
- `frontend/src/server/placement-target-strategy.ts` — exported role-domain requirement helper (reused, not duplicated)
- `frontend/src/app/(protected)/dashboard/page.tsx` — Resume Health card + resume-aligned actions block
- `frontend/src/app/(protected)/profile/page.tsx` — separate placement dimensions
- `frontend/src/components/layout/sidebar.tsx` — one nav item
- `frontend/src/app/(protected)/simulation/[id]/page.tsx`, `frontend/src/components/simulation/simulation-runner.tsx` — resume coverage per weak topic
- `frontend/package.json`, `frontend/package-lock.json` — `pdf-parse`, `mammoth` (runtime), `jszip` (dev-only, DOCX fixtures)

Pre-existing uncommitted Phase 11/14–17 work in the same working tree was left untouched; every Phase 18 edit to those files is additive.

## Database

- Migration required: **YES**
- Migration filename: `0013_phase_18_resume_intelligence.sql`
- Contents: five additive tables — `resume_files` (raw bytes + extraction signals, private), `resume_variants` (target + structured data + JD + scores, exactly one primary per user), `resume_analyses`, `resume_suggestions`, `resume_versions` — with three enums (`resume_file_format`, `resume_parse_status`, `resume_suggestion_status`). No existing table, column or index is modified.
- Production migration executed: **NO** (applied to the local `placement_os` database only and verified by the Phase 18 suite; not run against any production database)

## Step 0 Baseline (recorded before any Phase 18 change)

| Check | Baseline | After Phase 18 |
| --- | --- | --- |
| `npx tsc --noEmit` | PASS | PASS |
| `phase-17-placement-readiness-simulation.ts` | 56 / 0 | 56 / 0 |
| `phase-16-placement-target-strategy.ts` | 79 / 0 | 79 / 0 |
| `phase-15-placement-execution.ts` | 81 / 0 | 81 / 0 |
| `phase-14-placement-intelligence.ts` | 45 / 0 | 45 / 0 |
| `suite.ts` | 19 / 0 | 19 / 0 |

Every regression number is identical to the baseline, so nothing in Phase 18 altered prior-phase behaviour.

## Tests

- **Phase 18: 196 / 0** (`npx tsx src/test/phase-18-ats-resume-intelligence.ts`), covering:
  - **Upload** — valid text-based PDF, valid DOCX, DOCX table signal, unsupported type, oversized (validation *and* service layer, asserting nothing is stored), corrupt PDF, idempotent file record count.
  - **Parsing** — header (name/email/phone/location/links), all nine sections, verbatim date ranges, role/employer split with the original heading retained, detected canonical skills, summary, bullets, and a line-by-line sweep proving no original line is lost.
  - **ATS analysis** — score range, six-dimension breakdown, evaluated vs unevaluated split, explanation, limitations wording, ≥5 parsing checks with details, formatting findings from a deliberately messy signal set, and the invariant that a complex document never scores higher than a clean one.
  - **JD analysis** — required (Python/SQL/Docker), preferred (AWS, with the verbatim term), responsibilities, qualifications, keywords, per-skill evidence, and that cloud providers are matched precisely (AWS is not collapsed into a generic umbrella).
  - **Target matching** — Phase 16 inheritance, no invented target for a user without one, catalog-validated retargeting, unknown id rejection, re-analysis on change.
  - **Skill matching** — matched / not-evidenced / resume-only, a real `preparation_gap` backed by 42% measured SQL accuracy, a real `resume_gap` for Docker with no invented measurement, no accuracy without answered questions, and wording that never tells the student they lack a skill.
  - **Suggestions** — every generated suggestion truth-preserving with what/why/evidence, an independent numeric-leak sweep, accept (applies the rewrite, records the decision, snapshots a truth-verified version) and reject (leaves content byte-identical), plus **eight adversarial injections** — invented metric, percentage, technology, employer, responsibility, certification, scope escalation and scale — all rejected, with three benign rewrites still allowed.
  - **Builder** — summary and bullet edits persist, unrelated content survives, exports use standard headings with no tables/images/columns/markup.
  - **Versioning** — monotonic numbering, score-at-snapshot, newest-first history, directional comparison with deltas and content changes.
  - **Integration** — Phase 16 strategy still builds, Phase 15 plan carries resume actions that never assert a missing skill and only raise `ALIGN` from measured evidence, Phase 17 coverage resolves to true/false with the non-claim disclaimer and `null` for a resume-less user.
  - **Security** — all four resume endpoints fail closed unauthenticated; **12 / 12 cross-tenant operations blocked** (read, list, compare, update, delete, set JD, edit content, assert skill, export, file download, decide suggestion, save version); ownership errors map to 403; the owner receives byte-identical content.
  - **Zero-fabrication sweep** — six banned claim patterns asserted absent across findings, suggestions, recommendations and resume actions; missing information always phrased as not detected / not evidenced.
- **Regression:** Phase 14 45/0 · Phase 15 81/0 · Phase 16 79/0 · Phase 17 56/0 · suite 19/0.

## Verification

- TypeScript: **PASS** (0 errors, `npx tsc --noEmit`)
- ESLint: **PASS** (0 errors; project-wide 152 warnings, all pre-existing in other files — running ESLint over every Phase 18 path returns **0 problems**)
- Build: **PASS** (`npm run build`; `/resume`, `/resume/builder` and all 13 resume API routes compile and appear in the route manifest)
- Runtime smoke: `GET /resume` and `GET /resume/builder` on the running dev server answer `307 → /auth/login?callbackUrl=…`, confirming both routes execute and gate correctly.

## Known Issues

- **Text-layer only.** Scanned or image-only PDFs, password-protected PDFs, DOC and RTF are not supported. Each is rejected with a specific, plain-language reason, and encrypted PDFs are detected before parsing. This limitation is stated in the workspace UI.
- **Heuristic parsing.** Section recognition and title/organization splitting are deterministic heuristics over text. Unusual layouts can land content in `unclassified` (never dropped — `rawLines` retains it), and the parser reports `partial` status with warnings rather than guessing.
- **No LLM rewrite.** Suggestions are template- and rule-driven, so a rewrite is conservative and often asks the student to supply the missing detail themselves (for example a bullet with no measurable outcome is offered `[add a measurable impact if you have one]` as a bracketed placeholder, which the apply path refuses to store until the student replaces it). This is deliberate: it is what makes the zero-fabrication guarantee enforceable.
- **Role Match without a JD** is requirement-alignment against the curriculum domains the target role needs — it is not a skill list, and the UI labels the basis accordingly.
- `frontend/src/app/(protected)/dashboard/page.tsx` retains one pre-existing ESLint warning (`placementIntelligence` unused) that predates Phase 18 and was left alone.
- Resume bytes live in Postgres. Fine at this scale and simplest to secure, but a large user base would want object storage with signed, short-lived URLs behind the same ownership check.

## PDF Engine Fix (post-report addendum)

**Symptom.** Uploading a valid text-based PDF succeeded, but clicking **Analyse Resume** failed with `Setting up fake worker failed: Cannot find module '.../.next/dev/server/chunks/pdfw...'`.

**Root cause.** `pdf-parse` v2 delegates extraction to `pdfjs-dist`. Its legacy build lazily loads the fake worker via `GlobalWorkerOptions.workerSrc ||= "./pdf.worker.mjs"` — a path **relative to the importing module's URL**. When the bundler inlined `pdfjs-dist` into `.next/server/chunks/<hash>_pdfjs-dist_*.js`, that relative specifier resolved against the chunk directory, where no `pdf.worker.mjs` exists. The uploaded PDF was never the problem; the module graph was.

**Fix (all server-side, no behavior contract changed).**
1. `next.config.ts`: `serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas", "mammoth"]` — the parsers are `require()`d from `node_modules` at runtime, so every internal pdfjs path resolves against real files. (`@napi-rs/canvas` is a native binary that must never be bundled; `mammoth` is externalized defensively.) Merged with the existing `headers()` config; nothing replaced.
2. `src/lib/resume/text-extraction.ts`: parsers are imported lazily inside the extraction functions (never at module scope, never on the client); the pdfjs worker is bootstrapped explicitly via `pdf-parse/worker` + `PDFParse.setWorker(getData())`, so worker code is resolved in-process and no filesystem worker lookup ever happens.
3. New extraction error code `engine_unavailable` distinguishes a server-side parser failure (a deployment bug — retryable, ours) from `corrupt` (the document's fault). A corrupt PDF is never misreported as an engine failure and vice versa.
4. All resume API routes declare `runtime = "nodejs"` explicitly so the parsers can never be scheduled onto an edge runtime.
5. Per-page text is now taken from pdfjs's real page items (pdf-parse's `getText()` interleaves `-- N of M --` page markers into the text stream, which corrupted line-based parsing). Whitespace-only output is treated as a missing text layer, not as success.

**Proof (beyond TypeScript):** `rm -rf .next`, dev server restart → **zero pdfjs chunks** in `.next/dev/server/chunks`; live HTTP regression `src/test/phase-18-pdf-extraction-http.ts` (**36/36**) drives the real server over authenticated HTTP: real PDF upload → extraction (`pageCount`, 89 words) → ATS analysis (score 87, 6-dimension breakdown, 13 parsing checks), DOCX/TXT variants analyzed, scanned/corrupt/RTF rejected with the correct structured codes, and the string `fake worker` absent from every response, the rendered `/resume` page, and both server logs. Repeated identically against `next start` (production) on a fresh build. Unit suite grew to **214/0** with PDF engine/pageCount/classification assertions using generated PDF fixtures.

## Stale Failed Upload Retry (post-report addendum 2)

**Symptom.** After the PDF engine fix, re-uploading the same valid PDF still showed "This file was already uploaded and could not be parsed." Content-hash idempotency correctly found the stored row, but the row's `parseStatus = "failed"` — left behind by the old pdfjs worker bug — was treated as a permanent verdict and returned without a retry.

**Semantics change.** An existing failed record is no longer "permanently reject" — it is "retry using the current parser":

| Stored record | Re-upload behavior |
| --- | --- |
| `parsed` / `partial` | Reused as-is (unchanged idempotency) |
| `pending` | Reused/stalled record re-parsed with the current parser |
| `failed` | Row is **updated in place** with a fresh extraction: status, `rawText`, `pageCount`, `fileSignals`, `parseWarnings` all rewritten; same row id, so identity and idempotency hold and no duplicate bytes are ever stored |
| corrupt file, retried | Still fails — now with the current, correctly classified `corrupt` error |
| engine failure | `engine_unavailable` classification preserved (never blamed on the document) |
| same hash, other user | Not reused — idempotency is user-scoped |

**Implementation.**
- `uploadResumeFile` now delegates to an internal function that, on finding a `failed`/`pending` row, runs the fresh extraction through `retryStoredResumeFile` — the passed extraction IS the current parser's verdict, so no stale error can survive. Per-process in-flight map keyed by `userId:contentHash` deduplicates concurrent uploads; the new unique index plus `onConflictDoNothing` handles cross-process races by deferring to the winning row.
- Storage-level guarantee: migration `0014_resume_upload_retry_fix.sql` replaces the `(user_id, content_hash)` index with a **unique** index (deduplicating any pre-existing pairs first), so one stored copy per distinct document per student is now enforced by the database, not just the code path.
- UI: the upload panel tracks a prior failure and frames the next attempt as **"Retrying analysis…"**; a successful retry shows the parsed state immediately with a "(re-parsed with the current engine)" note. The dead-end message is gone.
- All validation unchanged: 5 MB limit, MIME/extension/magic-byte checks, scan detection, encrypted-PDF detection, unsupported-format handling, zero-fabrication guard, ATS scoring, private bytea storage, owner isolation.

**Regression coverage (20 new assertions, suite now 234/0):** (A) parsed duplicate → same id, no new row; (B) failed record with the stale fake-worker error → re-upload re-parses, repopulates `rawText`/`pageCount`/signals, clears the worker warning, keeps the same row; (C) genuinely corrupt duplicate → still fails as `corrupt`, same row, genuinely re-attempted; (D) engine failure stays distinguishable from corrupt via the classification hook; (E) three concurrent uploads of the same failed file → one row, one parse, all requests agree; (F) same content hash under another user → new row, no cross-user reuse. The live HTTP regression still passes 36/36.

**Owner-row recovery observed live:** the real `jarjis resume.pdf` row (270,652 bytes, hash `bb8a35e3…`) that had been stranded in `failed` was re-uploaded through the new path: `ok=true, retried=true, parseStatus="parsed", pageCount=1, wordCount=377`, same row id, empty warnings.

## Status

READY
