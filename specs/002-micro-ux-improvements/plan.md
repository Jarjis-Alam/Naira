# Implementation Plan: NAIRA Micro-UX Polish (Justified Improvements)

**Branch / Feature**: `002-micro-ux-improvements`  
**Date**: 2026-10-04  
**Spec**: [Feature Specification](file:///Users/munshijarjisalam/Documents/Projects/nexora/specs/002-micro-ux-improvements/spec.md)  
**Status**: Ready for Tasks & Implementation  

---

## 1. Technical Strategy & Philosophy

This plan details the surgical implementation of justified micro-UX improvements resulting from our 20-item audit. Guided by the **NAIRA Constitution** and **Karpathy Guidelines**:

- **Inspect Before Modifying**: All target files and component boundaries have been directly audited in actual code.
- **Avoid Unnecessary Complexity**: Zero external libraries added (no heavy modal or toast dependencies). We build clean, lightweight React 19 primitives conforming to the existing monochrome design tokens.
- **Surgical Changes**: Zero modifications to backend business logic, database schemas, APIs, auth session handling, or deterministic calculations.
- **High-Signal Polish**: Strict adherence to "LESS UI, MORE SIGNAL". We reject marketing bloat (UTM, cookie banner, FAQ, floating contact, dark-mode toggle, scroll progress bar).

---

## 2. Technical Context

| Attribute | Specification |
|---|---|
| **Framework** | Next.js 16.3.5 (App Router, Server & Client Components) |
| **Language** | TypeScript 5.x (Strict Mode) |
| **Styling** | Tailwind CSS v4 + `globals.css` design tokens |
| **Accessibility Target** | WCAG 2.1 Level AA (2.4.1 Bypass Blocks, 4.1.3 Status Messages, 3.3.1 Error Identification) |
| **Database & Schema** | PostgreSQL via Drizzle ORM (Zero schema or migration changes) |
| **Auth** | NextAuth v5 (Auth.js) session tokens (Zero auth logic changes) |

---

## 3. Constitution & Karpathy Check

| Principle | Status | Verification |
|---|---|---|
| **I. Preserve Existing Architecture** | **PASS** | Uses existing App Router structure and React primitives. |
| **II. Database Safety** | **PASS** | 0 schema changes, 0 migrations, 0 `db:push`. |
| **III. Auth & Tenant Isolation** | **PASS** | Session derivation via `auth()` remains completely untouched. |
| **IV. No Fabricated Data** | **PASS** | Real `updatedAt` backend dates used; zero simulated timestamps. |
| **V. Deterministic Source of Truth**| **PASS** | Scoring, readiness, and grading logic untouched. |
| **VI. Groq Security** | **PASS** | AI credentials and calls untouched. |
| **VII. UI Consistency** | **PASS** | Technical monochrome palette (`#000000`, `#191c1b`, `#27282d`, white highlights). |
| **VIII. UX Over Complexity** | **PASS** | Replaces blocking `window.confirm` with accessible modal, adds skip link, clipboard copy, and print styling. |
| **IX. Test Before Release** | **PASS** | Strict TypeScript check (`tsc --noEmit`), build check (`npm run build`), accessible DOM checks. |
| **X. Surgical Scope** | **PASS** | Confined strictly to 4 UI primitives, 1 stylesheet update, and 6 component integrations. |

---

## 4. Target Files & Component Architecture

### A. New UI Primitives (`src/components/ui/`)
1. **`skip-to-content.tsx`**:
   - Semantic `<a href="#main-content">` rendered as first focusable element.
   - Visually hidden until focused (`sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 px-4 py-2 bg-void-black text-white border border-white rounded-full font-mono text-xs`).
2. **`confirmation-dialog.tsx`**:
   - Reusable accessible modal dialog (`role="alertdialog"`, `aria-modal="true"`, focus trapped, `Escape` key support).
   - NAIRA dark styling with clear title, message, and explicit Cancel / Confirm (destructive) buttons.
3. **`copy-button.tsx`**:
   - Accessible button that writes text to `navigator.clipboard`.
   - Temporary checkmark icon transition ("Copied!"), reverting after 2 seconds.
   - Screen-reader announcement with `role="status"` and `aria-live="polite"`.
4. **`back-to-top.tsx`**:
   - Unobtrusive floating button appearing after `window.scrollY > 400`.
   - Triggers `window.scrollTo({ top: 0, behavior: 'smooth' })`.
   - Hidden when near top; includes `aria-label="Back to top"`.

### B. Stylesheet (`src/app/globals.css`)
- Add comprehensive `@media print` rules:
  - Hide navigation chrome: `nav`, `aside`, `header`, `[data-purpose="sidebar"]`, `.no-print`, `button`.
  - Override body background to pure white `#ffffff` and text to `#000000`.
  - Ensure `#main-content` and resume container expand to 100% width with clean margins.
  - Page-break controls (`break-inside-avoid`) for resume sections.

### C. Layout & Page Integrations
1. **`frontend/src/app/(protected)/layout.tsx`**:
   - Render `<SkipToContent />` before `<Sidebar />`.
   - Render `<BackToTop />` for global navigation convenience on long views.
2. **`frontend/src/components/layout/top-header.tsx`**:
   - Replace deceptive static mock input with a clean status badge or keyboard shortcut hint.
3. **`frontend/src/app/auth/login/page.tsx`**:
   - Add password visibility toggle with `aria-label` and `aria-pressed`.
   - Add `role="alert"` and `aria-live="assertive"` to error banner; add `aria-invalid` to password input on error.
4. **`frontend/src/app/auth/register/page.tsx`**:
   - Add password visibility toggle with `aria-label` and `aria-pressed`.
   - Add `role="alert"` and `aria-live="assertive"` to error banner; add `aria-invalid` to inputs on error.
5. **`frontend/src/components/applications/application-actions.tsx`**:
   - Replace `window.confirm` for application deletion and terminal transitions with `<ConfirmationDialog />`.
   - Upgrade success message to accessible banner with `role="status"` and `aria-live="polite"`.
   - Upgrade error message with `role="alert"` and high-contrast alert styling.
6. **`frontend/src/components/resume/resume-dossier-view.tsx`**:
   - Render verified `activeVariant.updatedAt` in header (e.g., `Updated Oct 2, 2026`).
   - Add `CopyButton` for plain text / LaTeX preview.
   - Add Print Resume button (`window.print()`).
7. **`frontend/src/components/resume/variants-panel.tsx`**:
   - Replace `window.confirm` for variant deletion with `<ConfirmationDialog />`.

---

## 5. Potential Regressions & Mitigation Strategy

1. **Hydration Mismatch on Timestamps**:
   - *Risk*: Formatting `updatedAt` on server vs client can cause timezone hydration mismatch.
   - *Mitigation*: Use ISO date slice (e.g., `new Date(ts).toISOString().slice(0, 10)` or a mounted client formatter) to ensure deterministic rendering.
2. **Focus Management in Confirmation Dialog**:
   - *Risk*: Closing dialog leaves focus lost in document body.
   - *Mitigation*: Cache the triggering element on open and restore focus on dismiss.
3. **Print Layout Distortion**:
   - *Risk*: Dark CSS background rules leaking onto printed paper.
   - *Mitigation*: Strict `!important` color/background resets in `@media print`.

---

## 6. Verification & Quality Gates

- `npx tsc --noEmit`: 0 type errors.
- `npm run verify:schema`: Schema parity untouched.
- `npm run test`: All existing unit and integration tests passing.
- `npm run build`: Production build passes without error.
- WCAG keyboard verification: Tab sequence enters skip link, enters main content directly.
