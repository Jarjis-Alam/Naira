-- ============================================================================
-- NEXORA / PLACEMENT OS — PRODUCTION MIGRATION STATE CHECK
-- ============================================================================
--
-- READ-ONLY. This file contains only SELECT / \echo / \pset statements:
-- it creates nothing, alters nothing, and deletes nothing. It is safe to run
-- against production, and safe to run repeatedly.
--
-- It answers, from the database's own catalog (never from a journal table —
-- drizzle's __drizzle_migrations is empty in this project because migrations
-- are applied by hand):
--
--   1. Which of migrations 0012 .. 0017 are APPLIED / MISSING / PARTIAL.
--   2. Exactly which objects are missing, if any.
--   3. Whether the whole schema (31 tables / 18 enum types) is present, so
--      drift outside 0012-0017 cannot hide.
--   4. A row-count snapshot to compare before/after an apply.
--
-- Usage (values come from your environment; never paste a URL into a file):
--   psql "$PROD_DATABASE_URL" -f production-migration-check.sql
--   psql "$PROD_DATABASE_URL" -f production-migration-check.sql > prod-schema-before.txt
--
-- Interpreting it: apply ONLY the migrations this reports as MISSING or
-- PARTIAL, in ascending order. See PRODUCTION-MIGRATION-RUNBOOK.md.
-- ============================================================================

\pset pager off
\timing off

\echo ''
\echo '========================================================================'
\echo ' 0. ENVIRONMENT (no secrets)'
\echo '========================================================================'
select
  current_database()                as database,
  current_user                      as db_user,
  current_setting('server_version') as pg_version,
  now()                             as checked_at,
  current_setting('TimeZone')       as timezone;

\echo ''
\echo '========================================================================'
\echo ' 1. MIGRATION VERDICT — 0012 .. 0017'
\echo '========================================================================'
with expected(migration, kind, object_name) as (
  values
    -- 0012 — Phase 11B multiple target roles (index-only migration)
    ('0012', 'index', 'student_target_roles_user_role_idx'),
    ('0012', 'index', 'student_target_roles_single_primary_idx'),
    -- 0013 — Phase 18 resume intelligence (5 tables + 5 enum types)
    ('0013', 'table', 'resume_files'),
    ('0013', 'table', 'resume_variants'),
    ('0013', 'table', 'resume_analyses'),
    ('0013', 'table', 'resume_suggestions'),
    ('0013', 'table', 'resume_versions'),
    ('0013', 'type',  'resume_parse_status'),
    ('0013', 'type',  'resume_variant_status'),
    ('0013', 'type',  'resume_suggestion_status'),
    ('0013', 'type',  'resume_file_format'),
    ('0013', 'type',  'resume_evidence_source'),
    -- 0014 — resume upload retry fix (one unique index; also dedupes rows)
    ('0014', 'index', 'resume_files_user_hash_key'),
    -- 0015 — Phase 19 applications (5 tables + 5 enum types)
    ('0015', 'table', 'applications'),
    ('0015', 'table', 'application_events'),
    ('0015', 'table', 'application_interviews'),
    ('0015', 'table', 'application_assessments'),
    ('0015', 'table', 'application_offers'),
    ('0015', 'type',  'application_status'),
    ('0015', 'type',  'application_event_type'),
    ('0015', 'type',  'application_interview_type'),
    ('0015', 'type',  'application_interview_result'),
    ('0015', 'type',  'application_assessment_status'),
    -- 0016 — Phase 20 outcome intelligence (1 table + 4 columns + 1 enum value)
    ('0016', 'table',  'application_reflections'),
    ('0016', 'column', 'application_interviews.difficulty'),
    ('0016', 'column', 'application_interviews.topics_discussed'),
    ('0016', 'column', 'application_interviews.student_confidence'),
    ('0016', 'column', 'application_interviews.questions_remembered'),
    ('0016', 'enum_value', 'application_event_type.OUTCOME_RECORDED'),
    -- 0017 — Phase 17 placement simulation schema (the outage fix)
    ('0017', 'table', 'placement_simulations'),
    ('0017', 'table', 'placement_simulation_rounds'),
    ('0017', 'type',  'simulation_status'),
    ('0017', 'type',  'simulation_round_type'),
    ('0017', 'type',  'simulation_round_status'),
    ('0017', 'index', 'placement_simulations_user_id_idx'),
    ('0017', 'index', 'placement_simulations_status_idx'),
    ('0017', 'index', 'placement_simulation_rounds_sim_round_idx'),
    ('0017', 'index', 'placement_simulation_rounds_simulation_id_idx')
),
resolved as (
  select
    e.migration,
    e.kind,
    e.object_name,
    case e.kind
      when 'table'      then to_regclass('public.' || e.object_name) is not null
      when 'index'      then to_regclass('public.' || e.object_name) is not null
      when 'type'       then to_regtype('public.'  || e.object_name) is not null
      when 'column'     then exists (
        select 1 from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name   = split_part(e.object_name, '.', 1)
          and c.column_name  = split_part(e.object_name, '.', 2)
      )
      when 'enum_value' then exists (
        select 1 from pg_enum en
        join pg_type t on t.oid = en.enumtypid
        where t.typname   = split_part(e.object_name, '.', 1)
          and en.enumlabel = split_part(e.object_name, '.', 2)
      )
      else false
    end as present
  from expected e
)
select
  migration                                                        as migration,
  count(*) filter (where present)                                   as found,
  count(*)                                                          as expected,
  case
    when count(*) filter (where present) = count(*) then 'APPLIED (complete)'
    when count(*) filter (where present) = 0        then 'MISSING'
    else 'PARTIAL — investigate before applying'
  end                                                               as verdict,
  case
    when count(*) filter (where present) = count(*) then 'skip'
    else 'APPLY (in order)'
  end                                                               as action
