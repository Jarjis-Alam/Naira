---
name: Nexora Placement OS
colors:
  surface: '#111413'
  surface-dim: '#111413'
  surface-bright: '#373a38'
  surface-container-lowest: '#0c0f0e'
  surface-container-low: '#191c1b'
  surface-container: '#1d201f'
  surface-container-high: '#282b29'
  surface-container-highest: '#323534'
  on-surface: '#e1e3e1'
  on-surface-variant: '#becbb3'
  inverse-surface: '#e1e3e1'
  inverse-on-surface: '#2e3130'
  outline: '#88957f'
  outline-variant: '#3f4a38'
  surface-tint: '#6fdf3e'
  primary: '#ffffff'
  on-primary: '#0f3900'
  primary-container: '#8afd58'
  on-primary-container: '#287300'
  inverse-primary: '#256d00'
  secondary: '#a8c8ff'
  on-secondary: '#003061'
  secondary-container: '#0259ab'
  on-secondary-container: '#b9d2ff'
  tertiary: '#ffffff'
  on-tertiary: '#381385'
  tertiary-container: '#e8ddff'
  on-tertiary-container: '#6d51bc'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#8afd58'
  primary-fixed-dim: '#6fdf3e'
  on-primary-fixed: '#062100'
  on-primary-fixed-variant: '#1a5200'
  secondary-fixed: '#d5e3ff'
  secondary-fixed-dim: '#a8c8ff'
  on-secondary-fixed: '#001b3c'
  on-secondary-fixed-variant: '#00468a'
  tertiary-fixed: '#e8ddff'
  tertiary-fixed-dim: '#cebdff'
  on-tertiary-fixed: '#21005e'
  on-tertiary-fixed-variant: '#4f319c'
  background: '#111413'
  on-background: '#e1e3e1'
  surface-variant: '#323534'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1.25rem
  margin: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system embodies a modern, technical, and high-performance operating environment tailored for ambitious candidates preparing for top-tier careers. The visual tone balances clinical precision with engaging vitality through deep graphite voids accented by vivid, luminous semantic hues. 

The aesthetic is built on a dark, technical glass-and-slate substrate. Rather than feeling cold or purely utilitarian, it projects momentum, hyper-focus, and clarity. The experience conveys an intelligent co-pilot: organized, structured, and rewarding. The visual grammar balances expansive negative space with pill-shaped interactive anchors, creating an intuitive mental model where bright semantic indicators guide user attention without visual clutter.

## Colors

The palette operates on an obsidian canvas hierarchy with carefully budgeted semantic accent pops:

- **Canvas & Surfaces:**
  - Background Canvas: `#070909`
  - Base Surface (Cards & Sidebars): `#101312`
  - Elevated Surface (Inner Containers, Inputs, Hover States): `#151817`
  - Structural Borders: `#242A27`
  - Subtle Overlay / Translucent Fill: `rgba(255, 255, 255, 0.03)`

- **Typography & Monochrome Scales:**
  - Primary Text: `#F2F4F1` (crisp, high legibility)
  - Secondary Text: `#A8B0AA` (balanced reading level)
  - Muted / Disabled Text: `#68716B` (metadata, shortcuts, inactive borders)

- **Semantic Color Roles:**
  - **Electric Lime (`#8CFF5A`):** Core call-to-action triggers, progress velocity, mastery, and success states.
  - **Cobalt Azure (`#6EA8FF`):** ATS matching, resume metrics, deep data structures, and algorithmic health.
  - **Amethyst Iris (`#A78BFA`):** AI simulations, analytical intelligence, predictive insights, and deep mock interviews.
  - **Solar Amber (`#F6C453`):** Critical review tags, deliberate practice interventions, warnings, and time-sensitive milestones.
  - **Coral Rose (`#F472B6`):** Actionable outcome signals, direct notifications, and critical blockers.

Accent colors are strictly limited to actionable targets, glyph badges, indicator pips, and micro-metric bars. Large surface fills avoid full saturation to preserve high contrast and prevent eye fatigue.

## Typography

The typography couples the technical geometry of **Space Grotesk** for headings with the ergonomic readability of **Plus Jakarta Sans** for body content, tables, and micro-interfaces.

- **Display & Headlines:** Headings use Space Grotesk with snug letter-spacing to reinforce an engineered, programmatic command-center presence.
- **Body & Microcopy:** Handled by Plus Jakarta Sans to maintain clarity across dense metrics, metadata grids, and high-frequency tables.
- **Labels & Badges:** `label-sm` leverages uppercase styling with wide tracking (`0.06em`) for categorical pill tags, meta badges, and status pills.

## Layout & Spacing

