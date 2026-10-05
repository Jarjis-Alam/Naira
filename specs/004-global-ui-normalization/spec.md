# Feature Specification: NAIRA Global UI Normalization / De-Pill / De-Clutter Pass

**Feature Branch**: `specs/004-global-ui-normalization`  
**Created**: 2026-10-04  
**Status**: In Progress  
**Input**: User description: "NAIRA — GLOBAL UI NORMALIZATION / DE-PILL / DE-CLUTTER PASS. The current NAIRA UI has become visually clustered and over-componentized. The problem is the GLOBAL visual system: excessive pill-shaped controls, excessive rounded containers, cards inside cards, nested bordered surfaces, too many visual containers, excessive segmentation, too many competing hierarchy levels, excessive metadata badges, excessive small labels, too much UI chrome, dense horizontal control rows, inconsistent component shapes, rounded containers around things that do not need containers, every element looking like a separate 'component', excessive visual noise around the actual content."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Normalize Shared Primitives & Design Tokens (Priority: P1) 🎯 MVP

As a student navigating NAIRA, I want buttons, badges, pills, and cards to follow a restrained, consistent geometric hierarchy so that the interface feels calm, editorial, and technical rather than a collection of bubbly rounded capsules and nested boxes.

**Why this priority**: Shared primitives (`pill.tsx`, `badge.tsx`, `button.tsx`, `card.tsx`, `globals.css`) are consumed across every surface in NAIRA. Normalizing these primitives at the source eliminates over 70% of unnecessary pill shapes, aggressive border-radius values, and nested card borders in a single, systematic stroke without breaking page-specific logic.

**Independent Test**:
Can be fully tested by verifying that:
1. `Button` standard variants (`accent`, `outline`, `secondary`, `primary`) use restrained corner radii (`rounded-md` / 6px) instead of pill shapes (`rounded-full`).
2. `Pill` and `Badge` default to restrained geometry (`rounded-md` / `rounded-sm`) with clear hierarchy (`primary` status pill, `secondary` subtle metadata, `inline`/`plain` typography-first metadata).
3. `Card` defaults to subtle, intentional borders with no nested card container styling.
4. All existing button and badge unit/visual tests render cleanly without broken styles or TypeScript errors.

**Acceptance Scenarios**:
1. **Given** a standard page action button (e.g., "Upload New", "Run Diagnosis", "Export PDF"), **When** rendered on screen, **Then** it displays with restrained geometry (`rounded-md` or `var(--radius-buttons)`) and strong typography, not as a giant pill capsule.
2. **Given** metadata items (e.g., "Updated Sep 16, 2026", "LaTeX v3.14", "1 Page Standard"), **When** rendered in headers or summaries, **Then** they display as clean editorial text separated by subtle middots (`·`) or subtle dividers rather than individual capsule badges.
3. **Given** status badges (e.g., "Active", "Complete", "Draft", "ATS-Ready"), **When** displayed, **Then** only true status indicators retain pill or dot semantics, while ordinary attributes use standard restrained styling.

---

### User Story 2 - De-Pill and De-Clutter Page Headers and Status Strips (Priority: P2)

As a candidate preparing for interviews and optimizing my resume, I want page headers and top status strips (starting with the Resume Dossier view as visual evidence) to display clear title hierarchy, secondary actions with appropriate visual weight, and clean typography-first metrics rather than a horizontal conveyor belt of pills inside pills.

**Why this priority**: The Resume Dossier page header and its full-width status strip were highlighted as direct visual evidence of the problem. Giant pill containers wrapping inner pill cards create severe visual noise and reduce scannability.

**Independent Test**:
Can be verified by loading `/resume` (and corresponding views in `/target`, `/tests`, `/dashboard`):
1. The page header contains an unambiguous `h1` title, concise description, primary CTA, and cleanly grouped secondary controls.
2. The status strip is a calm, flat or subtly separated section (Level 1) rather than a giant rounded-full border capsule.
3. Metric displays (e.g. ATS score 72%, target role, last updated) rely on typography, labels, and clean tabular alignment rather than nested pill boxes inside pill containers.

**Acceptance Scenarios**:
1. **Given** the Resume Dossier view (`resume-dossier-view.tsx`), **When** viewed on desktop, **Then** the status strip uses a restrained surface (`rounded-lg` or flat with subtle border/divider), the 72% ATS score is an editorial metric, and metadata fields are plain text separated by clean spacers.
2. **Given** viewport resizing down to mobile widths, **When** examining page headers and control rows, **Then** buttons stack or wrap naturally without horizontal overflow or clipped capsule buttons.

---

### User Story 3 - Eliminate Nested Cards and Border Density Across Core Application Surfaces (Priority: P3)

As a user reading deep technical content (diagnostic reports, gap analysis, test catalog, study roadmaps, simulation feedback), I want information structured with typography, vertical rhythm, and thin separators rather than cards inside cards inside panels with multiple competing borders.

**Why this priority**: Deep diagnostic screens (`resume-dossier-view.tsx` right sidebar, `test-catalog.tsx`, `target/page.tsx`, `interview-coach-view.tsx`, `roadmap/page.tsx`) currently suffer from excessive card-nesting: outer card -> inner cards for each bullet -> pill tags inside each bullet -> border wrappers around text.

