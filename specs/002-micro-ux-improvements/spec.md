# Feature Specification: NAIRA UX Polish Audit — Justified Micro-UX Improvements

**Feature Directory**: `specs/002-micro-ux-improvements`  
**Feature Number**: `002`  
**Created**: 2026-10-04  
**Status**: Specified  
**Approach**: Spec Kit + Karpathy Guidelines (Inspect before modifying, zero assumptions, surgical changes, verifiable criteria)

---

## 1. Executive Summary & Audit Classification

Antigravity conducted an inspection of the actual codebase across all 20 common website UX improvements. NAIRA is a production brownfield engineering placement operating system with a dark-first, technical monochrome design system.

Features were audited against actual component implementations rather than file naming heuristics.

### The 20-Item UX Audit Classification Table

| # | Item | Status | Codebase Evidence | Recommendation & Decision |
|---|---|---|---|---|
| 1 | **Dark mode toggle** | **C** | Layout is dark-first by constitution (`app/layout.tsx: <html className="dark">`). 40+ charts & radar canvases are calibrated for deep dark contrast. | **REJECT**. No user demand for light theme. Inverts brand identity. |
| 2 | **Simple cookie banner** | **C** | NAIRA uses exclusively essential, first-party NextAuth HTTP cookies (`authjs.session-token`). Zero 3rd-party trackers or marketing pixels exist. | **REJECT**. Non-essential cookie consent banner is legally unnecessary and introduces fake UI bloat. |
| 3 | **Site search** | **D** | `TopHeader` contains a static placeholder search input (`readOnly`, `⌘ K`) with no backend endpoint. Global search across 36 tables is out of scope. | **D — REMOVE / CLEANUP**. Remove deceptive non-functional search mockup from header. Avoid building a generic search engine. |
| 4 | **Back to top button** | **B** | Long-form pages (`/analytics`, `/resume`, `/interview-coach`, `/applications/[id]`) span 600–900+ DOM lines. Reaching the top on mobile requires excessive scrolling. | **ACCEPT (P2)**. Add a lightweight, unobtrusive, keyboard-accessible floating scroll-to-top button visible only after scrolling >400px. |
| 5 | **Mobile menu** | **A** | Inspected `frontend/src/components/layout/sidebar.tsx` and `frontend/src/components/landing/cinematic-hero.tsx`. Both feature functional responsive drawers with backdrop-blur and `aria-modal="true"`. | **PRESERVE (Already Implemented)**. Working as intended. |
| 6 | **Loading animations** | **A** | Inspected `app/(protected)/loading.tsx` and `components/ui/button.tsx`. Full-page route spinners and button loading states (`isLoading`) are already implemented. | **PRESERVE (Already Implemented)**. No decorative fluff needed. |
| 7 | **Hover states** | **A** | Buttons, links, metric cards (`CompactMetricStrip`, `MetricCardV2`, `Pill`, `Sidebar`) have verified hover, focus, and active transitions in Tailwind. | **PRESERVE (Already Implemented)**. Maintain consistency. |
| 8 | **Scroll progress bar** | **C** | NAIRA is an interactive placement dashboard, not a long-form editorial blog. A top progress bar introduces visual distraction on data-dense views. | **REJECT**. Visual clutter violating "Less UI, More Signal". |
| 9 | **Copy button** | **B** | Codebase audit found `0` instances of `navigator.clipboard`. Candidates frequently need to copy generated LaTeX/text in `/resume`, AI feedback in `/interview-coach`, and code questions. | **ACCEPT (P1)**. Implement a reusable, accessible `CopyButton` primitive with visual checkmark feedback and `role="status"` screen reader confirmation. |
| 10 | **Print stylesheet** | **B** | `app/globals.css` lacks `@media print` rules. Printing `/resume` currently renders dark backgrounds, sidebar nav, top header, and broken page splits. | **ACCEPT (P1)**. Add `@media print` rules in `globals.css` to hide navigation chrome and render clean, high-contrast monochrome ATS resume printouts. |
| 11 | **Sticky headers** | **A** | `TopHeader` in `components/layout/top-header.tsx` is already `sticky top-0 z-30` with `backdrop-blur-md` and border divider. | **PRESERVE (Already Implemented)**. Retains persistent context. |
| 12 | **Skip to content** | **B** | `<main id="main-content">` exists in `(protected)/layout.tsx`, but there is NO skip link. Keyboard/screen reader users must tab through dozens of sidebar links first (WCAG 2.1 Level A 2.4.1 violation). | **ACCEPT (P0)**. Implement an accessible `SkipToContent` link as the first focusable element in the protected layout. |
| 13 | **Password visibility toggle** | **B** | `app/auth/login/page.tsx` and `app/auth/register/page.tsx` have plain `type="password"` inputs without visibility toggles, causing friction on mobile keyboards. | **ACCEPT (P1)**. Add an accessible eye toggle button (`type="button"`, `aria-label="Show password"` / `"Hide password"`, `aria-pressed`) to both forms. |
| 14 | **UTM tracking** | **C** | NAIRA is an institutional placement platform. No marketing attribution, ad tracking, or campaign requirement exists. | **REJECT**. Zero marketing analytics need; preserves student privacy. |
| 15 | **Form success state** | **B** | `ApplicationActions` and form controls display success messages as plain `<p>` tags lacking `role="status"` and `aria-live="polite"` screen reader announcements. | **ACCEPT (P1)**. Standardize accessible form success banners with positive feedback, green/moss accent icon, and live-region announcements. |
| 16 | **Form error state** | **B** | `auth/login`, `auth/register`, and `ApplicationActions` error banners lack `role="alert"` or `aria-invalid` bindings on inputs, impairing screen reader error identification. | **ACCEPT (P0)**. Add `role="alert"`, `aria-live="assertive"`, and `aria-invalid` bindings across all authentication and action forms. |
| 17 | **Confirmation modals** | **D** | Destructive actions in `application-actions.tsx` (delete application, terminal status) and `resume/variants-panel.tsx` use synchronous browser `window.confirm()`. | **ACCEPT (P0 / D)**. Implement an accessible `ConfirmationDialog` primitive (`role="alertdialog"`, focus trap, Esc dismissal, NAIRA dark theme) and replace `window.confirm()`. |
| 18 | **Last updated date** | **B** | Active resume variant in `ResumeDossierView` shows a static/version placeholder (`v3.2 ATS-READY`) instead of the real backend `activeVariant.updatedAt` timestamp. | **ACCEPT (P1)**. Display verified backend `updatedAt` timestamps in `ResumeDossierView` and application headers. Never fabricate timestamps. |
| 19 | **Expandable FAQ** | **C** | Landing page already features an interactive diagnostic terminal preview and structured benchmark breakdown. In-app views have contextual empty states and disclosure panels. | **REJECT**. Generic FAQ accordion adds low-signal copy to the landing page. |
| 20 | **Floating contact button** | **C** | NAIRA has no customer support ticketing backend or live chat queue. A floating button would be a dead element or a mailto link creating false user expectations. | **REJECT**. Avoid dead UI elements and floating widget clutter. |

