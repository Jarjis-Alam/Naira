# Feature Specification: Real Password Reset Emails with Resend

**Feature Branch**: `005-resend-password-reset`
**Created**: 2026-10-05
**Status**: Draft
**Feature Directory**: `specs/005-resend-password-reset`

---

## 1. Executive Summary & Objective

Replace the existing client-only fake "Forgot password" notice on the NAIRA login page with an end-to-end, cryptographically secure password-reset lifecycle powered by Resend transactional email delivery.

The lifecycle consists of:
1. Student clicks "Forgot password?" and enters their email address.
2. The system validates the request and, if an account exists, generates a high-entropy single-use token, persists only its SHA-256 hash with an expiration window (~1 hour), and dispatches a branded reset link via Resend.
3. If no account exists, the system returns the identical generic success message to prevent user enumeration.
4. The recipient clicks the link to `/auth/reset-password?token=<raw_token>`.
5. The UI renders the password reset form conforming to the NAIRA technical monochrome design system.
6. The backend verifies token hash validity, expiration, and single-use state, enforces password complexity, updates `users.password_hash` with bcryptjs (cost 12), and marks the token as used.

---

## 2. User Scenarios & Acceptance Criteria

### User Story 1 - Request Password Reset (Priority: P1)
As a registered NAIRA student who forgot their password,
I want to submit my registered email on the login page and receive a real password reset email via Resend,
So that I can regain access to my account.

**Independent Test**:
Submit an existing account email via `POST /api/auth/forgot-password`; verify that a hashed token record is inserted into `password_reset_tokens`, an email dispatch is queued and accepted by Resend, and the API returns a generic confirmation message.

**Acceptance Scenarios**:
1. **Given** a registered user with email `student@example.com`, **When** they submit their email on `/auth/login`, **Then** the system generates a secure token, hashes it with SHA-256, stores the hash with a 1-hour expiry, dispatches a reset email with the raw token URL via Resend, and displays `"If an account exists for this email, a password recovery link has been sent."`
2. **Given** any previous active reset tokens for that user, **When** a new reset request is processed, **Then** all previous unconsumed tokens for that user are marked as used/invalidated.

---

### User Story 2 - Complete Password Reset (Priority: P1)
As a student who received a reset email,
I want to open the reset link, enter and confirm my new password, and submit it,
So that my password is updated and I can immediately sign in.

**Independent Test**:
Call `POST /api/auth/reset-password` with a valid raw token and a compliant new password; verify that `users.password_hash` is updated, the token is marked `used_at = now()`, the new password succeeds at sign-in, and the old password fails.

**Acceptance Scenarios**:
1. **Given** a valid, unexpired, unused reset token, **When** the student navigates to `/auth/reset-password?token=...`, **Then** the page renders the password reset form.
2. **Given** valid token and matching passwords meeting complexity rules (min 6 characters), **When** submitted, **Then** the password hash in `users` is updated with bcryptjs, `used_at` is stamped, and the user is redirected or given a link to `/auth/login` with success confirmation.
3. **Given** an already-used or expired token, **When** submitted or viewed, **Then** the system rejects the reset attempt with an explicit invalid/expired token message.

---

### User Story 3 - Anti-Enumeration & Abuse Protection (Priority: P2)
As a security-conscious platform operator,
I want the forgot-password endpoint to return identical responses for existing and nonexistent emails and apply rate limiting,
So that malicious actors cannot enumerate registered users or spam email dispatches.

**Independent Test**:
Submit requests with nonexistent emails, malformed emails, and high frequency; verify identical responses for valid/non-existent emails and HTTP 429 when rate limits are exceeded.

**Acceptance Scenarios**:
1. **Given** an email address not present in `users`, **When** submitted to `POST /api/auth/forgot-password`, **Then** the endpoint returns HTTP 200 with the exact same message as an existing account, with no email dispatched and no internal leakage.
2. **Given** rapid repeated requests from the same IP, **When** exceeding 5 requests per minute, **Then** the endpoint returns HTTP 429 with `Retry-After`.

---

## 3. Requirements

### Functional Requirements
- **FR-001**: System MUST create a versioned database migration (`0020_phase_27_password_reset_tokens.sql`) defining `password_reset_tokens`.
- **FR-002**: `password_reset_tokens` MUST contain: `id` (uuid PK), `user_id` (uuid FK referencing `users.id` ON DELETE CASCADE), `token_hash` (varchar/text), `expires_at` (timestamptz), `used_at` (timestamptz, nullable), `created_at` (timestamptz).
- **FR-003**: System MUST generate raw reset tokens using `crypto.randomBytes(32).toString('hex')` (256-bit entropy).
- **FR-004**: System MUST NEVER persist raw tokens in the database or logs; tokens MUST be hashed with SHA-256 before storage.
- **FR-005**: Reset tokens MUST expire after 1 hour (3600 seconds) from generation.
- **FR-006**: Reset tokens MUST be single-use. Once `used_at` is set, subsequent attempts MUST be rejected.
- **FR-007**: Generating a new reset token for a user MUST invalidate any existing unconsumed tokens for that user.
- **FR-008**: System MUST implement `POST /api/auth/forgot-password` accepting `{ "email": string }`.
- **FR-009**: `POST /api/auth/forgot-password` MUST return a generic anti-enumeration response: `"If an account exists for this email, a password recovery link has been sent."` regardless of whether the account exists.
- **FR-010**: System MUST integrate Resend via official `resend` package to send emails using `RESEND_API_KEY` and configurable `EMAIL_FROM`.
- **FR-011**: System MUST implement `POST /api/auth/reset-password` accepting `{ "token": string, "password": string }`.
- **FR-012**: `POST /api/auth/reset-password` MUST validate the new password (min 6 characters) and hash it with `bcryptjs` (salt rounds 12) matching the registration contract.
- **FR-013**: System MUST provide a dedicated reset password page at `/auth/reset-password?token=...` adhering strictly to NAIRA's technical monochrome design system.
- **FR-014**: System MUST update `LoginForm` in `frontend/src/app/auth/login/page.tsx` so that "Forgot password?" sends a real API request to `POST /api/auth/forgot-password` with loading state and generic feedback.
- **FR-015**: Rate limiting MUST be enforced on both forgot-password and reset-password endpoints using the existing `@/lib/rate-limit` utility.
- **FR-016**: Reset email HTML MUST feature clean NAIRA technical branding, clear button/URL, 1-hour expiration notice, and security advisory.

---

## 4. Key Entities

### `password_reset_tokens`
- `id`: `uuid` primary key, `gen_random_uuid()`
- `user_id`: `uuid` foreign key -> `users.id` (on delete cascade)
- `token_hash`: `varchar(64)` unique / indexed, SHA-256 hex digest
- `expires_at`: `timestamp with time zone` not null
- `used_at`: `timestamp with time zone` null by default
- `created_at`: `timestamp with time zone` not null default `now()`

---

## 5. Measurable Success Criteria
- **SC-001**: 100% of password reset tokens in the database are SHA-256 hashes; 0 raw tokens stored.
- **SC-002**: Anti-enumeration response timing and payload are indistinguishable between registered and unregistered emails.
- **SC-003**: 0 TypeScript errors (`npx tsc --noEmit`), 0 ESLint errors (`npm run lint`), 100% schema parity (`npm run verify:schema`).
- **SC-004**: Full regression suite and dedicated password reset test suite pass with 100% success.
