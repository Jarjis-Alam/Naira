-- Phase 27: NAIRA Password Reset Tokens Migration
-- Creates password_reset_tokens table with secure hashing, expiration, and index optimization.

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "token_hash" varchar(64) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_hash_unique" ON "password_reset_tokens"("token_hash");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_idx" ON "password_reset_tokens"("user_id");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_expires_idx" ON "password_reset_tokens"("expires_at");
