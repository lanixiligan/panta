---
name: Panta
description: Your work, over time.
colors:
  forest-night: "#07110C"
  sidebar-moss: "#0B1510"
  surface-pool: "#101F16"
  raised-stone: "#15291D"
  pressed-stone: "#1A3324"
  divider: "#1F3C2C"
  border: "#2B523B"
  border-strong: "#33664A"
  control-border: "#3D7A52"
  ink: "#E0EDE4"
  ink-secondary: "#A8C5B2"
  ink-muted: "#8DA898"
  ink-faint: "#587062"
  signal-green: "#34C77B"
  signal-green-soft: "#5FD394"
  action-green: "#2A9D5C"
  level-1: "#1D4A30"
  level-2: "#23703F"
  level-3: "#33A05E"
  level-4: "#45C47A"
  additions: "#82C895"
  deletions: "#C58D81"
  danger: "#E0A397"
  danger-bg: "#1C1412"
  light-paper: "#D4EDDE"
  light-surface: "#F3FBF6"
  light-ink: "#0F2418"
  light-signal-green: "#187F47"
typography:
  display:
    fontFamily: "DM Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(28px, 2.9vw, 36px)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.015em"
  title:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.45
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
  figure:
    fontFamily: "DM Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  label:
    fontFamily: "DM Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "0.05em"
rounded:
  xs: "2px"
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  pill: "999px"
spacing:
  "0-5": "2px"
  "1": "4px"
  "1-5": "6px"
  "2": "8px"
  "2-5": "10px"
  "3": "12px"
  "3-5": "14px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "7": "28px"
  "8": "32px"
  "10": "40px"
  "12": "48px"
  "14": "56px"
  "16": "64px"
components:
  button-primary:
    backgroundColor: "{colors.sidebar-moss}"
    textColor: "{colors.signal-green-soft}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "38px"
  button-primary-hover:
    backgroundColor: "{colors.sidebar-moss}"
    textColor: "{colors.ink}"
  button-subtle:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-subtle-hover:
    backgroundColor: "{colors.raised-stone}"
    textColor: "{colors.ink}"
  button-pressed:
    backgroundColor: "{colors.pressed-stone}"
  card:
    backgroundColor: "{colors.surface-pool}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "20px 24px"
  input:
    backgroundColor: "{colors.sidebar-moss}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "38px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "40px"
  nav-item-hover:
    backgroundColor: "{colors.surface-pool}"
    textColor: "{colors.ink}"
  badge:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "4px 6px"
---

# Design System: Panta

## Overview

**Creative North Star: "The Riverbed"**

Panta takes its name from *panta rhei*, "everything flows." The interface is the riverbed that the work flows over: steady, layered, unhurried. Surfaces are stacked dark greens, each one a small tonal step above the last, like water deepening toward the bed. Nothing on the page competes for attention. The single living colour, Signal Green, appears in small marks: the live dot, the active nav icon, a tick, a hairline border on the primary action.

The density is calm rather than sparse. Pages carry only what is necessary, each number shown once, and figures are set in DM Mono so declared time and observed activity read as plain fact rather than performance. Components are soft and tactile: generously rounded cards (12px), pressed states that visibly darken, and borders that brighten on hover. Depth comes from tonal layering, not shadows; shadows are reserved for things that genuinely float.

Dark is the signature and the default. The light theme is the same river by day: pale green-tinted paper, dark green ink, the same greens deepened to keep WCAG AA. On large screens the whole interface scales with CSS `zoom` (1.125 from 1500px, 1.25 from 1800px) so it stays comfortable at a distance.

**Key Characteristics:**
- Stacked dark-green surfaces; depth by tone, not shadow.
- One accent, used as marks and hairlines, never as large fills.
- DM Sans for words, DM Mono for figures, labels, and code.
- Soft, tactile components: 12px cards, 6px controls, a visible pressed state on everything clickable.
- No animated or WebGL backgrounds; motion is short, decorative, and fully removed under reduced motion.

## Colors

A monochrome green world: forest-black surfaces, pale green-grey ink, and one bright signal green.

### Primary
- **Signal Green** (`signal-green`): the live dot, ticks, active markers, the today underline, chart highlights, and the focus ring. Small marks only.
- **Signal Green Soft** (`signal-green-soft`): links, hover text, the primary button's label, and any larger highlighted area. It is the readable form of the accent.
- **Action Green** (`action-green`): the rare solid green button (sign-in, the skip link). Text on it uses the near-black action text.

