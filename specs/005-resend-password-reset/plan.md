# Technical Plan: Real Password Reset Emails with Resend

**Feature**: `005-resend-password-reset`
**Status**: Approved
**Target**: NAIRA Auth & Transactional Email Subsystem

---

## 1. Architectural Strategy & Design

```
[Browser: /auth/login] ──(POST /api/auth/forgot-password)──▶ [Forgot Password Route Handler]
                                                                      │
                                              ┌───────────────────────┴───────────────────────┐
                                      [User Exists?]                                   [User Missing]
                                             │                                                │
                                    Generate 32-byte token                                    │
                                    SHA-256 hash token                                        │
                                    Store in DB (1hr exp)                                     │
                                    Dispatch email via Resend                                 │
                                             │                                                │
                                             └───────────────────────┬────────────────────────┘
                                                                     ▼
                                                    Generic Anti-Enumeration Response
                                                                     │
[Student Inbox] ──(Click Reset Link)──▶ [Browser: /auth/reset-password?token=...]
                                                                     │
                                                    (POST /api/auth/reset-password)
                                                                     │
                                                                     ▼
                                                    [Reset Password Route Handler]
                                                                     │
                                                    1. SHA-256 hash supplied token
                                                    2. Lookup in password_reset_tokens
                                                    3. Verify: exists, not expired, unused
                                                    4. Validate new password length >= 6
                                                    5. bcryptjs.hash(newPassword, 12)
                                                    6. UPDATE users SET password_hash = ...
                                                    7. UPDATE password_reset_tokens SET used_at = now()
                                                    8. Return HTTP 200 Success
```

---

## 2. Database Design & Migration Specification

### Migration File: `frontend/src/db/migrations/0020_phase_27_password_reset_tokens.sql`
```sql
-- Phase 27: NAIRA Password Reset Tokens
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
```

### Schema Registration: `frontend/src/db/schema.ts`
Export `passwordResetTokens = pgTable(...)` adhering to Drizzle conventions with foreign key reference to `users.id` and index definitions matching the migration.

### Migration Journal: `frontend/src/db/migrations/meta/_journal.json`
Append entry:
```json
{
  "idx": 20,
  "version": "7",
  "when": 1789200000000,
  "tag": "0020_phase_27_password_reset_tokens",
  "breakpoints": true
}
```

---

## 3. Email Delivery Engine (`frontend/src/server/email.ts`)

- **Provider**: Resend SDK (`import { Resend } from "resend"`).
- **Environment Resolution**:
  - `RESEND_API_KEY`: Server-side API key.
  - `EMAIL_FROM`: Configurable sender (default: `NAIRA <onboarding@resend.dev>`).
  - `NEXT_PUBLIC_APP_URL`: Canonical base URL (fallback: `http://localhost:3000`).
- **Template**:
  - Technical monochrome layout matching NAIRA brand.
  - Dark container (`#0c0d0e`), white high-contrast CTA button, monospace telemetry notes, clear expiration warning (1 hour), and security disclaimer.
- **Fail-Safe Operation**:
  - If Resend API fails (e.g. invalid key or network issue), log the error server-side without exposing internal provider details to the API response.

---

## 4. API Endpoints

### 4.1. `POST /api/auth/forgot-password`
- **Rate Limit**: 5 requests per minute per IP via `checkRateLimit("forgot_pw_" + ip, { limit: 5, windowMs: 60000 })`.
- **Validation**: Email required and valid syntax via Zod.
- **Processing**:
  - Normalize: `email.toLowerCase().trim()`.
  - Lookup user in `users`.
  - If user exists:
    - Invalidate existing active tokens for this user (`used_at = now()`).
    - Generate raw token: `crypto.randomBytes(32).toString('hex')`.
    - Compute SHA-256 hash: `crypto.createHash('sha256').update(rawToken).digest('hex')`.
    - Insert into `password_reset_tokens` with `expires_at = now() + 1 hour`.
    - Construct reset URL: `${baseUrl}/auth/reset-password?token=${rawToken}`.
    - Dispatch email via `sendPasswordResetEmail(email, resetUrl)`.
  - Return HTTP 200 with `{ "message": "If an account exists for this email, a password recovery link has been sent." }`.

### 4.2. `POST /api/auth/reset-password`
- **Rate Limit**: 10 requests per minute per IP.
- **Validation**:
  - `token`: non-empty string.
  - `password`: string with length >= 6.
- **Processing**:
  - Hash incoming token with SHA-256.
  - Query `password_reset_tokens` where `token_hash == hash` and `used_at IS NULL` and `expires_at > now()`.
  - If no record: return HTTP 400 with `{ "error": "Invalid or expired password reset link." }`.
  - If valid record:
    - Hash new password: `bcrypt.hash(password, 12)`.
    - Update `users` table: set `password_hash = hash` for `user_id`.
    - Mark token as consumed: set `used_at = now()`.
    - Return HTTP 200 with `{ "message": "Password has been successfully updated. You may now sign in." }`.

---

## 5. UI Implementation

### 5.1. Update `frontend/src/app/auth/login/page.tsx`
- Connect `handleForgotPassword` to `POST /api/auth/forgot-password`.
- If email is empty, set prompt error asking student to provide email.
- Display loading state during submission.
- On completion, display generic message in polite notification banner.

### 5.2. New Page: `frontend/src/app/auth/reset-password/page.tsx`
- URL pattern: `/auth/reset-password?token=...`
- State machine:
  - Missing token: Display invalid link state with "Return to sign in".
  - Active form: "New Password", "Confirm Password", show/hide toggle, password requirement pill, "Reset Password" button.
  - Submitting: Disabled button with spinner / "Updating...".
  - Success: Success badge, message, "Sign In" button redirecting to `/auth/login`.
  - Error: Clean red alert banner with error message.
- Design: Strict adherence to NAIRA technical monochrome (obsidian `#08090a`, card `#121316`, hairline `#27282d`, white contrast accents).

---

## 6. Security Analysis & Invariants

1. **Entropy**: 256 bits of CSPRNG entropy via `crypto.randomBytes(32)`.
2. **One-Way Storage**: Raw token is NEVER stored or logged; database stores only SHA-256 digest (`varchar(64)`).
3. **Single-Use**: DB update stamps `used_at`; subsequent queries filter on `used_at IS NULL`.
4. **Time-Limited**: Expiration set to exactly 60 minutes.
5. **Anti-Enumeration**: Both endpoints mask account existence. Timing difference minimized.
6. **Rate Limiting**: Sliding window protects against brute-force and email spamming.
7. **Password Hashing**: Bcrypt with work factor 12 (same as registration).

---

## 7. Verification Gates
1. Database migration applied idempotently to local Postgres.
2. `npm run verify:schema`: PASS (100% parity).
3. `npx tsc --noEmit`: 0 errors.
4. `npm run lint`: PASS (0 errors).
5. Automated test suite `src/test/password-reset-e2e.ts` covering 16 scenarios: PASS.