**Independent Test**:
Can be verified by auditing each major surface (`/resume`, `/tests`, `/target`, `/roadmap`, `/interview`, `/analytics`, `/dashboard`):
1. No section displays cards nested inside cards without clear functional separation.
2. Borders are reduced to structural dividing lines; decorative borders around small text labels are eliminated.
3. Whitespace and headings organize information blocks.

**Acceptance Scenarios**:
1. **Given** the Resume Analysis diagnostic panel, **When** reviewing Strengths and Gaps, **Then** each item is presented as a clean editorial list item with typography-led hierarchy, avoiding individual boxed cards with capsule pill tags.
2. **Given** the Test Catalog (`test-catalog.tsx`), **When** browsing categories and test cards, **Then** category selectors use restrained tabs or segmented controls without excessive pill styling, and cards present clean, non-competing surfaces.
3. **Given** Target Strategy (`target/page.tsx`) and Interview Coach (`interview-coach-view.tsx`), **When** reading feedback and recommendations, **Then** badges are reserved for meaningful severity/status and container noise is eliminated.

---

### User Story 4 - Normalize Sidebar and Top Header Chrome (Priority: P4)

As a user navigating between sections, I want the sidebar and top application header to provide calm, unobtrusive orientation without large rounded navigation capsules, decorative container borders, or noisy badge clusters.

**Why this priority**: The persistent chrome (sidebar + top header) frames every page. When the chrome is over-componentized with pill buttons, borders around every icon, and heavy card wrappers around the user profile and momentum widget, it adds constant visual fatigue.

**Independent Test**:
Can be verified by inspecting `sidebar.tsx` and `top-header.tsx`:
1. Nav items use subtle hover/active states with restrained geometry (`rounded-md`).
2. Momentum and User Profile sections use calm surface integration without nested card borders.
3. Top header displays clean breadcrumbs/title on the left and essential, restrained actions on the right.

**Acceptance Scenarios**:
1. **Given** the navigation sidebar, **When** moving between items, **Then** active items show a clean, restrained highlight without thick rounded-full capsules.
2. **Given** the top header, **When** inspecting action controls (e.g. notifications, status indicator, action buttons), **Then** they avoid unnecessary capsule wrappers and render with restrained geometry.

---

## Edge Cases

- **Avatars & Pure Status Dots**: User profile avatars, circular icon triggers, and small colored indicator dots (e.g. green online dot) MUST remain genuinely circular (`rounded-full`) as they represent standard Level 4 semantic elements.
- **Progressive Disclosure & Dropdowns**: When secondary header actions are collapsed into "More" or dropdown menus on mobile, dropdown containers should maintain restrained radius (`rounded-md` / `rounded-lg`) and crisp list item styling.
- **Existing Automated Tests**: Any test that queries by role or text must continue to pass because no semantic roles, text content, or button labels are removed or altered.
- **Empty States**: Empty state views must follow the clean editorial layout (icon + heading + body + primary action) without decorative dashed outer cards enclosing inner empty cards.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST update global design tokens in `globals.css` to restrain default corner radii (`--radius-buttons`: `6px`, `--radius-cards`: `8px`, `--radius-pills`: reserved for avatars/status indicators).
- **FR-002**: `components/ui/button.tsx` MUST use restrained corner radii (`rounded-md` / `6px`) across all action button variants (`primary`, `secondary`, `outline`, `accent`, `ghost`).
- **FR-003**: `components/ui/pill.tsx` and `components/ui/badge.tsx` MUST default to restrained geometry (`rounded-md` / `rounded-sm`) and offer an inline/plain variant that renders clean typography without capsule borders.
- **FR-004**: `components/ui/card.tsx` MUST use restrained radii (`rounded-lg` / `rounded-md`) and subtle hairline borders, avoiding nested double-border patterns.
- **FR-005**: `resume-dossier-view.tsx` MUST replace the full-width `rounded-full` status strip with a calm, flat or subtly separated section, and replace capsule metadata badges with editorial typography and inline separators.
- **FR-006**: `resume-dossier-view.tsx` MUST replace nested card-in-card diagnostic items in the right sidebar with clean editorial list items.
- **FR-007**: `test-catalog.tsx`, `target/page.tsx`, `interview-coach-view.tsx`, and `roadmap/page.tsx` MUST replace excessive pill badges and nested container cards with clean typography and restrained chips.
- **FR-008**: `sidebar.tsx` and `top-header.tsx` MUST normalize navigation items and account widgets to restrained geometry, removing heavy pill capsules and nested container borders.
- **FR-009**: All existing business logic, ATS scoring calculations, readiness formulas, authentication, and database schemas MUST remain 100% untouched.

---

## Success Criteria *(mandatory)*

- **SC-001**: Total `rounded-full` count in `frontend/src/` is reduced by at least 60% (from 381 to under 150), with remaining usages strictly confined to avatars, circular icon buttons, and status indicator dots.
- **SC-002**: Page headers across all primary routes (Resume, Target, Tests, Interview, Roadmap, Dashboard) present a clear hierarchy (H1 -> description -> primary CTA -> secondary actions) without packed horizontal pill rows.
- **SC-003**: Zero instances of card-inside-card with redundant borders remain in core diagnostic or dossier views.
- **SC-004**: Full TypeScript typecheck passes with 0 errors (`npx tsc --noEmit`).
- **SC-005**: Production Next.js build succeeds cleanly (`npm run build`).
- **SC-006**: Existing regression test suites (DB schema, auth, test suites) pass with 100% parity.