### Neutral
- **Forest Night** (`forest-night`): the page background.
- **Sidebar Moss** (`sidebar-moss`): the sidebar, input fields, and the primary button face.
- **Surface Pool** (`surface-pool`): cards and sections; also the soft hover fill for nav items.
- **Raised Stone** (`raised-stone`): row and card hover, selected segments, raised controls.
- **Pressed Stone** (`pressed-stone`): the held state of every clickable element.
- **Divider / Border / Border Strong / Control Border**: list dividers, card borders, emphasised borders, and input borders (control borders keep 3:1 against their surface).
- **Ink / Ink Secondary / Ink Muted**: primary, supporting, and metadata text. **Ink Faint** is decorative only (separators, empty calendar days), never for words.

### Data
- **Levels 1–4** (`level-1`…`level-4`): calendar and chart shades from low to high.
- **Additions / Deletions** (`additions`, `deletions`): line-change figures, a soft green and a muted clay.
- File-type colours on Session detail (`--workspace-type-0`…`5`) each keep 3:1 against the surface.

### Danger
- **Danger / Danger Bg** (`danger`, `danger-bg`): errors and destructive actions, a dusty rose on a near-black brown. Never bright red.

### Light theme
`:root[data-theme="light"]` overrides colours only: Light Paper (`light-paper`) background, Light Surface (`light-surface`) cards, Light Ink (`light-ink`) text, and the accent deepened to `light-signal-green`. Every text pair meets WCAG AA. The brand greens (`--brand-green`, `-mid`, `-deep`) are identical in both themes.

### Named Rules
**The Small Marks Rule.** Signal Green appears as dots, ticks, hairlines, and icons. Anything larger than a control's border uses Signal Green Soft or a level shade instead.

**The Two Themes Rule.** Every new colour token gets a light value, checked for AA (4.5:1 text, 3:1 marks and control borders), before it ships.

**The Tokens Only Rule.** Components use `--workspace-*` tokens, never raw hex. New colours are proposed before they are added.

## Typography

**Body Font:** DM Sans (with -apple-system, Segoe UI, sans-serif), loaded at 400–700
**Label/Mono Font:** DM Mono (with ui-monospace, Menlo, monospace), loaded at 400 and 500

**Character:** DM Sans is soft-geometric and friendly for words; DM Mono gives figures, durations, and labels the plain, recorded feel of a logbook entry.

### Hierarchy
- **Display** (600, clamp 28–36px, 1.15, −0.025em): page titles only, one per page.
- **Headline** (600, 17px, −0.015em): section headings in cards and lists.
- **Title** (500, 15px): goals, list primary lines, intro text.
- **Body** (400, 13–14px, 1.55): running text, controls, supporting copy.
- **Figure** (DM Mono 400, 24px, −0.02em): prominent numbers on stat cards; 30px for the largest.
- **Timer** (DM Mono 400, 40–84px by the width of its band, −0.05em): the running and finished session time in the Session Workspace. The session goal heading beside it runs 22–26px. Both are one-off display sizes and size from their container, so they never overflow a narrow panel.
- **Label** (DM Mono 400, 12px, +0.05em): metadata, durations, badges, kickers.

### Named Rules
**The 12px Floor Rule.** Nothing people read is smaller than 12px (`--text-2xs`).

**The Mono Means Measured Rule.** Recorded values (durations, counts, line changes, times) are set in DM Mono; words are set in DM Sans.

## Layout

A fixed 254px sidebar on the left with the main column scrolling beside it; content is capped at 1120px (workspace pages up to 1600px) with fluid side padding `clamp(24px, 5vw, 64px)`. Spacing follows a 2px scale to 16px, then 4px and 8px steps (`--space-*`). Cards pad 20px × 24px; sections stack with 24px gaps.

Session detail and Analytics fit the window on screens at least 1024 × 600 and scroll internally; elsewhere pages scroll. In the Session Workspace, Setup is two columns in a fixed frame from 1080px of window width (the sidebar takes 254px of it) and stacks and scrolls below that. Active Session and Recap are a band for what you declared above a card for what GitHub observed; the band is one row (clock, session, actions) from 1200px and stacks below it. Below 680px the sidebar becomes a floating pill tab bar 12px above the bottom edge, and two-column layouts (Active Session, Recap) stack. Viewport units are always written as `calc(100vh / var(--ui-zoom))` because the interface zooms on large screens.

