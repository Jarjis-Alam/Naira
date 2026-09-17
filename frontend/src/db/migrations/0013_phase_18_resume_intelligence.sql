-- ============================================================================
-- Phase 18 — ATS Resume Intelligence
--
-- Adds the resume intelligence domain:
--   resume_files        raw private uploads (bytes stored in Postgres, never public)
--   resume_variants     targeted resume versions (target company/role + JD)
--   resume_analyses     append-only ATS / keyword / skill-match analysis runs
--   resume_suggestions  truth-verified before/after suggestions with accept/reject
--   resume_versions     meaningful resume snapshots for compare + history
-- ============================================================================

CREATE TYPE "public"."resume_parse_status" AS ENUM('pending', 'parsed', 'partial', 'failed');--> statement-breakpoint
CREATE TYPE "public"."resume_variant_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."resume_suggestion_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."resume_file_format" AS ENUM('pdf', 'docx', 'txt');--> statement-breakpoint
CREATE TYPE "public"."resume_evidence_source" AS ENUM('resume_detected', 'student_asserted', 'job_description_detected', 'ats_formatting');--> statement-breakpoint

CREATE TABLE "resume_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"file_format" "resume_file_format" NOT NULL,
	"byte_size" integer NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"data" "bytea" NOT NULL,
	"raw_text" text DEFAULT '' NOT NULL,
	"page_count" integer,
	"parse_status" "resume_parse_status" DEFAULT 'pending' NOT NULL,
	"parse_warnings" jsonb,
	"file_signals" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" varchar(255) NOT NULL,
	"target_company_id" uuid,
	"target_company_name" varchar(255),
	"target_role_id" uuid,
	"target_role_name" varchar(255),
	"source_file_id" uuid,
	"structured_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"job_description" jsonb,
	"ats_score" real,
	"ats_breakdown" jsonb,
	"match_score" real,
	"is_primary" boolean DEFAULT false NOT NULL,
	"status" "resume_variant_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"ats_score" real NOT NULL,
	"match_score" real,
	"breakdown" jsonb NOT NULL,
	"explanation" jsonb,
	"findings" jsonb,
	"keyword_analysis" jsonb,
	"skill_match" jsonb,
	"role_match" jsonb,
	"content_quality" jsonb,
	"parsing_checks" jsonb,
	"analyzed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"category" varchar(60) NOT NULL,
	"target" jsonb NOT NULL,
	"original_text" text,
	"suggested_text" text,
	"reason_what" text NOT NULL,
	"reason_why" text NOT NULL,
	"reason_evidence" text NOT NULL,
	"severity" varchar(20) DEFAULT 'info' NOT NULL,
	"actionable" boolean DEFAULT false NOT NULL,
	"verification" jsonb,
	"source" "resume_evidence_source" DEFAULT 'resume_detected' NOT NULL,
	"status" "resume_suggestion_status" DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"label" varchar(255) NOT NULL,
	"structured_data" jsonb NOT NULL,
	"ats_score" real,
	"match_score" real,
	"change_summary" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resume_files" ADD CONSTRAINT "resume_files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_variants" ADD CONSTRAINT "resume_variants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_variants" ADD CONSTRAINT "resume_variants_target_company_id_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_variants" ADD CONSTRAINT "resume_variants_target_role_id_roles_id_fk" FOREIGN KEY ("target_role_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_variants" ADD CONSTRAINT "resume_variants_source_file_id_resume_files_id_fk" FOREIGN KEY ("source_file_id") REFERENCES "public"."resume_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_analyses" ADD CONSTRAINT "resume_analyses_variant_id_resume_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."resume_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_analyses" ADD CONSTRAINT "resume_analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_suggestions" ADD CONSTRAINT "resume_suggestions_variant_id_resume_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."resume_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_suggestions" ADD CONSTRAINT "resume_suggestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_versions" ADD CONSTRAINT "resume_versions_variant_id_resume_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."resume_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_versions" ADD CONSTRAINT "resume_versions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resume_files_user_id_idx" ON "resume_files" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "resume_files_user_hash_idx" ON "resume_files" USING btree ("user_id","content_hash");--> statement-breakpoint
CREATE INDEX "resume_variants_user_id_idx" ON "resume_variants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "resume_variants_status_idx" ON "resume_variants" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "resume_variants_single_primary_idx" ON "resume_variants" USING btree ("user_id") WHERE "resume_variants"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "resume_analyses_variant_idx" ON "resume_analyses" USING btree ("variant_id","analyzed_at");--> statement-breakpoint
CREATE INDEX "resume_analyses_user_id_idx" ON "resume_analyses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "resume_suggestions_variant_status_idx" ON "resume_suggestions" USING btree ("variant_id","status");--> statement-breakpoint
CREATE INDEX "resume_suggestions_user_id_idx" ON "resume_suggestions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resume_versions_variant_number_idx" ON "resume_versions" USING btree ("variant_id","version_number");--> statement-breakpoint
CREATE INDEX "resume_versions_user_id_idx" ON "resume_versions" USING btree ("user_id");
