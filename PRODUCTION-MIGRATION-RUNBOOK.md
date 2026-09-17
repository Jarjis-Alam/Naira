# PRODUCTION MIGRATION RUNBOOK — dashboards 500 fix (0012 → 0017)

**Context.** `/dashboard` returns `ERR_500_SYSTEM_FAULT` in production because Phase 17's
`placement_simulations` / `placement_simulation_rounds` were declared in `schema.ts` but shipped in
**no migration file** (fixed by `0017`). Production is provisioned by hand-applying
`frontend/src/db/migrations/*.sql`; there is no migration step in the deploy pipeline.

**Rules for this run** (do not deviate):

- **Never** run `drizzle-kit push` / `npm run db:push`. It diffs `schema.ts` against the live database
  and can emit destructive DDL (drops/alters) on a database it does not own.
- **Never** drop, reset, truncate, or recreate the production database.
- Apply **only** the migrations the probe reports as `MISSING` / `PARTIAL`, in **ascending** order.
- One file at a time. Read the output. Re-run the probe after each file.

---

## Step 0 — Preconditions

```bash
# psql client available
psql --version

# Values come from your environment/shell — never paste a URL into a file or a commit.
# Export it in the shell you will use, or let psql prompt for the password:
export PROD_DATABASE_URL='postgresql://USER@HOST:5432/DBNAME?sslmode=require'
```

Record the Postgres version the probe prints — it decides one flag in Step 4:

- **PG 12 or newer** → use `--single-transaction` everywhere (recommended).
- **PG 11 or older** → run `0016` **without** `--single-transaction` (it contains
  `ALTER TYPE … ADD VALUE`, which older servers reject inside a transaction block).

## Step 1 — Find out what production actually has (READ-ONLY)

```bash
cd /path/to/nexora
psql "$PROD_DATABASE_URL" -f production-migration-check.sql | tee prod-schema-before.txt
```

This script contains only `SELECT` / `DO`-with-`SELECT` / `\echo` statements — it creates, alters,
and deletes nothing, and is safe to run repeatedly. It reports:

1. a per-migration verdict (`APPLIED (complete)` / `MISSING` / `PARTIAL — investigate`);
2. the exact missing objects;
3. whether the whole schema (31 tables / 18 enum types) is present, so drift outside 0012–0017 can't hide;
4. a row-count snapshot (compare before/after);
5. data pre-checks for the two statements that can fail or delete rows.

## Step 2 — Decide

| Probe verdict | Action |
|---|---|
| `APPLIED (complete)` | **Skip the file.** Do not re-run (see the matrix below). |
| `MISSING` | Apply the file, in order. |
| `PARTIAL — investigate` | Stop. Some of that migration's objects exist. Send me the `1b` output before applying anything. |

## Step 3 — Back up first (0014 deletes rows)

```bash
pg_dump "$PROD_DATABASE_URL" --no-owner --no-privileges -Fc \
  -f "prod-backup-$(date +%Y%m%d-%H%M%S).dump"
```

If your provider has snapshots / point-in-time recovery (Neon, Supabase, RDS, …), take one of those
as well — it is faster to restore than a dump. **`0014` contains a `DELETE`** (it removes older
duplicate `resume_files` rows for the same student + content hash, keeping the newest). The probe's
section 5 tells you how many rows that would affect *before* you run it.

## Step 4 — Dry run each file it cannot persist

Any of the six files can be validated against production **without persisting anything** by running
it inside a transaction that is rolled back:

```bash
cd frontend
psql "$PROD_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
\echo '--- dry run: 0017 (rolled back) ---'
BEGIN;
\i src/db/migrations/0017_phase_17_simulation_schema.sql
ROLLBACK;
SQL
```

A clean run (no errors, `ROLLBACK`) means the real apply will succeed. If it errors, **stop** and
report the error — nothing was changed.

Caveat: on PG ≤ 11 skip this for `0016` (enum `ADD VALUE` cannot run in a transaction block there).

## Step 5 — Apply, ascending, one file at a time

Only the files Step 2 marked `MISSING` / `PARTIAL`. Remove lines for ones already applied.

```bash
cd frontend

psql "$PROD_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f src/db/migrations/0012_phase_11b_multiple_target_roles.sql
psql "$PROD_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f src/db/migrations/0013_phase_18_resume_intelligence.sql
psql "$PROD_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f src/db/migrations/0014_resume_upload_retry_fix.sql
psql "$PROD_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f src/db/migrations/0015_phase_19_applications.sql
psql "$PROD_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f src/db/migrations/0016_phase_20_outcome_intelligence.sql   # PG<=11: drop --single-transaction
psql "$PROD_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f src/db/migrations/0017_phase_17_simulation_schema.sql
```

- `ON_ERROR_STOP=1` → psql stops at the first error instead of sailing on.
- `--single-transaction` → that whole file applies **or rolls back as a unit**, so a failure never
  leaves a half-applied migration.
