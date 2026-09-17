-- Phase 24 — Adaptive Study Planner Schema
--
-- Adds server-authoritative tables and enums for Phase 24 Adaptive Study Planner.
-- Supports personalized, evidence-driven study scheduling, time budgeting,
-- spaced repetition, and adaptive reassessment tracking.
--
-- Additive and idempotent: safe on fresh and existing databases.

DO $$ BEGIN
  CREATE TYPE "study_plan_status" AS ENUM (
    'ACTIVE',
    'ARCHIVED',
    'RECALIBRATED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "study_plan_item_category" AS ENUM (
    'FIX',
    'REINFORCE',
    'REVIEW',
    'ASSESSMENT',
    'PRACTICE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "study_plan_item_status" AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'PARTIALLY_COMPLETED',
    'COMPLETED',
    'MISSED',
    'RESCHEDULED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "study_plan_priority" AS ENUM (
    'CRITICAL',
    'HIGH',
    'MEDIUM',
    'LOW',
    'MONITOR',
    'INSUFFICIENT_EVIDENCE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "adaptive_study_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "plan_version" integer DEFAULT 1 NOT NULL,
  "status" "study_plan_status" DEFAULT 'ACTIVE' NOT NULL,
  "planning_horizon" varchar(32) DEFAULT '7_days' NOT NULL,
  "available_minutes_per_day" integer,
  "constraints" jsonb,
  "summary" text,
  "generated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "valid_from" timestamp with time zone DEFAULT now() NOT NULL,
  "valid_until" timestamp with time zone,
  "recalibrated_at" timestamp with time zone,
  "recalibration_reason" text
);

CREATE TABLE IF NOT EXISTS "study_plan_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "plan_id" uuid NOT NULL REFERENCES "adaptive_study_plans" ("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "domain" varchar(64) NOT NULL,
  "topic" varchar(128) NOT NULL,
  "topic_id" uuid REFERENCES "topics" ("id") ON DELETE SET NULL,
  "category" "study_plan_item_category" NOT NULL,
  "priority" "study_plan_priority" NOT NULL,
  "estimated_minutes" integer NOT NULL,
  "scheduled_date" varchar(10) NOT NULL,
  "sequence" integer NOT NULL,
  "reason" text NOT NULL,
  "evidence" text NOT NULL,
  "execution_action_id" varchar(128),
  "status" "study_plan_item_status" DEFAULT 'PENDING' NOT NULL,
  "completed_at" timestamp with time zone,
  "metadata" jsonb
);

CREATE INDEX IF NOT EXISTS "adaptive_study_plans_user_idx" ON "adaptive_study_plans" ("user_id");
CREATE INDEX IF NOT EXISTS "adaptive_study_plans_user_status_idx" ON "adaptive_study_plans" ("user_id", "status");
CREATE INDEX IF NOT EXISTS "adaptive_study_plans_generated_idx" ON "adaptive_study_plans" ("generated_at");

CREATE INDEX IF NOT EXISTS "study_plan_items_plan_idx" ON "study_plan_items" ("plan_id");
CREATE INDEX IF NOT EXISTS "study_plan_items_user_date_idx" ON "study_plan_items" ("user_id", "scheduled_date");
CREATE INDEX IF NOT EXISTS "study_plan_items_status_idx" ON "study_plan_items" ("status");
