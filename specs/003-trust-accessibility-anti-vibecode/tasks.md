# Tasks: Trust, Legal, Privacy & Accessibility Foundation

**Input**: Design documents from `specs/003-trust-accessibility-anti-vibecode/` (spec.md, plan.md)
**Prerequisites**: plan.md (completed), spec.md (completed)

---

## Phase 1: User Story 1 — Public Legal & Privacy Transparency (Priority: P0)

- [x] T001 [US1] Create `/privacy` page in `frontend/src/app/privacy/page.tsx` covering data retention, Groq server processing, session cookies (`authjs.session-token`), and student privacy rights.
- [x] T002 [US1] Create `/terms` page in `frontend/src/app/terms/page.tsx` covering acceptable use, academic honesty, non-warranty placement disclaimer, and platform availability.
- [x] T003 [US1] Update `frontend/src/components/landing/landing-footer.tsx` with links to `/privacy` and `/terms`, non-warranty placement disclaimer, and campus placement support channel.
- [x] T004 [US1] Update `frontend/src/app/auth/login/page.tsx` footer to turn static text into accessible links to `/privacy` and `/terms`.

---

## Phase 2: User Story 2 — Informed Consent on Registration & Resume Upload (Priority: P0)

- [x] T005 [US2] Update `frontend/src/app/auth/register/page.tsx` to include explicit consent text ("By creating an account, you agree to NAIRA's Terms of Service and Privacy Policy") and convert footer text into accessible links.
- [x] T006 [US2] Update `frontend/src/components/resume/resume-upload-panel.tsx` to add a transparent privacy assurance note directly below the file dropzone.

---

## Phase 3: User Story 3 — Student Data Sovereignty & Deletion Request (Priority: P0)

- [x] T007 [US3] Add a "Privacy & Data Management" card in `frontend/src/app/(protected)/profile/page.tsx` outlining candidate data ownership, local retention rules, and an accessible confirmation dialog for submitting an account/data deletion request.

---

## Phase 4: User Story 4 — Accessibility & Motion Sensitivity (Priority: P1)

- [x] T008 [US4] Update `frontend/src/components/ui/click-spark.tsx` to check `window.matchMedia("(prefers-reduced-motion: reduce)").matches` and suppress canvas spark rendering when reduced motion is requested.
- [x] T009 [US4] Audit and ensure decorative SVGs have `aria-hidden="true"` across landing and auth footers.

---

## Phase 5: Verification & Spec Kit Convergence (Priority: P0)

- [x] T010 Run TypeScript validation (`npx tsc --noEmit`).
- [x] T011 Run Drizzle database schema verification (`npm run verify:schema`).
- [x] T012 Run production Next.js build (`npm run build`).
- [x] T013 Compile the final 50-Point Audit Matrix and convergence report.
