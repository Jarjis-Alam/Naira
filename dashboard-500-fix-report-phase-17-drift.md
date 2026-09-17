# PRODUCTION DASHBOARD 500 — ROOT CAUSE & FIX (Phase 17 schema drift)

**Symptom:** `ERR_500_SYSTEM_FAULT` / "Application Error" / Digest `1421024325` on `/dashboard` (production).
**Scope:** Diagnosis + minimal fix. No dashboard rewrite, no Phase 20 removal, no readiness-formula changes, no auth changes. Nothing committed.

---

## 1. ROOT CAUSE

**Phase 17's simulation schema was never shipped as a migration, so the production database cannot contain it — and `/dashboard` reads it on every load, unguarded.**

`src/db/schema.ts` declares 31 tables. The migration set `src/db/migrations/*.sql` (0000–0016) creates only **29**. The two missing relations and their three enum types exist in a working developer database only because they arrived via `drizzle-kit push`:

- missing tables: `placement_simulations`, `placement_simulation_rounds`
- missing enum types: `simulation_status`, `simulation_round_type`, `simulation_round_status`

Production is provisioned by applying the `.sql` files by hand (there is **no migration step in the deploy pipeline** — documented in the earlier `dashboard-500-fix-report.md`). Therefore production has no `placement_simulations`, and the dashboard's `Promise.all` contains:

```ts
getStudentSimulationHistory(userId),      // ← unguarded (no .catch)
```

which queries `placement_simulations`. PostgreSQL raises `relation "placement_simulations" does not exist`, the rejected promise propagates out of the server component, and React's root error boundary (`src/app/error.tsx`, the file that literally contains the string `ERR_500_SYSTEM_FAULT`) renders with a digest — for **every authenticated user**, including zero-data students (`/dashboard` calls it unconditionally).

This is the same failure class as the previous incident (`dashboard-500-fix-report.md`, Digest `2277838918`, missing migrations 0008–0011) — again schema drift, not application logic.

## 2. EXACT FAILING CODE / QUERY

- `frontend/src/app/(protected)/dashboard/page.tsx:49` — `getStudentSimulationHistory(userId)`, member of the **unguarded** `Promise.all` (only the Phase 18/19/20 cards had `.catch`).
- `frontend/src/server/placement-simulation.ts:739-748` — `getStudentSimulationHistory()`:

```sql
select "id", "user_id", ..., "updated_at"
from "placement_simulations"
where "placement_simulations"."user_id" = $1
order by "placement_simulations"."created_at" desc
```

- Missing schema objects: tables `placement_simulations`, `placement_simulation_rounds`; enums `simulation_status`, `simulation_round_type`, `simulation_round_status` — declared at `src/db/schema.ts:521-612`, **created by no migration file** before this fix.

## 3. WAS A PRODUCTION MIGRATION MISSING?

**Yes — and it could never have been applied, because no migration file ever existed for it.**

Evidence:

| Check | Result |
|---|---|
| Apply **all 17** migrations (0000–0016) to a fresh database | 29 tables created, **0 failures** |
| Tables in a working (schema-pushed) database | **31** |
| Drift = exactly | `placement_simulations`, `placement_simulation_rounds` (+3 enum types) |
| `grep -l placement_simulations src/db/migrations/*.sql` (before fix) | **no matches** |
| Migrations 0013–0016 added to the repo | **2026-09-17 12:46:51** (commit `97f64f3`) — i.e. production has had no chance to receive them |
| Last known production migration application | 0008–0011 (per `dashboard-500-fix-report.md`, 2026-09-09) |
| `drizzle.__drizzle_migrations` in the dev DB | **empty** (migrations are applied by hand with psql, never tracked) |

So production is behind by the resume/application/outcome schema **and** by the Phase 17 simulation schema that had no migration at all. The dashboard survived the guarded Phase 18/19/20 reads (they have `.catch`) but not the unguarded Phase 17 read.

**Reproduction (production build, real HTTP):**

```
# production `next start` against a database built from the migration files only
DATABASE_URL=.../placement_os_migonly npx next start -p 3100
POST /api/auth/register -> 201 ; POST /api/auth/callback/credentials -> 302
GET  /dashboard -> 200 (streamed shell) + error carried in the flight payload

server log:
⨯ Error: Failed query: select ... from "placement_simulations" where "placement_simulations"."user_id" = $1 ...
  [cause]: error: relation "placement_simulations" does not exist
```

