# Implementation Tasks: Real Password Reset Emails with Resend

**Feature**: `005-resend-password-reset`
**Status**: Completed
**Target**: NAIRA Authentication & Email Delivery

---

## Task Waves & Dependency Ordering

### Wave 1: Persistence & Schema Contract
- [x] **Task 1.1**: Create versioned database migration `frontend/src/db/migrations/0020_phase_27_password_reset_tokens.sql` with `password_reset_tokens` table, foreign keys, and indexes.
- [x] **Task 1.2**: Register migration 20 in `frontend/src/db/migrations/meta/_journal.json`.
- [x] **Task 1.3**: Add `passwordResetTokens` table definition to `frontend/src/db/schema.ts` matching migration contracts.
- [x] **Task 1.4**: Apply migration `0020` to local PostgreSQL database and verify with `npm run verify:schema`.

### Wave 2: Email Service & Server Infrastructure
- [x] **Task 2.1**: Implement `frontend/src/server/email.ts` with Resend client integration, environment variable resolution, and technical monochrome HTML template.
- [x] **Task 2.2**: Implement `POST /api/auth/forgot-password` in `frontend/src/app/api/auth/forgot-password/route.ts` with CSPRNG token generation, SHA-256 hashing, rate limiting, and generic anti-enumeration response.
- [x] **Task 2.3**: Implement `POST /api/auth/reset-password` in `frontend/src/app/api/auth/reset-password/route.ts` with token hash verification, expiration checks, bcryptjs work factor 12 hashing, and single-use invalidation.

### Wave 3: User Interface & Experience
- [x] **Task 3.1**: Connect `handleForgotPassword` in `frontend/src/app/auth/login/page.tsx` to `POST /api/auth/forgot-password` with loading state, email validation, and polite notification banner.
- [x] **Task 3.2**: Create reset password page `frontend/src/app/auth/reset-password/page.tsx` with token parameter parsing, show/hide password, live validation, error handling, success state, and NAIRA technical monochrome styling.

### Wave 4: Automated Verification & Testing
- [x] **Task 4.1**: Create `frontend/src/test/password-reset-e2e.ts` testing all 16 required scenarios:
  1. Forgot password with existing account
  2. Forgot password with nonexistent account
  3. Generic anti-enumeration response
  4. Invalid email format
  5. Token generation & entropy
  6. SHA-256 token hashing
  7. Expired token rejection
  8. Invalid token rejection
  9. Already-used token rejection
  10. Successful password reset
  11. Password hash change verification in DB
  12. Old password fails authentication
  13. New password succeeds authentication
  14. Reset token cannot be reused
  15. Email provider failure resilience
  16. Rate limit enforcement
- [x] **Task 4.2**: Run static analysis quality gates:
  - `npx tsc --noEmit` (0 errors)
  - `npm run lint` (0 errors)
  - `npm run verify:schema` (0 drift)
  - `npm run build` (successful compilation)

### Wave 5: Spec Kit Convergence
- [x] **Task 5.1**: Execute convergence audit comparing implementation against `spec.md` and `plan.md`.
- [x] **Task 5.2**: Generate end-to-end verification report.