---

## 2. Prioritized Scope of Accepted Improvements

### Priority Matrix
- **P0 (Accessibility & Safety Imperatives)**:
  - **Item 12**: Skip to Content link (`SkipToContent`) in protected layout.
  - **Item 16**: Accessible form error states (`role="alert"`, `aria-invalid`) in auth and action forms.
  - **Item 17**: Accessible `ConfirmationDialog` replacing blocking `window.confirm()` for destructive operations.
- **P1 (Meaningful Productivity & UX Improvements)**:
  - **Item 9**: Reusable `CopyButton` primitive with visual/auditory feedback for resume export and interview coach.
  - **Item 10**: Print stylesheet (`@media print`) optimizing `/resume` for clean ATS document generation.
  - **Item 13**: Password visibility toggle button for `/auth/login` and `/auth/register`.
  - **Item 15**: Accessible form success state banners with `role="status"` and `aria-live="polite"`.
  - **Item 18**: Verified backend `updatedAt` timestamp display in `ResumeDossierView` and application detail.
- **P2 (Optional Polish & Cleanup)**:
  - **Item 4**: Unobtrusive `BackToTop` floating button on long pages.
  - **Item 3**: Cleanup misleading static search input in `TopHeader`.

---

## 3. User Scenarios & Acceptance Criteria

### User Scenario 1 — Keyboard & Screen Reader Accessibility: Skip to Content (P0)
**Given** a keyboard-only or screen-reader user loading any protected route (e.g., `/dashboard`, `/analytics`, `/resume`),  
**When** the user presses `Tab` upon initial page load,  
**Then** the "Skip to main content" link becomes visually focused at the top-left of the viewport (`focus:not-sr-only`), and pressing `Enter` moves keyboard focus directly to `<main id="main-content">`, bypassing the sidebar navigation entirely (WCAG 2.4.1).

### User Scenario 2 — Accessible Form Error & Success States (P0 / P1)
**Given** a user submitting `/auth/login`, `/auth/register`, or `ApplicationActions`,  
**When** a submission fails,  
**Then** the error message is displayed inside a container with `role="alert"` and `aria-live="assertive"`, the failed input has `aria-invalid="true"`, and the message is in high-contrast text.  
**When** a submission succeeds,  
**Then** a success banner with `role="status"` and `aria-live="polite"` announces the completed action with a subtle checkmark indicator.

