# Implementation Plan: Trust, Legal, Privacy & Accessibility Foundation

**Branch**: `003-trust-accessibility-anti-vibecode` | **Date**: 2026-10-04 | **Spec**: [specs/003-trust-accessibility-anti-vibecode/spec.md](file:///Users/munshijarjisalam/Documents/Projects/nexora/specs/003-trust-accessibility-anti-vibecode/spec.md)

---

## 1. Summary

Implement essential legal, privacy, and accessibility requirements identified in the 50-point audit while maintaining NAIRA's dark-first monochrome architectural identity. The technical approach adds:
1. Dedicated public server routes for `/privacy` and `/terms` using existing design tokens.
2. Direct navigation links in `LandingFooter`, `auth/login`, and `auth/register`.
3. Consent disclosures in registration and resume upload.
4. Data deletion & privacy management UI in `/profile`.
5. Motion-reduction guard in `ClickSpark`.

---

## 2. Technical Context

- **Framework**: Next.js 16 (App Router), React 19, TypeScript 5
- **Styling**: Tailwind CSS v4, pure monochrome obsidian token system (`globals.css`)
- **Authentication**: NextAuth.js v5 (beta) with credentials provider
- **Database**: PostgreSQL with Drizzle ORM (Zero schema changes, zero migrations)
- **Constraint**: Strict preservation of NAIRA Constitution and Karpathy Guidelines. Zero fabricated corporate data or fake reviews.

---

## 3. Constitution Gates

- [x] **Principle I: Architecture Preservation**: Standard App Router pages; no framework migrations.
- [x] **Principle II: Database Schema Safety**: Zero schema mutations or `drizzle-kit push`.
- [x] **Principle III: Tenant Isolation**: Profile data deletion requests operate strictly scoped to the authenticated student `session.user.id`.
- [x] **Principle IV: Zero Fabricated Data**: Legal pages state actual platform data handling (NextAuth session, local PG database, Groq server analysis); no fake company registration numbers or addresses.
- [x] **Principle V: Deterministic Benchmark Invariants**: No modification to scoring or placement algorithms.
- [x] **Principle VI: Groq API Key Confidentiality**: All processing remains strictly server-side.
- [x] **Principle VII: Technical Monochrome Design System**: New pages match `#000000`, `#121215`, `#ffffff`, `#27272a`.
- [x] **Principle VIII: Rigorous Verification**: TypeScript type-check, schema verification, and build validation.

---

## 4. Phase Breakdown & File Mapping

### Phase 1: Public Legal Pages
- `frontend/src/app/privacy/page.tsx`: Full privacy policy detailing data retention, student rights, Groq server processing, and essential cookies.
- `frontend/src/app/terms/page.tsx`: Terms of service detailing acceptable use, academic honesty, account rules, and non-warranty placement disclaimer.

### Phase 2: Navigation & Link Integration
- `frontend/src/components/landing/landing-footer.tsx`: Add accessible links to `/privacy` and `/terms`, non-warranty placement disclaimer, and campus placement support channel.
- `frontend/src/app/auth/login/page.tsx`: Convert unlinked footer text to clickable links (`/privacy` and `/terms`).
- `frontend/src/app/auth/register/page.tsx`: Convert unlinked footer text to clickable links and add explicit form consent disclosure.

### Phase 3: Resume Upload Consent & Profile Data Management
- `frontend/src/components/resume/resume-upload-panel.tsx`: Add privacy disclosure note below the file dropzone.
- `frontend/src/app/(protected)/profile/page.tsx`: Add "Privacy & Data Management" card with data footprint summary and account deletion request workflow.

### Phase 4: Accessibility & Motion Polish
- `frontend/src/components/ui/click-spark.tsx`: Add check for `window.matchMedia("(prefers-reduced-motion: reduce)").matches` to suppress canvas sparks when reduced motion is preferred.

### Phase 5: Verification & Audit Convergence
- Run TypeScript (`npx tsc --noEmit`)
- Run Schema Parity (`npm run verify:schema`)
- Run Build (`npm run build`)
- Execute tests and produce final 50-point audit matrix.
