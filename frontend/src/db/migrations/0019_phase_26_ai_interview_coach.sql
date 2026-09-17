-- Phase 26: NAIRA AI Interview Coach Migration
-- Creates interview_sessions, interview_turns, and interview_evaluations tables and enums.

DO $$ BEGIN
  CREATE TYPE "ai_interview_type" AS ENUM('TECHNICAL', 'HR', 'MIXED', 'ROLE_SPECIFIC');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ai_interview_session_status" AS ENUM('CREATED', 'ACTIVE', 'COMPLETED', 'ABANDONED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "interview_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "target_role_id" uuid REFERENCES "roles"("id") ON DELETE set null,
  "target_role_name" varchar(255) NOT NULL,
  "company_name" varchar(255),
  "interview_type" "ai_interview_type" NOT NULL,
  "status" "ai_interview_session_status" DEFAULT 'ACTIVE' NOT NULL,
  "current_round" integer DEFAULT 1 NOT NULL,
  "turn_count" integer DEFAULT 0 NOT NULL,
  "max_turns" integer DEFAULT 10 NOT NULL,
  "focus_area" varchar(255),
  "deterministic_context" jsonb,
  "provider" varchar(64) DEFAULT 'groq' NOT NULL,
  "model" varchar(128),
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "interview_turns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL REFERENCES "interview_sessions"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "turn_number" integer NOT NULL,
  "role" varchar(32) NOT NULL,
  "content" text NOT NULL,
  "qualitative_feedback" text,
  "detected_topics" jsonb,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "interview_evaluations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL REFERENCES "interview_sessions"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "overall_summary" text NOT NULL,
  "strengths" jsonb NOT NULL,
  "improvements" jsonb NOT NULL,
  "qualitative_scores" jsonb NOT NULL,
  "non_causal_observations" jsonb,
  "provenance" varchar(64) DEFAULT 'AI_EVALUATION' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "interview_sessions_user_idx" ON "interview_sessions"("user_id");
CREATE INDEX IF NOT EXISTS "interview_sessions_status_idx" ON "interview_sessions"("status");
CREATE INDEX IF NOT EXISTS "interview_sessions_created_idx" ON "interview_sessions"("created_at");

CREATE INDEX IF NOT EXISTS "interview_turns_session_idx" ON "interview_turns"("session_id");
CREATE INDEX IF NOT EXISTS "interview_turns_user_idx" ON "interview_turns"("user_id");
CREATE INDEX IF NOT EXISTS "interview_turns_turn_idx" ON "interview_turns"("session_id", "turn_number");

CREATE UNIQUE INDEX IF NOT EXISTS "interview_evaluations_session_unique" ON "interview_evaluations"("session_id");
CREATE INDEX IF NOT EXISTS "interview_evaluations_user_idx" ON "interview_evaluations"("user_id");