## Elevation & Depth

Flat by default, with depth carried by tonal layering: Forest Night → Sidebar Moss → Surface Pool → Raised Stone → Pressed Stone. Cards are distinguished by a one-step-lighter fill and a 1px border, never a shadow. Shadows exist only for layers that float above the page.

### Shadow Vocabulary
- **Menu** (`--shadow-menu`: `0 9px 24px` shadow): the account menu and small dropdowns.
- **Popover** (`--shadow-popover`: `0 18px 40px` shadow): filter popovers and the date-range picker.
- **Tooltip** (`--shadow-tooltip`: `0 6px 20px` shadow): chart and calendar tooltips.
- **Focus halo** (`--shadow-focus`: `0 0 0 3px` translucent green): focused inputs and filter triggers.
- **Live glow** (`0 0 8px` accent glow): only on the running-session dot.

### Named Rules
**The Only Floaters Cast Shadows Rule.** If it isn't a menu, popover, or tooltip, it has no shadow.

## Shapes

Soft, consistent rounding: 12px on cards, sections, and stat tiles; 6px on buttons, inputs, nav items, and filters; 4px on badges; 2px on tiny marks; full pills on the mobile tab bar and status dots. Borders are always 1px, and dashed borders mark example content.

## Components

### Buttons
Soft and tactile, never loud.
- **Shape:** gently rounded (6px), 38px tall by default, 32px compact, 44px for touch or primary.
- **Primary:** a dark Sidebar Moss face, Signal Green Soft label, and a green control border (the Session Workspace's Start session button). Hover brightens the border to `level-4` and the label to Ink.
- **Subtle:** transparent with a 1px border and Ink Secondary label; hover fills Raised Stone and the text turns Ink.
- **Text link:** no border or fill; hover turns Signal Green Soft.
- **Solid green:** Action Green with near-black text, reserved for sign-in and the skip link; it dips 1px when pressed.
- **Pressed:** every clickable element fills Pressed Stone while held; destructive buttons switch to the danger border and background.
- **Disabled:** Raised Stone fill, Ink Muted text, plain border.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Surface Pool on Forest Night.
- **Shadow Strategy:** none (see Elevation).
- **Border:** 1px `border`.
- **Internal Padding:** 20px × 24px; stat tiles 14px × 16px.
- Whole rows and cards are the link; hover fills Raised Stone.

### Inputs / Fields
- **Style:** Sidebar Moss field, 1px control border (3:1), 6px radius, 38px tall.
- **Focus:** the border turns green and a 3px translucent green halo appears.
- **Error:** inline one-line danger message on Danger Bg with a Danger border.

### Navigation
Sidebar items are 40px tall, Ink Secondary at rest, Surface Pool on hover. The active item has no fill: Ink text at weight 500 and a Signal Green Soft icon. While a session runs, an Active session card with a glowing live dot appears at the foot of the sidebar. On phones, navigation becomes a floating pill tab bar whose active item is marked by a 4px green dot beneath the icon.

### Badges
Mono 12px labels with a 1px border and 4px radius. They mark exceptions only: `Private` (stronger border), `Example` (dashed border, muted text), or a non-completed status.

### Session Workspace title
Setup's title is a greeting by the hour and first name ("Good evening, Lanix"); Active and Recap keep plain titles.

### Session commit list (signature)
GitHub activity is a list of commits, newest first, in its own scroll area: message in Ink, time and line changes in DM Mono with Additions and Deletions colours. It stays visually apart from the declared session column, so declared time and observed activity never merge.

## Do's and Don'ts

### Do:
- **Do** layer depth with the surface ladder (Forest Night → Surface Pool → Raised Stone) and 1px borders.
- **Do** keep Signal Green to small marks; use Signal Green Soft for text and larger areas.
- **Do** set recorded values in DM Mono and keep every readable size at 12px or above.
- **Do** give every clickable element a hover, a visible `:focus-visible` ring, and the Pressed Stone held state.
- **Do** define a light value for every new colour and check it for AA.

### Don't:
- **Don't** use raw hex values or off-scale sizes in components; use the tokens.
- **Don't** add shadows to cards or sections.
- **Don't** fill large areas with the accent or add new hues without proposing them first.
- **Don't** add animated or WebGL backgrounds, or motion that survives `prefers-reduced-motion`.
- **Don't** use Ink Faint for words.
- **Don't** add fonts beyond DM Sans and DM Mono.