### User Scenario 3 — Safe Destructive Actions via Accessible Confirmation Dialog (P0)
**Given** a candidate attempting a destructive action:
1. Deleting an application in `ApplicationActions`
2. Transitioning an application to a terminal status (`REJECTED`, `WITHDRAWN`, `CLOSED`)
3. Deleting a resume variant in `VariantsPanel`,  
**When** the user triggers the action,  
**Then** NAIRA presents an accessible `ConfirmationDialog` modal (`role="alertdialog"`, focus trapped inside the modal, dismissible with `Escape` or "Cancel", confirming with a styled destructive button), completely eliminating raw browser `window.confirm()`.

### User Scenario 4 — Password Visibility Toggle in Authentication (P1)
**Given** a candidate typing their password on `/auth/login` or `/auth/register`,  
**When** they click or activate via keyboard the password toggle button,  
**Then** the input type toggles between `"password"` and `"text"`, the icon toggles between `visibility` and `visibility_off`, `aria-label` updates between "Show password" and "Hide password", and focus remains on the toggle or input without submitting the form (`type="button"`).

### User Scenario 5 — One-Click Copy for Resume & Interview Content (P1)
**Given** a candidate viewing plain-text/LaTeX resume output on `/resume` or AI answer coaching on `/interview-coach`,  
**When** the user clicks the `CopyButton`,  
**Then** the text is written to the system clipboard via `navigator.clipboard.writeText`, the button temporarily transitions to a green/moss checkmark with "Copied!", and an offscreen announcement (`role="status"`) notifies assistive technologies.

### User Scenario 6 — Professional Print Stylesheet for ATS Resume (P1)
**Given** a candidate on `/resume` invoking browser print (`Cmd+P` or print dialog),  
**When** the print preview opens,  
**Then** all application chrome (sidebar, top header, dossier tabs, action buttons, back-to-top) is hidden via `@media print`, colors are converted to crisp black-on-white text, and the structured resume contents print cleanly on standard A4/Letter paper.

### User Scenario 7 — Genuine Freshness Timestamps (P1)
**Given** a candidate viewing `/resume` or `/applications/[id]`,  
**When** the header is rendered,  
**Then** the system displays the actual last updated date (e.g., "Updated Oct 2, 2026") derived directly from `activeVariant.updatedAt` or `app.updatedAt`. If no timestamp is present, the field is omitted. No timestamps are ever fabricated.

### User Scenario 8 — Back to Top Navigation on Long Views (P2)
**Given** a candidate scrolling through extended analytics charts, practice questions, or interview feedback (>400px scroll depth),  
**When** the user reaches lower sections,  
**Then** a subtle, accessible `BackToTop` button appears in the bottom right corner. Clicking or pressing `Enter` smoothly scrolls the page back to the top (`window.scrollTo({ top: 0, behavior: 'smooth' })`).

---

## 4. Technical Boundaries & Non-Goals

1. **NO Database Changes**: No table alterations, migrations, or Drizzle schema edits.
2. **NO API Protocol Changes**: Existing endpoints (`/api/student/applications`, `/api/student/resume/variants`, etc.) retain exact contracts.
3. **NO Business Logic Modifications**: Deterministic score algorithms, ATS parsing, and grading logic remain unchanged.
4. **NO Aesthetic Degeneration**: Dark-first technical monochrome identity is strictly maintained. Zero generic SaaS neon, gradients, or glassmorphic bloat.
5. **NO Unjustified Feature Creep**: Rejected items (cookie banner, UTM tracking, dark mode toggle, scroll progress bar, floating contact button, FAQ) MUST NOT be implemented.

---

## 5. Karpathy Guidelines & Constitution Verification

- **Inspect Before Modifying**: Full codebase audit executed across all 20 items with direct line references.
- **Do Not Assume a Feature is Needed**: 7 items rejected; 4 items recognized as already implemented; only 9 targeted improvements accepted.
- **Surgical Changes**: Create small, focused UI primitives (`SkipToContent`, `CopyButton`, `ConfirmationDialog`, `BackToTop`) and surgically integrate into existing components.
- **Verifiable Success Criteria**:
  - `npx tsc --noEmit` passes with 0 type errors.
  - WCAG 2.4.1 skip link verification via keyboard tab sequence.
  - Form validation with screen reader alert semantics.
  - Print preview rendering without navigation chrome.
  - Production build (`npm run build`) succeeds cleanly.