The HTTP status is 200 because the shell streams first; the browser then hydrates and renders the error boundary — which is precisely the user-visible `ERR_500_SYSTEM_FAULT` + digest. Digest values cannot be reverse-mapped, but the mechanism and the exception are now deterministic and reproduced locally.

## 4. EXACT FIX

**a) Root cause — ship the missing schema as a real migration.** New `0017_phase_17_simulation_schema.sql`: creates the 3 enum types (`duplicate_object` guard), both tables (`CREATE TABLE IF NOT EXISTS`, FKs to `users`/`companies`/`roles`/`tests`/`attempts`, defaults matching `schema.ts` exactly) and all four indexes (`IF NOT EXISTS`), including the three secondary indexes that were missing even in the pushed dev DB. Verified **idempotent** (applied 3× cleanly) and to bring migrations-only databases to **exact parity** (0 table drift, 0 column drift).

**b) Resilience (localized, non-concealing).** A small `degradeOnFailure(label, read, fallback)` helper in the dashboard wraps the four non-critical intelligence reads (simulation history, resume health, application pipeline, outcome intelligence): a failing widget now degrades to that card's empty state and the failure is **logged loudly** (`[dashboard] simulation history unavailable — rendering the dashboard without it: ...`). The widget is *degraded, never concealed*, and the underlying schema problem is still fixed in (a). The remaining reads (`getStudentIntelligence`, `getPlacementIntelligence`, `getStudentPlacementTargets`, `getDailyExecutionPlan`, `getPlacementTargetStrategy`) still feed core layout and were deliberately left untouched to avoid a dashboard rewrite.

**c) Regression guard.** New `src/test/migration-schema-parity.ts` (19 assertions): every `pgTable`/`pgEnum` in `schema.ts` must be created by a migration; the live DB must contain every schema table and must contain **no table absent from the migration set** (the exact incident condition); Phase 17's tables/enums are pinned with explicit regression assertions; and the dashboard's degrade+log contract is asserted. Proved to catch the bug: hiding `0017` makes the suite fail **9 assertions** (`drift: placement_simulation_rounds, placement_simulations`).

**d) Housekeeping.** Six untracked diagnostic probe files from earlier debugging (`src/test/_diag20.ts`, `_diag20b.ts`, `_perf20.ts`, `_pool20.ts`, `_qcount20.ts`, `_seedcheck.ts`) were left in the tree and had started **breaking `npm run build`** (TS errors). Removed.

## 5. FILES CHANGED

| File | Change |
|---|---|
| `frontend/src/db/migrations/0017_phase_17_simulation_schema.sql` | **new** — Phase 17 tables/enums/indexes, idempotent |
| `frontend/src/db/migrations/meta/_journal.json` | +1 entry (`idx 17`, tag `0017_phase_17_simulation_schema`) |
| `frontend/src/app/(protected)/dashboard/page.tsx` | +34/−4 — `degradeOnFailure` for the four non-critical cards, with logging |
| `frontend/src/test/migration-schema-parity.ts` | **new** — parity + resilience regression suite |
| `frontend/src/test/_diag20.ts` … `_seedcheck.ts` | deleted (untracked probes, broke the build) |

Nothing committed. No readiness formula, Phase 14–19 logic, auth, or ownership check was modified.

## 6. TESTS — BEFORE / AFTER

| Gate | Before | After |
|---|---|---|
| `tsc --noEmit` | clean | **clean** |
| `npm run lint` | 0 errors / 152 warnings | **0 errors / 152 warnings** (my files add none) |
| `npm run build` | failed with stray probes present | **✓ compiled** |
| Phase 20 outcome intelligence | 62 / 0 | **62 / 0** |
| Phase 19 applications | 79 / 0 | **79 / 0** |
| Phase 18 ATS resume | 234 / 0 | **234 / 0** |
| Phase 17 readiness simulation | 56 / 0 | **56 / 0** |
| Phase 16 target strategy | 79 / 0 | **79 / 0** |
| Phase 15 execution | 81 / 0 | **81 / 0** |
| Phase 14 intelligence | 45 / 0 | **45 / 0** |
| Core suite | 19 / 0 | **19 / 0** |
| **Migration parity (new)** | — | **19 / 0** (fails 9 when 0017 is hidden) |