The design system operates on a responsive fluid layout built around a standard 8pt grid with 4pt half-steps for compact interface components.

- **Global Viewport & Shell:**
  - Desktop: Dedicated 260px fixed-width left navigation rail with an inner layout canvas spanning the remaining width.
  - Breakpoints: Desktop (`≥1280px`), Tablet / Compact Desktop (`768px - 1279px`), Mobile (`<768px`).
  - Tablet adaptations collapse the sidebar into an icon-only dock or off-canvas drawer; metric cards convert to a 2-column flow.
  - Mobile stacks metric tiles vertically into full-width cards with horizontal scroll for pill filters.

- **Rhythm & Gaps:**
  - Card Interior Padding: Standard cards utilize `space-lg` (24px) for breathing room; dense internal widgets and metric blocks use `space-md` (16px).
  - Component Stacks: Sections separate using `space-xl` (32px), preserving typographic breathing room without visual over-segmentation.

## Elevation & Depth

This system intentionally rejects heavy drop shadows, instead using precise tonal containment and soft internal illumination:

- **Surface Layering:** Depth is conveyed through three surface steps: Base Canvas (`#070909`), Structural Surface (`#101312`), and Interactive Elevated Surface (`#151817`).
- **Low-Contrast Ghost Outlines:** All containers, modals, and pill indicators feature a consistent hairline stroke of `1px solid #242A27`. This defines borders cleanly against dark backgrounds without distracting contrasts.
- **Ambient Chromatic Glows:** High-priority elements (such as the primary active state or hero motivational widgets) feature subtle, diffused backdrops (e.g., `radial-gradient(circle at top right, rgba(140, 255, 90, 0.08), transparent 70%)`).
- **Backdrop Blurs:** Floating navigation bars and dropdown menus employ `backdrop-filter: blur(16px)` with 80% opacity dark backgrounds.

## Shapes

The design system pairs clean, architectural containers with fully rounded pill-shaped controls:

- **Interactive Elements & Pills:** Buttons, filter chips, category markers, input wrappers, and avatar chips use a full pill radius (`roundedness: 3`, or `9999px`).
- **Cards & Primary Modules:** Main content blocks, metrics dashboards, and layout shells feature a structured curvature between `16px` and `20px` (`rounded-xl`), creating a soft, cohesive frame for dense content.
- **Micro Badges & Embedded Progress Tracks:** Small tags and linear progress bars feature full pill caps to maintain a uniform visual thread.

## Components

- **Buttons:**
  - *Primary Button:* Solid fill using Electric Lime (`#8CFF5A`), dark text (`#070909`), `font-weight: 600`, pill radius (`9999px`), horizontal padding `space-lg` (24px), vertical padding `space-sm` (10px).
  - *Secondary / Ghost Button:* Dark elevated surface (`#151817`), hairline border (`1px solid #242A27`), primary text (`#F2F4F1`). Interactive hover shifts border color to `#68716B` with a subtle scale transformation.
  - *Outline Action Pill:* Transparent background, border `1px solid #242A27`, text `#A8B0AA`, with semantic hover tints.

- **Chips & Filter Tabs:**
  - Tab pills feature an active toggle style. Unselected pills use background `#101312`, text `#A8B0AA`, border `#242A27`.
  - Selected pills swap to high-contrast fills (e.g., solid `#8CFF5A` with `#070909` text or tinted dark surfaces with matching saturated outlines).

- **Metric & Content Cards:**
  - Constructed on `#101312` with a `1px solid #242A27` border and `18px` corner radius.
  - Cards emphasize internal typographic hierarchy: clear secondary label headers, bold numeric values in Space Grotesk, followed by full-pill linear tracking indicators.

- **Inputs & Search Bars:**
  - Pill-shaped field (`border-radius: 9999px`), background `#101312`, border `1px solid #242A27`, text `#F2F4F1`.
  - Prefix search icons in `#68716B`; keyboard shortcut indicators styled as subtle inner pill capsules with `#151817` backgrounds.

- **Status Badges & Progress Bars:**
  - Status badges use uppercase `label-sm` type, with a 20% alpha background tint paired with a solid text and icon foreground (e.g., Amber tag: background `rgba(246, 196, 83, 0.15)`, text `#F6C453`).
  - Progress tracks use dark channel bars (`#151817` with border `#242A27`) with full-radius active fill runners mapped to their respective semantic accent.

- **Lists & Data Tables:**
  - Row dividers rely on hairline borders (`1px solid rgba(36, 42, 39, 0.6)`).
  - Hover states on interactive list items trigger a subtle background shift to `#151817` with a 4px left-accent indicator pip.