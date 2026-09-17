-- Phase 20 — Placement Outcome Intelligence (additive only).
-- 1. New timeline event type for recorded outcomes (never synthesized later).
ALTER TYPE "application_event_type" ADD VALUE IF NOT EXISTS 'OUTCOME_RECORDED';

-- 2. Optional student-reported interview feedback (student_note evidence).
ALTER TABLE "application_interviews"
  ADD COLUMN IF NOT EXISTS "difficulty" text,
  ADD COLUMN IF NOT EXISTS "topics_discussed" jsonb,
  ADD COLUMN IF NOT EXISTS "student_confidence" text,
  ADD COLUMN IF NOT EXISTS "questions_remembered" jsonb;

-- 3. Post-outcome student reflection (one per application, student-reported only).
CREATE TABLE IF NOT EXISTS "application_reflections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "application_id" uuid NOT NULL REFERENCES "applications"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "what_went_well" text,
  "what_was_difficult" text,
  "what_was_asked" text,
  "what_would_improve" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "application_reflections_application_unique" ON "application_reflections" ("application_id");
CREATE INDEX IF NOT EXISTS "application_reflections_user_idx" ON "application_reflections" ("user_id");
