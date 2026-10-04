# Feature Specification: Trust, Legal, Privacy & Accessibility Foundation

**Feature Branch**: `003-trust-accessibility-anti-vibecode`
**Created**: 2026-10-04
**Status**: Specified
**Input**: NAIRA — 50-Point Anti-Vibecode + Trust/Legal/Accessibility Audit

---

## 1. Executive Summary & Intent

NAIRA is a placement preparation operating system for engineering college students. To transition from a prototype to a trustworthy, production-grade platform, NAIRA requires foundational trust, privacy, legal, and accessibility disclosures without violating its core architectural principles:
- **Dark-first monochrome aesthetic** ("Less UI, More Signal", pure obsidian `#000000`/`#121215`, crisp white `#ffffff`, zinc hairlines).
- **Strictly honest disclosures** (no fabricated legal entities, CINs, fake testimonials, or fake compliance certifications).
- **Zero third-party tracking** (essential session cookies only; no nagging cookie consent popups).
- **Clear non-warranty disclaimer** (diagnostic benchmarking and preparation, not guaranteed employment).

---

## 2. User Scenarios & Testing

### User Story 1 — Public Legal & Privacy Transparency (Priority: P0)
As a candidate evaluating or using NAIRA, I want to review the platform's Privacy Policy and Terms of Service via accessible links in the landing and auth footers, so that I understand how my assessment logs, resumes, and profile data are processed.

**Why this priority**:
Foundational trust and regulatory baseline. A student platform handling resumes and academic records must provide clear, accessible legal and privacy terms.

**Independent Test**:
Navigate to `/privacy` and `/terms` directly and via footer links. Verify transparent explanation of data handling (local storage, NextAuth session cookies, server-side Groq analysis, zero ad tracking) and non-warranty diagnostic disclaimer.

**Acceptance Scenarios**:
1. **Given** a visitor on the landing page or auth screens, **When** they click "Privacy Policy" or "Terms of Service", **Then** they are navigated to dedicated `/privacy` or `/terms` pages styled in NAIRA's obsidian monochrome system.
2. **Given** a visitor on `/privacy`, **When** they inspect the cookies section, **Then** they see that NAIRA uses only essential authentication session cookies (`authjs.session-token`) and zero third-party advertising trackers.
3. **Given** a visitor on `/terms`, **When** they review placement disclaimers, **Then** they see that assessment scores are diagnostic preparation tools and do not constitute formal employment guarantees.

---

### User Story 2 — Informed Consent on Registration & Resume Upload (Priority: P0)
As a student creating an account or uploading a resume for ATS analysis, I want clear, concise privacy disclosures at the point of data entry, so that I know my documents are confidential and used strictly for placement preparation.

**Why this priority**:
Prevents data ambiguity before personal credentials or PDF/DOCX resumes are transmitted.

**Independent Test**:
Open `/auth/register` and verify consent text with links to `/terms` and `/privacy`. Open `/resume` and verify the privacy disclosure note under the document upload dropzone.

**Acceptance Scenarios**:
1. **Given** a student on `/auth/register`, **When** they view the enrollment form, **Then** an explicit disclosure states: "By creating an account, you agree to NAIRA's Terms of Service and Privacy Policy."
2. **Given** a student on `/resume`, **When** they view the resume upload panel, **Then** a privacy note confirms: "Resumes are stored privately in your student profile and analyzed solely for placement preparation. Documents are never shared with external advertisers."

---

### User Story 3 — Student Data Sovereignty & Deletion Request (Priority: P0)
As a registered student, I want to review my data footprint and have a clear channel to request account and data deletion from my profile, so that I maintain sovereignty over my academic records.

**Why this priority**:
Essential compliance with privacy principles (GDPR / DPDP data subject rights) without requiring complex database schema alterations.

**Independent Test**:
Navigate to `/profile` and observe the "Privacy & Data Management" panel. Verify data summary and account deletion request workflow with confirmation modal.

**Acceptance Scenarios**:
1. **Given** a logged-in student on `/profile`, **When** they scroll to the privacy section, **Then** they can see what data is stored (profile metadata, assessment attempts, resume variants).
2. **Given** a student wishing to delete their data, **When** they click "Request Account & Data Deletion", **Then** an accessible confirmation dialog explains the irreversible purge process and instructions for submitting a deletion request.

---

### User Story 4 — Accessibility & Motion Sensitivity (Priority: P1)
As a student with motion sensitivity or using assistive technology, I want canvas micro-animations to respect `prefers-reduced-motion`, and all decorative icons to have `aria-hidden="true"`, so that the interface is completely accessible.

**Why this priority**:
WCAG 2.1 compliance for animations and screen reader clarity.

**Independent Test**:
Enable reduced motion in OS/browser. Click anywhere on the interface and verify `ClickSpark` suppresses spark generation. Verify screen reader tree has proper labels and decorative icons are hidden.

**Acceptance Scenarios**:
1. **Given** a user with `prefers-reduced-motion: reduce`, **When** they click anywhere on the page, **Then** `ClickSpark` does not animate or render sparks.
2. **Given** a screen reader user, **When** navigating footer links and auth forms, **Then** decorative SVGs are marked `aria-hidden="true"` and links have accessible text.

---

## 3. Invariants & Guardrails

1. **NAIRA Constitution Adherence**:
   - Zero database migrations or `drizzle-kit push`.
   - Dark-first obsidian aesthetic strictly preserved (`#000000`, `#121215`, `#ffffff`, `#27272a`).
   - No cookie consent banners (only essential session cookies exist).
   - No fake testimonials, fake reviews, or fabricated legal company registrations.
2. **Performance & Bundle Size**:
   - Zero new npm dependencies.
   - Clean Next.js server components for `/privacy` and `/terms`.
