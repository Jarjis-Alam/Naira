# Tasks: NAIRA Justified Micro-UX Improvements

**Feature**: `002-micro-ux-improvements`  
**Plan**: [Implementation Plan](file:///Users/munshijarjisalam/Documents/Projects/nexora/specs/002-micro-ux-improvements/plan.md)  
**Spec**: [Feature Specification](file:///Users/munshijarjisalam/Documents/Projects/nexora/specs/002-micro-ux-improvements/spec.md)  
**Status**: Completed & Verified  

---

## Task List

### Phase 1: Foundational Accessible UI Primitives

- [x] **Task 1: Create `SkipToContent` primitive**
  - **Target**: `frontend/src/components/ui/skip-to-content.tsx`
  - **Change**: Implement an accessible skip link `<a href="#main-content">` that is visually hidden by default (`sr-only`) and appears at top-left when focused (`focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50`).
  - **Reason**: Fulfills WCAG 2.1 Success Criterion 2.4.1 (Bypass Blocks), allowing keyboard and screen-reader users to skip sidebar navigation directly to page content.
  - **Acceptance Criteria**: Tabbing on page load focuses the link; pressing Enter navigates focus to `#main-content`.
  - **Validation**: Visual inspection with keyboard `Tab` + DOM verification.

- [x] **Task 2: Create `ConfirmationDialog` modal primitive**
  - **Target**: `frontend/src/components/ui/confirmation-dialog.tsx`
  - **Change**: Implement an accessible confirmation modal using React 19 dialog patterns (`role="alertdialog"`, `aria-modal="true"`, focus trap, `Escape` key handler, NAIRA obsidian/zinc dark styling, explicit Confirm/Cancel buttons).
  - **Reason**: Replaces thread-blocking, unstyled browser `window.confirm()` calls with an accessible, high-signal confirmation experience.
  - **Acceptance Criteria**: Traps focus while open; closes on `Escape` or Cancel button without action; executes callback on Confirm.
  - **Validation**: Unit/type check and manual modal cycle.

- [x] **Task 3: Create `CopyButton` primitive**
  - **Target**: `frontend/src/components/ui/copy-button.tsx`
  - **Change**: Implement a reusable copy button with `navigator.clipboard.writeText`, an animated transition between copy icon and checkmark ("Copied!"), 2-second timeout reset, and offscreen `role="status"` live region announcement.
  - **Reason**: Empowers candidates to easily copy LaTeX resume exports, interview answers, and code without manual text selection.
  - **Acceptance Criteria**: Copies string to clipboard; switches label to "Copied!" for 2s; announces to screen readers.
  - **Validation**: Clipboard API test and `role="status"` accessibility check.

- [x] **Task 4: Create `BackToTop` floating button**
  - **Target**: `frontend/src/components/ui/back-to-top.tsx`
  - **Change**: Implement a subtle floating button that listens to scroll depth, becomes visible when `scrollY > 400`, and triggers smooth scroll to top (`window.scrollTo({ top: 0, behavior: 'smooth' })`).
  - **Reason**: Improves mobile and desktop navigation on long-form data pages (`/analytics`, `/resume`, `/interview-coach`).
  - **Acceptance Criteria**: Invisible when scrolled to top; appears smoothly after 400px; smooth scrolls to top when clicked or activated via keyboard.
  - **Validation**: Scroll depth state test.

---

### Phase 2: Resume Print Stylesheet

- [x] **Task 5: Add `@media print` rules to `globals.css`**
  - **Target**: `frontend/src/app/globals.css`
  - **Change**: Define print styles: hide navigation chrome (`nav`, `aside`, `header`, `button`, `.no-print`), enforce pure white background `#ffffff` with black text `#000000`, remove borders and shadows, expand `#main-content` to 100% width, and add page break avoidance for resume sections.
  - **Reason**: Enables clean, professional ATS resume printing and PDF export via `Cmd+P` without dark canvas ink-waste or sidebar clutter.
  - **Acceptance Criteria**: Print preview on `/resume` displays clean black-on-white resume without sidebars, headers, or interactive buttons.
  - **Validation**: CSS rule verification and print media evaluation.

---

### Phase 3: Layout & Top Navigation Integration

- [x] **Task 6: Integrate `SkipToContent` and `BackToTop` in protected layout**
  - **Target**: `frontend/src/app/(protected)/layout.tsx`
  - **Change**: Insert `<SkipToContent />` as the very first element before `<Sidebar />` and mount `<BackToTop />` before the closing layout tag.
  - **Reason**: Makes skip-to-content and back-to-top universally available across all protected student workflows.
  - **Acceptance Criteria**: First focusable item across all protected routes is the skip link; back-to-top is mounted.
  - **Validation**: Layout DOM structure inspection.

- [x] **Task 7: Clean up misleading placeholder search bar in `TopHeader`**
  - **Target**: `frontend/src/components/layout/top-header.tsx`
  - **Change**: Remove the non-functional readOnly input mockup ("Search questions, companies... ⌘ K") and replace it with a clean workspace status badge or remove the fake element.
  - **Reason**: Eliminates deceptive dead UI elements violating "LESS UI, MORE SIGNAL".
  - **Acceptance Criteria**: No misleading non-interactive input bars; header preserves clean navigation and profile indicators.
  - **Validation**: TopHeader render verification.

---

### Phase 4: Authentication Form Micro-UX

- [x] **Task 8: Add password visibility toggle & accessible error alerts in Login**
  - **Target**: `frontend/src/app/auth/login/page.tsx`
  - **Change**:
    1. Add an accessible eye toggle button (`type="button"`, `aria-label="Show password"` / `"Hide password"`, `aria-pressed`) to reveal/mask the password input.
    2. Add `role="alert"` and `aria-live="assertive"` to the error banner.
    3. Add `aria-invalid={Boolean(error)}` to inputs upon submission failure.
  - **Reason**: Reduces typing errors on mobile and ensures screen readers announce authentication errors immediately.
  - **Acceptance Criteria**: Toggle switches input `type="text"` <-> `type="password"`; error banner announces with `role="alert"`.
  - **Validation**: DOM attribute and state toggle validation.

- [x] **Task 9: Add password visibility toggle & accessible error alerts in Register**
  - **Target**: `frontend/src/app/auth/register/page.tsx`
  - **Change**:
    1. Add password visibility toggle button with `aria-label` and `aria-pressed`.
    2. Add `role="alert"` and `aria-live="assertive"` to the error container.
    3. Add `aria-invalid={Boolean(error)}` to inputs on error.
  - **Reason**: Parity with login; ensures accessible registration.
  - **Acceptance Criteria**: Toggle functions without form submission; screen readers receive instant error announcement.
  - **Validation**: DOM attribute and state toggle validation.

---

### Phase 5: Destructive Actions & Feedback in Applications

- [x] **Task 10: Replace `window.confirm` with `ConfirmationDialog` & polish feedback in `ApplicationActions`**
  - **Target**: `frontend/src/components/applications/application-actions.tsx`
  - **Change**:
    1. Replace `window.confirm()` calls (for deleting application and terminal status transitions) with `<ConfirmationDialog />`.
    2. Upgrade success message to an accessible banner with `role="status"` and `aria-live="polite"`.
    3. Upgrade error message with `role="alert"`, `aria-live="assertive"`, and clear high-contrast styling.
  - **Reason**: Prevents thread freezing from browser alerts and complies with NAIRA design system and accessibility standards.
  - **Acceptance Criteria**: Modal opens on destructive click; confirms or aborts cleanly; success and error states are announced to assistive tech.
  - **Validation**: Action flow and confirmation modal state tests.

---

### Phase 6: Resume Freshness, Copy & Print Polish

- [x] **Task 11: Display genuine `updatedAt` date in Resume header**
  - **Target**: `frontend/src/components/resume/resume-dossier-view.tsx`
  - **Change**: Format and display `activeVariant.updatedAt` in the header (e.g., `Updated Oct 2, 2026`). Omit if null. Never fabricate timestamps.
  - **Reason**: Gives candidates honest freshness feedback so they know whether scores reflect their latest changes.
  - **Acceptance Criteria**: Shows real backend timestamp formatted cleanly; zero mock dates.
  - **Validation**: Timestamp rendering against mock/database variant.

- [x] **Task 12: Add `CopyButton` and Print CTA in `ResumeDossierView`**
  - **Target**: `frontend/src/components/resume/resume-dossier-view.tsx`
  - **Change**: Integrate `<CopyButton />` for plain text/LaTeX resume preview and a "Print Resume" button (`onClick={() => window.print()}`).
  - **Reason**: Simplifies exporting and printing resumes for offline interviews and ATS review.
  - **Acceptance Criteria**: Clicking copy copies plain text/LaTeX to clipboard; clicking print opens native print preview with print stylesheet.
  - **Validation**: Click action verification.

- [x] **Task 13: Replace `window.confirm` with `ConfirmationDialog` in `VariantsPanel`**
  - **Target**: `frontend/src/components/resume/variants-panel.tsx`
  - **Change**: Replace raw `window.confirm()` when deleting resume variants with `<ConfirmationDialog />`. Also replace `window.confirm()` in `job-description-panel.tsx`.
  - **Reason**: Eliminates all remaining instances of browser blocking confirm across the resume workspace.
  - **Acceptance Criteria**: Deletion requires explicit modal confirmation with non-blocking UI.
  - **Validation**: Modal open/confirm/cancel lifecycle.

---

### Phase 7: Verification & Quality Assurance

- [x] **Task 14: Comprehensive Verification**
  - **Target**: Full repository
  - **Commands**:
    1. `npx tsc --noEmit` -> PASSED (0 errors)
    2. `npm run verify:schema` -> PASSED (36/36 tables, 24/24 enums, 95/95 indexes)
    3. `npm run test` (QA audit suites) -> PASSED (86/86 student flow, 52/52 security, 15/15 responsive UI)
    4. `npm run build` -> PASSED (62/62 static & dynamic routes compiled)
  - **Acceptance Criteria**: 0 TypeScript errors, schema parity maintained, all existing tests passing, clean production build.