from resolved
group by migration
order by migration;

\echo ''
\echo '--- 1b. Objects that are MISSING (empty = nothing missing) ---'
with expected(migration, kind, object_name) as (
  values
    ('0012', 'index', 'student_target_roles_user_role_idx'),
    ('0012', 'index', 'student_target_roles_single_primary_idx'),
    ('0013', 'table', 'resume_files'),
    ('0013', 'table', 'resume_variants'),
    ('0013', 'table', 'resume_analyses'),
    ('0013', 'table', 'resume_suggestions'),
    ('0013', 'table', 'resume_versions'),
    ('0013', 'type',  'resume_parse_status'),
    ('0013', 'type',  'resume_variant_status'),
    ('0013', 'type',  'resume_suggestion_status'),
    ('0013', 'type',  'resume_file_format'),
    ('0013', 'type',  'resume_evidence_source'),
    ('0014', 'index', 'resume_files_user_hash_key'),
    ('0015', 'table', 'applications'),
    ('0015', 'table', 'application_events'),
    ('0015', 'table', 'application_interviews'),
    ('0015', 'table', 'application_assessments'),
    ('0015', 'table', 'application_offers'),
    ('0015', 'type',  'application_status'),
    ('0015', 'type',  'application_event_type'),
    ('0015', 'type',  'application_interview_type'),
    ('0015', 'type',  'application_interview_result'),
    ('0015', 'type',  'application_assessment_status'),
    ('0016', 'table',  'application_reflections'),
    ('0016', 'column', 'application_interviews.difficulty'),
    ('0016', 'column', 'application_interviews.topics_discussed'),
    ('0016', 'column', 'application_interviews.student_confidence'),
    ('0016', 'column', 'application_interviews.questions_remembered'),
    ('0016', 'enum_value', 'application_event_type.OUTCOME_RECORDED'),
    ('0017', 'table', 'placement_simulations'),
    ('0017', 'table', 'placement_simulation_rounds'),
    ('0017', 'type',  'simulation_status'),
    ('0017', 'type',  'simulation_round_type'),
    ('0017', 'type',  'simulation_round_status'),
    ('0017', 'index', 'placement_simulations_user_id_idx'),
    ('0017', 'index', 'placement_simulations_status_idx'),
    ('0017', 'index', 'placement_simulation_rounds_sim_round_idx'),
    ('0017', 'index', 'placement_simulation_rounds_simulation_id_idx')
),
resolved as (
  select
    e.migration, e.kind, e.object_name,
    case e.kind
      when 'table'      then to_regclass('public.' || e.object_name) is not null
      when 'index'      then to_regclass('public.' || e.object_name) is not null
      when 'type'       then to_regtype('public.'  || e.object_name) is not null
      when 'column'     then exists (
        select 1 from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name   = split_part(e.object_name, '.', 1)
          and c.column_name  = split_part(e.object_name, '.', 2)
      )
      when 'enum_value' then exists (
        select 1 from pg_enum en
        join pg_type t on t.oid = en.enumtypid
        where t.typname   = split_part(e.object_name, '.', 1)
          and en.enumlabel = split_part(e.object_name, '.', 2)
      )
      else false
    end as present
  from expected e
)
select migration, kind, object_name
from resolved
where not present
order by migration, kind, object_name;

\echo ''
\echo '========================================================================'
\echo ' 2. 0012 SPECIFIC — old single-role index must be GONE'
\echo '========================================================================'
select
  'student_target_roles_user_id_unique_idx (pre-0012)' as object_name,
  to_regclass('public.student_target_roles_user_id_unique_idx') is not null as still_present,
  case
    when to_regclass('public.student_target_roles_user_id_unique_idx') is null
      then 'ok — 0012 applied (or index never existed)'
    else '0012 NOT applied — the old single-target constraint is still enforced'
  end as note;

