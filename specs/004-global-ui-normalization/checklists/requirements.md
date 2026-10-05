# Requirements Checklist: NAIRA Global UI Normalization

## Core Architectural & Visual Requirements

- [ ] CHK001: All design tokens updated in `frontend/src/app/globals.css` with restrained border radius values.
- [ ] CHK002: `components/ui/button.tsx` updated to use restrained geometry (`rounded-md`) for all button variants instead of `rounded-full` or oversized pills.
- [ ] CHK003: `components/ui/pill.tsx` and `components/ui/badge.tsx` updated to default to `rounded-md` / `rounded-sm` with support for plain/inline typography metadata.
- [ ] CHK004: `components/ui/card.tsx` updated to eliminate nested borders and enforce clean Level 1/Level 3 surfaces.
- [ ] CHK005: `resume-dossier-view.tsx` full-width pill container de-pilled to calm editorial bar.
- [ ] CHK006: `resume-dossier-view.tsx` header actions and metadata normalized to typography + clean separation.
- [ ] CHK007: `resume-dossier-view.tsx` right sidebar diagnostic cards de-nested and converted to editorial lists.
- [ ] CHK008: `test-catalog.tsx` normalized (filter tabs, test card containers, pill badges).
- [ ] CHK009: `target/page.tsx` normalized (company cards, tier pills, role badges).
- [ ] CHK010: `interview-coach-view.tsx` normalized (feedback cards, score pills, question list).
- [ ] CHK011: `roadmap/page.tsx` normalized (milestone nodes, progress capsules, task cards).
- [ ] CHK012: `components/layout/sidebar.tsx` normalized (nav items, momentum container, user profile).
- [ ] CHK013: `components/layout/top-header.tsx` normalized (breadcrumb, status pill, search/notifications).
- [ ] CHK014: Zero functional, business logic, ATS formula, or database schema changes.
- [ ] CHK015: TypeScript compilation passes (`npx tsc --noEmit`).
- [ ] CHK016: Next.js production build succeeds (`npm run build`).
- [ ] CHK017: Schema verification passes (`npm run verify:schema`).