- `0017` is the one that resolves the outage, even though it is numbered last.

### Idempotency matrix — what happens if a file is run again

| File | Re-run safe? | Why |
|---|---|---|
| `0012` | **Yes** | `DROP INDEX IF EXISTS` + `CREATE INDEX IF NOT EXISTS`. Also drops the pre-0012 single-target index. |
| `0013` | **No** | `CREATE TABLE` / `CREATE TYPE` / `CREATE INDEX` without `IF NOT EXISTS` → `already exists` errors. Skip it if the probe says applied. |
| `0014` | Re-runnable but **data-modifying** | `DELETE` dedupe + `DROP INDEX IF EXISTS` + `CREATE UNIQUE INDEX IF NOT EXISTS`. Only needed if the probe reports `resume_files_user_hash_key` missing. Requires `0013` first. |
| `0015` | **No** | Same as `0013` (5 tables, 5 types, 15 indexes, no `IF NOT EXISTS`). |
| `0016` | **Yes** | `ADD VALUE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`. Safe to re-run. |
| `0017` | **Yes** | Same idempotent style; verified applied 3× in a row cleanly. |

### Locking note

The DDL is additive (new tables/types/columns). `CREATE INDEX` / `CREATE UNIQUE INDEX` take a brief
write lock on the table being indexed — milliseconds on tables of this size; the probe's section 4
shows the row counts. If you prefer zero blocking, apply during a quiet window rather than editing
the migration files.

## Step 6 — Verify

```bash
# 1. Schema: everything should now read APPLIED (complete), 0 missing objects
psql "$PROD_DATABASE_URL" -f production-migration-check.sql | tee prod-schema-after.txt

# 2. Compare the row-count snapshot in section 4 of before/after
diff <(sed -n '/4. ROW-COUNT/,$p' prod-schema-before.txt) \
     <(sed -n '/4. ROW-COUNT/,$p' prod-schema-after.txt)
```

Then, in the browser:

1. `/dashboard` → renders (readiness card, Execution OS, **Placement Simulation** card, Application Pipeline) — **no** `ERR_500_SYSTEM_FAULT`, no digest;
2. `/roadmap`, `/applications`, `/outcomes`, `/resume`, `/profile`, `/simulation` → all render;
3. Vercel runtime logs → `relation "placement_simulations" does not exist` no longer appears;
4. Sign in / sign out still work (auth is untouched by these migrations).

## If something goes wrong

- A file failed and `--single-transaction` was used → that file changed nothing; fix the cause and retry. Nothing to undo.
- A file failed **without** `--single-transaction` (only relevant for `0016` on PG ≤ 11) → re-run the probe; apply the missing objects from that file by hand if needed, then re-run it.
- A migration applied but the app still fails → compare the probe's section 3: any table/type still listed as missing is the cause. Report it; do not improvise DDL.

## Deploy gate — how the build now blocks this class of outage

This is the second production dashboard outage caused by the same thing: code deployed ahead of a
hand-applied schema. `frontend/scripts/verify-schema.mjs` now runs automatically before every build
(`package.json` → `"prebuild": "npm run verify:schema"`), so a deploy that would ship ahead of the
schema **fails instead of shipping**:

```bash
cd frontend
npm run verify:schema     # run it directly;  npm run build runs it automatically
```

What it checks, and why both halves matter:

1. **Static parity (always, no database needed).** Every table and enum type declared in
   `src/db/schema.ts` must be created by some `src/db/migrations/*.sql` file. This is the check that
   would have caught Phase 17 — those tables were declared but no migration could ever create them.
2. **Live schema (when `DATABASE_URL` is reachable).** Every declared table/enum must exist in that
   database, and no live table may be absent from the migration set. This is what stops a deploy
   when the database is behind the code, and it prints the exact migration files to apply.

Behaviour worth knowing:

- Exit code is **1** on drift (the build aborts before compiling) and **0** when clean.
- If `DATABASE_URL` is unset or the database is unreachable, the live half is **skipped with a
  warning** — an unreachable database is not evidence of drift, so it does not block local or CI
  builds. The static half always runs.
- It reads `.env.local` / `.env.production.local` / `.env` itself (values are never printed),
  because `prebuild` runs as its own process before Next.js loads them.
- On Vercel, make sure the project's build command is `npm run build` — `prebuild` then runs
automatically. `DATABASE_URL` must be present in the build environment for the live half to run.

Related: `frontend/src/test/migration-schema-parity.ts` (19 assertions) covers the same parity plus
the dashboard's degrade-don't-crash contract, and is the right thing to run in CI alongside the
phase test suites.

### Why the gate does not apply migrations automatically

Auto-applying on deploy is unsafe here: `0013` and `0015` are **not** idempotent, so concurrent or
repeated builds would error, and a build-time migration would run with whatever credentials and
concurrency the platform chooses. The gate blocks and names the files; applying them stays an
explicit, ordered, verified act (Steps 4–6 above).