\echo ''
\echo '========================================================================'
\echo ' 3. FULL SCHEMA DRIFT — all 31 tables + 18 enum types the app expects'
\echo '========================================================================'
with expected_tables(name) as (
  values ('answers'),('application_assessments'),('application_events'),
         ('application_interviews'),('application_offers'),('application_reflections'),
         ('applications'),('attempt_questions'),('attempts'),('companies'),
         ('placement_simulation_rounds'),('placement_simulations'),('profiles'),
         ('question_pool_questions'),('question_pools'),('questions'),('resume_analyses'),
         ('resume_files'),('resume_suggestions'),('resume_variants'),('resume_versions'),
         ('roles'),('skill_scores'),('student_target_companies'),('student_target_roles'),
         ('subjects'),('test_questions'),('test_sections'),('tests'),('topics'),('users')
),
missing_tables as (
  select name from expected_tables
  where to_regclass('public.' || name) is null
),
expected_types(name) as (
  values ('application_assessment_status'),('application_event_type'),
         ('application_interview_result'),('application_interview_type'),
         ('application_status'),('attempt_status'),('difficulty'),('question_type'),
         ('resume_evidence_source'),('resume_file_format'),('resume_parse_status'),
         ('resume_suggestion_status'),('resume_variant_status'),
         ('simulation_round_status'),('simulation_round_type'),('simulation_status'),
         ('test_status'),('test_type')
),
missing_types as (
  select name from expected_types
  where to_regtype('public.' || name) is null
)
select
  (select count(*) from expected_tables)                    as tables_expected,
  (select count(*) from expected_tables) -
    (select count(*) from missing_tables)                   as tables_present,
  (select count(*) from missing_tables)                     as tables_missing,
  coalesce((select string_agg(name, ', ' order by name) from missing_tables), '(none)') as missing_table_names,
  (select count(*) from expected_types)                     as types_expected,
  (select count(*) from expected_types) -
    (select count(*) from missing_types)                    as types_present,
  (select count(*) from missing_types)                      as types_missing,
  coalesce((select string_agg(name, ', ' order by name) from missing_types), '(none)') as missing_type_names;

\echo ''
\echo '--- 3b. Any public table that is NOT part of the expected schema (informational) ---'
select t.tablename
from pg_tables t
where t.schemaname = 'public'
  and t.tablename not in (
    'answers','application_assessments','application_events','application_interviews',
    'application_offers','application_reflections','applications','attempt_questions',
    'attempts','companies','placement_simulation_rounds','placement_simulations',
    'profiles','question_pool_questions','question_pools','questions','resume_analyses',
    'resume_files','resume_suggestions','resume_variants','resume_versions','roles',
    'skill_scores','student_target_companies','student_target_roles','subjects',
    'test_questions','test_sections','tests','topics','users'
  )
order by t.tablename;

\echo ''
\echo '========================================================================'
\echo ' 4. ROW-COUNT SNAPSHOT (compare after applying; approximate for live DBs)'
\echo '========================================================================'
select relname as table_name, n_live_tup as approx_rows
from pg_stat_user_tables
order by relname;

\echo ''
\echo '========================================================================'
\echo ' 5. DATA PRE-CHECKS (read-only) for the two statements that can fail/delete'
\echo '========================================================================'
\echo '--- 0012: students with MORE THAN ONE primary target role ---'
\echo '    (>0 would make 0012 fail on student_target_roles_single_primary_idx)'
do $$
declare
  n integer;
begin
  if to_regclass('public.student_target_roles') is null then
    raise notice 'student_target_roles does not exist — 0011 not applied; apply 0011 first';
    return;
  end if;
  execute 'select count(*) from (select user_id from student_target_roles where is_primary group by user_id having count(*) > 1) d' into n;
  raise notice 'students with multiple primary roles: %  (0 = 0012 will succeed)', n;
end $$;

\echo '--- 0014: duplicate (user_id, content_hash) resume uploads ---'
\echo '    (these rows WOULD BE DELETED by 0014, keeping the newest per pair)'
do $$
declare
  n integer;
begin
  if to_regclass('public.resume_files') is null then
    raise notice 'resume_files does not exist — 0013 not applied; apply 0013 before 0014';
    return;
  end if;
  execute 'select count(*) from (select user_id, content_hash from resume_files group by 1,2 having count(*) > 1) d' into n;
  raise notice 'duplicate (user_id, content_hash) groups that 0014 would dedupe: %', n;
end $$;

do $$
declare
  n integer;
begin
  if to_regclass('public.resume_files') is null then
    return;
  end if;
  execute 'select count(*) from resume_files' into n;
  raise notice 'resume_files total rows: % (back these up before 0014 if > 0)', n;
end $$;

\echo ''
\echo '------------------------------------------------------------------------'
\echo ' NEXT STEP: apply only the migrations reported MISSING/PARTIAL, ascending.'
\echo ' See PRODUCTION-MIGRATION-RUNBOOK.md for the exact commands and order.'
\echo '------------------------------------------------------------------------'
\echo ''