Live verification, production build (`next start`) against a database built **only** from the migration files:

| Check | Without 0017 | With 0017 |
|---|---|---|
| `GET /dashboard` | 200, **no error page**, widget degraded + logged | 200, full render, **0** relation errors, **0** degradation logs |
| Route sweep `/dashboard /roadmap /simulation /analytics /applications /outcomes /profile /resume /tests /assessment` | — | **all 200**, 0 error pages, **0 new DB relation errors** |
| Real browser (register → sign in → `/dashboard`) | — | renders greeting, readiness, Execution OS, **PLACEMENT SIMULATION card**, Application Pipeline, Resume Health, Quick Actions, Recent Activity |

The browser check is the strongest form: the card whose missing table killed the page now renders (`PLACEMENT SIMULATION` → "Start Placement Simulation"). (The thread's preview webview would not composite a screenshot; the accessibility tree + HTTP/DB evidence above are the verification.)

## 7. PRODUCTION ACTION STILL REQUIRED

**Yes — the code fix alone does not repair production. The production database must be migrated.** Pre-flight (read-only), then apply each file that reports missing objects, in order:

```bash
# 1. Pre-flight (read-only) — what is production actually missing?
psql "$PROD_DATABASE_URL" -tAc "select tablename from pg_tables where schemaname='public' order by 1;"
psql "$PROD_DATABASE_URL" -tAc "select typname from pg_type where typtype='e' order by 1;"

# 2. Apply in order. Each is idempotent except 0008 (skip 0008 if question_pools exists).
cd frontend
for m in 0012_phase_11b_multiple_target_roles 0013_phase_18_resume_intelligence \
         0014_resume_upload_retry_fix 0015_phase_19_applications \
         0016_phase_20_outcome_intelligence 0017_phase_17_simulation_schema; do
  psql "$PROD_DATABASE_URL" -v ON_ERROR_STOP=1 -f "src/db/migrations/$m.sql"
done
```

`0017` is required even though it is numbered last: it is the migration that actually resolves this outage. After applying, `GET /dashboard` should render the Placement Simulation card instead of the fault page, and the failure line `relation "placement_simulations" does not exist` should disappear from the Vercel runtime logs.

**Recommended follow-up (prevents recurrence):** add a migration step to the deployment (or a deploy-time parity check) — this is the second production dashboard outage caused by the same thing: code deployed ahead of a hand-applied schema. The new parity suite is designed to be that gate.

---

ROOT CAUSE:
Phase 17's `placement_simulations` / `placement_simulation_rounds` (+ enums `simulation_status`, `simulation_round_type`, `simulation_round_status`) were declared in `schema.ts` but shipped in **no migration file** — they reached only push-based databases. Production is migration-only, so the relations did not exist; `/dashboard` calls `getStudentSimulationHistory()` **unguarded**, PostgreSQL raised `relation "placement_simulations" does not exist`, and the uncaught server-render exception rendered `error.tsx` → `ERR_500_SYSTEM_FAULT` (Digest 1421024325) for every authenticated user.

FIX:
New idempotent migration `0017_phase_17_simulation_schema.sql` (+ journal entry) to make the schema reproducible from migrations, verified to bring a migrations-only database to exact parity; plus a localized `degradeOnFailure` fallback (with logging) so a single non-critical widget can no longer take down the dashboard; plus a parity regression suite that fails if any declared table/enum has no migration.

TESTS:
tsc clean · lint 0 errors · build ✓ · parity 19/0 (fails 9 without 0017) · Phase 20 62/0 · 19 79/0 · 18 234/0 · 17 56/0 · 16 79/0 · 15 81/0 · 14 45/0 · core 19/0 · production-build route sweep clean · real browser dashboard render confirmed.

PRODUCTION:
**Not yet fixed in production** — no production access available here. Required: apply migrations `0012 → 0017` (0017 is the one that fixes this outage). Local dev DB has been brought to parity.
