-- ============================================================================
-- Phase 19 — Placement Application OS
--
-- Adds the application-management domain:
--   applications             unified placement application pipeline records
--   application_events       append-only timeline (never fabricated)
--   application_interviews   interview round tracking per application
--   application_assessments  assessment tracking per application
--   application_offers       user-provided offer records
--
-- Company/role names are snapshotted onto the application so history stays
-- accurate even if the catalog later changes. Catalog ids are advisory
-- references (ON DELETE SET NULL) — the snapshot is the source of truth.
-- ============================================================================

CREATE TYPE "public"."application_status" AS ENUM('INTERESTED', 'ELIGIBLE', 'APPLIED', 'ASSESSMENT', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."application_event_type" AS ENUM('APPLICATION_CREATED', 'STATUS_CHANGED', 'DEADLINE_ADDED', 'DEADLINE_CHANGED', 'RESUME_ATTACHED', 'ASSESSMENT_SCHEDULED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'OFFER_RECEIVED', 'REJECTED', 'WITHDRAWN', 'REOPENED', 'NOTE_ADDED', 'JD_ATTACHED');--> statement-breakpoint
CREATE TYPE "public"."application_interview_type" AS ENUM('Technical', 'Coding', 'HR', 'Managerial', 'Behavioral', 'Group Discussion', 'Other');--> statement-breakpoint
CREATE TYPE "public"."application_interview_result" AS ENUM('pending', 'cleared', 'not_cleared', 'awaiting_result');--> statement-breakpoint
CREATE TYPE "public"."application_assessment_status" AS ENUM('scheduled', 'completed', 'missed', 'expired');--> statement-breakpoint

CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"company_id" uuid,
	"company_name" varchar(255) NOT NULL,
	"role_id" uuid,
	"role_name" varchar(255) NOT NULL,
	"job_description" text,
	"source" varchar(120),
	"status" "application_status" DEFAULT 'INTERESTED' NOT NULL,
	"applied_at" timestamp with time zone,
	"deadline" timestamp with time zone,
	"assessment_deadline" timestamp with time zone,
	"interview_date" timestamp with time zone,
	"offer_deadline" timestamp with time zone,
	"location" varchar(255),
	"employment_type" varchar(60),
	"package_text" varchar(120),
	"notes" text,
	"resume_variant_id" uuid,
	"resume_label" varchar(255),
	"resume_ats_score" real,
	"resume_match_score" real,
	"reopened_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" "application_event_type" NOT NULL,
	"previous_status" "application_status",
	"new_status" "application_status",
	"title" varchar(255),
	"metadata" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"round_type" "application_interview_type" NOT NULL,
	"scheduled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"result" "application_interview_result" DEFAULT 'pending' NOT NULL,
	"interviewer_notes" text,
	"user_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"assessment_type" varchar(120),
	"scheduled_at" timestamp with time zone,
	"deadline" timestamp with time zone,
	"status" "application_assessment_status" DEFAULT 'scheduled' NOT NULL,
	"score_text" varchar(120),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"role_name" varchar(255) NOT NULL,
	"offer_date" timestamp with time zone,
	"compensation_text" varchar(255),
	"location" varchar(255),
	"joining_date" timestamp with time zone,
	"offer_deadline" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "applications_user_status_idx" ON "applications" ("user_id","status");--> statement-breakpoint
CREATE INDEX "applications_user_deadline_idx" ON "applications" ("user_id","deadline");--> statement-breakpoint
CREATE INDEX "applications_user_updated_idx" ON "applications" ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "applications_company_idx" ON "applications" ("company_id");--> statement-breakpoint
CREATE INDEX "applications_role_idx" ON "applications" ("role_id");--> statement-breakpoint
CREATE INDEX "application_events_application_time_idx" ON "application_events" ("application_id","occurred_at");--> statement-breakpoint
CREATE INDEX "application_events_user_idx" ON "application_events" ("user_id");--> statement-breakpoint
CREATE INDEX "application_interviews_application_idx" ON "application_interviews" ("application_id","round_number");--> statement-breakpoint
CREATE INDEX "application_interviews_user_idx" ON "application_interviews" ("user_id");--> statement-breakpoint
CREATE INDEX "application_interviews_scheduled_idx" ON "application_interviews" ("user_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "application_assessments_application_idx" ON "application_assessments" ("application_id");--> statement-breakpoint
CREATE INDEX "application_assessments_user_idx" ON "application_assessments" ("user_id");--> statement-breakpoint
CREATE INDEX "application_assessments_deadline_idx" ON "application_assessments" ("user_id","deadline");--> statement-breakpoint
CREATE INDEX "application_offers_application_idx" ON "application_offers" ("application_id");--> statement-breakpoint
CREATE INDEX "application_offers_user_idx" ON "application_offers" ("user_id");
