-- Phase 17 — Placement Simulation schema (previously missing a migration file).
--
-- These two relations (and the three enum types they use) were declared in
-- `src/db/schema.ts` but never shipped as a migration: they reached a database
-- only through `drizzle-kit push`. Any database built purely from
-- `src/db/migrations/*.sql` — which is how production is provisioned — therefore
-- lacked them, and `/dashboard` (which calls `getStudentSimulationHistory` on
-- every load) failed with `relation "placement_simulations" does not exist`,
-- surfacing to the browser as ERR_500_SYSTEM_FAULT.
--
-- Additive and idempotent: safe to re-run, and safe on a database that already
-- has these objects from a previous `push`.

DO $$ BEGIN
  CREATE TYPE "simulation_status" AS ENUM (
    'not_started',
    'in_progress',
    'round_completed',
    'paused',
    'completed',
    'abandoned'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "simulation_round_type" AS ENUM (
    'screening',
    'coding',
    'debugging',
    'tech_interview',
    'hr_interview'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "simulation_round_status" AS ENUM (
    'locked',
    'unlocked',
    'in_progress',
    'completed',
    'skipped'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "placement_simulations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "company_id" uuid REFERENCES "companies" ("id") ON DELETE SET NULL,
  "company_name" varchar(255) NOT NULL,
  "role_id" uuid REFERENCES "roles" ("id") ON DELETE SET NULL,
  "role_name" varchar(255) NOT NULL,
  "status" "simulation_status" DEFAULT 'in_progress' NOT NULL,
  "is_generalized_role" boolean DEFAULT false NOT NULL,
  "current_round_order" integer DEFAULT 1 NOT NULL,
  "total_rounds" integer DEFAULT 5 NOT NULL,
  "overall_readiness_score" real,
  "aptitude_score" real,
  "technical_score" real,
  "coding_score" real,
  "debugging_score" real,
  "interview_score" real,
  "hr_score" real,
  "readiness_level" varchar(50),
  "eligibility_check" jsonb,
  "summary_report" jsonb,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "placement_simulation_rounds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "simulation_id" uuid NOT NULL REFERENCES "placement_simulations" ("id") ON DELETE CASCADE,
  "round_number" integer NOT NULL,
  "round_type" "simulation_round_type" NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text,
  "status" "simulation_round_status" DEFAULT 'locked' NOT NULL,
  "score" real,
  "max_score" real,
  "accuracy" real,
  "duration_minutes" integer DEFAULT 30,
  "time_taken_seconds" integer DEFAULT 0,
  "test_id" uuid REFERENCES "tests" ("id") ON DELETE SET NULL,
  "attempt_id" uuid REFERENCES "attempts" ("id") ON DELETE SET NULL,
  "round_data" jsonb,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "placement_simulations_user_id_idx"
  ON "placement_simulations" ("user_id");

CREATE INDEX IF NOT EXISTS "placement_simulations_status_idx"
  ON "placement_simulations" ("status");

CREATE UNIQUE INDEX IF NOT EXISTS "placement_simulation_rounds_sim_round_idx"
  ON "placement_simulation_rounds" ("simulation_id", "round_number");

CREATE INDEX IF NOT EXISTS "placement_simulation_rounds_simulation_id_idx"
  ON "placement_simulation_rounds" ("simulation_id");
