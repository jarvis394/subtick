---
name: subtick
description: Automatic CS2 highlight clips for a group of friends, rendered in-game from their own demos.
colors:
  background: '#f7f7f7'
  surface: '#ffffff'
  surface-2: '#efefef'
  surface-3: '#e4e4e4'
  border: 'rgb(17 17 17 / 0.09)'
  border-strong: 'rgb(17 17 17 / 0.16)'
  foreground: '#111111'
  muted: '#6b6b6b'
  accent: 'rgb(41 116 207)'
  accent-hover: '#2363b0'
  accent-foreground: '#ffffff'
  link: '#2363b0'
  brand: 'rgb(227 135 23)'
  brand-text: '#9a5200'
  danger: '#c8442f'
  danger-solid: '#bf2f1d'
  danger-solid-hover: '#cc3824'
  success: '#29703a'
  side-ct: '#3f78bd'
  side-t: '#b9852a'
  side-t-text: '#8a6118'
  dark-background: '#111111'
  dark-surface: '#181818'
  dark-surface-2: '#212121'
  dark-surface-3: '#2b2b2b'
  dark-foreground: '#f2f2f2'
  dark-muted: '#8f8f8f'
typography:
  hero:
    fontFamily: "'VK Sans Display', ui-sans-serif, system-ui, sans-serif"
    fontSize: '36px'
    lineHeight: '40px'
    letterSpacing: '-0.025em'
  display:
    fontFamily: "'VK Sans Display', ui-sans-serif, system-ui, sans-serif"
    fontSize: '30px'
    lineHeight: '36px'
    letterSpacing: '-0.025em'
  section:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: '24px'
    lineHeight: '32px'
    fontWeight: 500
  heading:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: '20px'
    lineHeight: '28px'
    fontWeight: 500
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: '18px'
    lineHeight: '26px'
    fontWeight: 500
  lead:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: '15px'
    lineHeight: '22px'
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: '14px'
    lineHeight: '20px'
  small:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: '13px'
    lineHeight: '20px'
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: '12px'
    lineHeight: '16px'
    fontWeight: 500
  caption:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: '12px'
    lineHeight: '16px'
  micro:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: '11px'
    lineHeight: '14px'
  mono:
    fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace"
    fontSize: '13px'
    lineHeight: '20px'
rounded:
  sm: '4px'
  md: '6px'
  lg: '8px'
  control: '10px'
  xl: '12px'
  2xl: '16px'
  full: '9999px'
spacing:
  '1': '4px'
  '1.5': '6px'
  '2': '8px'
  '3': '12px'
  '4': '16px'
  '5': '20px'
  '6': '24px'
  '8': '32px'
  '10': '40px'
components:
  button-primary:
    backgroundColor: '{colors.foreground}'
    textColor: '{colors.background}'
    rounded: '{rounded.control}'
    height: '36px'
    padding: '0 14px'
    typography: '{typography.body}'
  button-primary-brand:
    backgroundColor: '{colors.brand}'
    textColor: '#ffffff'
    rounded: '{rounded.control}'
    height: '36px'
    padding: '0 14px'
  button-primary-danger:
    backgroundColor: '{colors.danger-solid}'
    textColor: '#ffffff'
    rounded: '{rounded.control}'
    height: '36px'
    padding: '0 14px'
  button-secondary:
    backgroundColor: '{colors.surface-2}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.control}'
    height: '36px'
    padding: '0 14px'
  button-secondary-hover:
    backgroundColor: '{colors.surface-3}'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.muted}'
    rounded: '{rounded.control}'
    height: '36px'
    padding: '0 14px'
  button-ghost-hover:
    backgroundColor: '{colors.surface-2}'
    textColor: '{colors.foreground}'
  input:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.control}'
    height: '40px'
    padding: '0 12px'
    typography: '{typography.lead}'
  chip:
    backgroundColor: 'transparent'
    textColor: '{colors.muted}'
    rounded: '{rounded.full}'
    height: '28px'
    padding: '0 10px'
    typography: '{typography.small}'
  chip-pressed:
    backgroundColor: '{colors.foreground}'
    textColor: '{colors.background}'
  badge:
    backgroundColor: '{colors.surface-2}'
    textColor: '{colors.muted}'
    rounded: '{rounded.md}'
    height: '20px'
    padding: '0 6px'
    typography: '{typography.caption}'
  card:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.2xl}'
    padding: '20px'
  tabs-segmented:
    backgroundColor: '{colors.surface-2}'
    rounded: '{rounded.control}'
    padding: '2px'
---

# Design System: subtick

## Overview

**Creative North Star: "The Replay Desk"**

subtick is a precise tool for reviewing play. The chrome is neutral grey and stays out of the way so that the data (scoreboards, round timelines, killfeeds) reads at a glance, and every clip is one tap from wherever you are. Density is that of a working desk, not a gallery. Tables, rows and small labels are packed and exact, and tabular numerals keep the columns steady.

Color is functional before it is expressive. Blue means "you can act here". CS2 orange belongs to the game's own moments (aces, MVPs, highlights, the dot in the wordmark). CT blue and T gold mark sides wherever teams appear. Everything else is greyscale, in matched light and dark themes that follow the system.

Controls are soft and tactile. They have rounded corners, a background layer that gives a pixel when pressed, and colors that fade instead of snapping. Depth is mostly flat, but it runs both ways. Tracks and wells sit below the surface, and only things that genuinely float (menus, tooltips, dialogs, the clip viewer) rise above it on a shadow.

**Key Characteristics:**

- Neutral greyscale chrome. Color only carries meaning: action, the game's moments, team sides, status.
- A display voice for the wordmark and page titles; system sans for everything you operate.
- One theme-driven type scale and theme-driven radii. No raw sizes.
- Flat surfaces with hairline borders. Recessed tracks below, floating shadows above.
- Tactile controls: a pressable background layer, 150 ms color fades, quart/expo ease-outs.
- Page changes lift and fade out, then the new page settles in (view transitions, 125 ms + 125 ms).

## Colors

A greyscale desk with three meaningful hues (action blue, CS2 orange, team sides), each tuned per theme for contrast.

### Primary

- **Action Blue** (accent): interactive emphasis, focus rings, active inputs, selection tint. **Deep Action Blue** (accent-hover, link) carries hover and link text, dark enough to read on the light surface.

### Secondary

- **CS2 Orange** (brand): the game's own moments, meaning highlight attention, the `brand` button tone (for example "retry a failed recording"), and the wordmark's period. **Burnt Orange** (brand-text) is the same brand as text on light surfaces, where the raw orange is too light to read. In dark mode it is the orange itself.

### Tertiary

- **CT Blue** (side-ct) and **T Gold** (side-t, with side-t-text as deeper text): team identity in scoreboards, badges and timelines. They are never used for anything else.
- **Signal Red** (danger, danger-solid) and **Field Green** (success): status only. Solid red fills are deep enough for white text (≥ 4.5:1) in both themes.

### Neutral

- **Desk Grey** (background): the page canvas outside the app shell. Inside the shell the page is the surface color.
- **Paper White** (surface): cards, the shell, popups.
- **Well Grey** (surface-2) and **Pressed Grey** (surface-3): secondary button fills and their hover state, recessed tracks, skeletons, the step markers.
- **Ink** (foreground) and **Pencil** (muted): text and secondary text. Muted is also the resting color for ghost controls.
- **Hairline** (border) and **Firm Hairline** (border-strong): low-alpha foreground lines. Border separates surfaces; border-strong outlines inputs and chips.
- The dark theme maps the same roles onto near-black steps (dark-background → dark-surface-3).

### Named Rules

**The Meaning-Only Hue Rule.** A hue appears only when it says something: blue means you can act, orange marks a game moment, CT blue and T gold mark sides, red and green mark status. Decorative color is not allowed.

**The Orange Belongs to the Game Rule.** CS2 orange marks highlights, aces, MVPs and the wordmark. It is never used for generic UI emphasis; that is blue's job.

**The Derived Fill Rule.** Hover and soft fills are derived from the palette with `color-mix` (contrast-hover, brand-soft, danger-soft…), so both themes follow without separate values. Don't hand-pick a hover hex.

## Typography

**Display Font:** VK Sans Display (bundled, 400–700; system sans fallback)
**Body Font:** system sans (ui-sans-serif, with system-ui, Segoe UI, Roboto)
**Label/Mono Font:** system mono (ui-monospace, with SF Mono, Menlo)

**Character:** A confident display sans for the name and the page titles, set against a plain, native sans that does the work. The display face says "this is your record"; the sans says "here is the data".

### Hierarchy

- **Hero / Display** (display face, 36/40 and 30/36, tight tracking): page titles ("Set up subtick"), empty and error states, auth screens.
- **Section / Heading / Title** (sans 500, 24/32, 20/28, 18/26): section heads, card and dialog titles. The wordmark uses the display face at heading size.
- **Lead** (15/22): input text, highlight card titles, large-button labels.
- **Body** (14/20): the default for UI text and md buttons.
- **Small** (13/20): secondary lines, field labels and descriptions, chips, sm buttons.
- **Label / Caption** (12/16): xs buttons, tooltips. Badges use caption in uppercase with wide tracking.
- **Micro** (11/14): the smallest meta text.

### Named Rules

**The Scale-Only Rule.** Every text size comes from the theme scale. `subtick/tailwind-scale` rejects raw font sizes.

**The Display Face Is a Voice Rule.** The display face is for the wordmark, page titles and display moments only. Controls, data and body text are always sans.

**The Steady Numbers Rule.** Numbers that sit in columns or update live (scores, counts, durations) use tabular numerals.

## Layout

The app shell is a collapsible sidebar on desktop. Below `md` (48rem) it becomes a sticky 56px header with a translucent surface and a drawer. Page content sits in a centered container (`max-w-6xl`) with 16px gutters and 24px vertical padding on mobile, and 32px / 40px from `md` up. Focused pages narrow further (setup uses `max-w-xl`), and the clip viewer goes edge-to-edge on mobile and caps at `max-w-7xl` on large screens.

Spacing is a 4px grid from the theme. `gap-3` (12px) and `gap-2` (8px) are the workhorse rhythms, `gap-4` (16px) separates blocks, and cards pad at 16–20px. Components use container queries (`@container` on the main column), so cards adapt to the space they get, not to the viewport.

## Elevation & Depth

Mostly flat, with depth in both directions. At rest, surfaces lie flat and are separated by hairline borders and tonal steps. **Negative depth** (recessed) is shown with darker tonal fills: segmented tab tracks (surface-2 at 70%) hold a raised, bordered surface-3 indicator, and skeletons and secondary fills sit in the same well greys. **Positive depth** is the only place shadows appear, on surfaces that float above the page: menus, tooltips, popovers, dialogs, the clip viewer and up-next card.

### Shadow Vocabulary

- **Floating menu** (`shadow-xl` at 20% black): menus, tooltips, the up-next card.
- **Modal** (`shadow-2xl`): dialogs and the desktop clip viewer. The always-dark dev menu uses 40% black.
- **Skip link** (`shadow-lg`): the focused skip-to-content link.

### Named Rules

**The Shadows Float Rule.** A shadow means "this is above the page". Cards, rows and anything else in the page's flow never get one. Borders are always fine.

**The Two-Way Depth Rule.** A track or well recesses with a darker tonal fill, and whatever sits in it rises with a border and a lighter step. Never use a shadow to fake either.

## Shapes

Soft, rounded rectangles scaled to their size: badges and xs buttons 6px, sm icon buttons and tooltips 8px, md controls (buttons, inputs, segmented tabs) 10px (`rounded-control`), large buttons, menus and thumbnails 12px, cards and dialogs 16px. Pills (`rounded-full`) are for chips, avatars, step markers and spinners. Video thumbnails are 16:9 and clipped to their radius. Nested shapes inherit their parent's radius (`rounded-[inherit]`), so layers stay concentric.

## Components

### Buttons

Soft and tactile. Every button is one variant × one tone × one size (see `docs/internal/web.md#buttons`).

- **Shape:** 10px for sm and md (36px tall), 6px for xs (28px), 12px for lg (44px).
- **Primary:** ink fill with background-colored text, for the one main action of a surface. The `brand` tone fills CS2 orange and the `danger` tone fills deep red, both with white text.
- **Secondary (default):** a well-grey fill that deepens to pressed grey on hover. Soft tints for `brand` and `danger`.
- **Ghost / Quiet / Plain:** ghost is transparent and muted at rest, and goes to full color on hover or when selected. Quiet is a receding secondary. Plain is a ghost whose label is content (a player's name).
- **Press:** the background is its own layer and insets 1px a side on press (160 ms, quart ease-out). The label never moves.
- **Hover / Focus:** 150 ms color fades. The focus ring is 2px of action blue, offset 2px.
- **Touch press** (`pointer: coarse`): buttons, sidebar rows, filter triggers and sheet rows light up instantly on touch and fade back over 150 ms on release. Hover highlights stay mouse-only, so a tapped row never stays lit.
- **Selected / Loading:** a pressed toggle, an open menu or the current page lights up like hover. Loading keeps full color and swaps the label for a spinner without changing the width. Pending (`pending`, a page it leads to is loading) sweeps a faint light band across the button after 150 ms and stays clickable.

### Chips

- **Style:** 28px pills with a firm-hairline outline and muted small text. Hover fills well grey.
- **State:** pressed inverts to an ink fill with background-colored text and no border. A trailing remove icon tightens the right edge.

### Badges

- **Style:** 20px, 6px radius, uppercase caption with wide tracking, on a 12–16% tint of their tone (neutral, accent, brand, success, danger, ct, t). Overlay tones (solid black or white) sit on video. `tint-*` tones are dark with a hue and read on both themes.
- **Interactive:** a linked badge shows an offset outline in its own color on hover.

### Cards / Containers

- **Corner Style:** 16px.
- **Background:** surface (paper white or dark surface).
- **Shadow Strategy:** none (see The Shadows Float Rule). The exception is a card that floats, like up-next.
- **Border:** a hairline.
- **Internal Padding:** 16–20px.

### Inputs / Fields

- **Style:** 40px tall, 10px radius, a firm-hairline border on surface, lead-size text, placeholder at 70% muted.
- **Focus:** the border turns action blue with a 3px ring at 20%, fading over 150 ms.
- **Error:** the border goes red and stays red while focused, with a red ring at 30%. Field label and description use small text; the error text is small red.

### Tabs

- **Plain:** a row of muted tabs with a sliding surface-2 indicator.
- **Segmented:** a recessed track (surface-2 at 70%, 2px padding) whose bordered surface-3 indicator slides between tabs (200 ms, quart ease-out). Scrolls horizontally with no scrollbar.

### Navigation

- **Sidebar:** collapsible rows with a fading label, map icons, recent matches with muted tabular meta, and a queue button. On mobile it becomes a drawer with the iOS-style settle ease.
- **Mobile header:** sticky, 56px, surface at 85% with a medium backdrop blur and a bottom hairline. The chrome holds still during page transitions.
- **Menus and popovers** (`components/ui/menu.tsx`, `popover.tsx`, `sheet.tsx`): on desktop, a floating panel next to its trigger. Below 64rem, or on any touch-first device, the same content rises as a bottom sheet: surface, 24px top corners, no grab handle, a 40% black backdrop (also over the nav drawer), 8px padding, and 44px rows with 12px corners and 20px icons, so row text sits 20px in; panels like Filters pad 20px to match. It uses the drawer settle ease and closes on a downward swipe. The highlight filters (players, filters) follow the same rule.

### Highlight Card (signature)

A 16:9 rounded-12 thumbnail on a well-grey placeholder. A black duration pill and badges sit along its bottom edge, and a play glyph appears on keyboard focus and on touch devices. Below it are an avatar, a lead-size title and a small muted meta line with player links. This is the unit of the feed; the clip is the payoff.

## Do's and Don'ts

### Do:

- **Do** pick a kit component's `variant`, `tone`, `size` or state prop instead of restyling it. `className` on a kit component carries layout only, never color.
- **Do** take every text size, radius and spacing value from the theme (`text-body`, `rounded-control`, the 4px grid).
- **Do** keep hues meaningful: action blue for interaction, CS2 orange for game moments, CT blue and T gold for sides.
- **Do** use `brand-text` and `side-t-text` when the color is text on a light surface.
- **Do** give every interactive element the 2px action-blue focus ring.
- **Do** respect `prefers-reduced-motion`: drop press movement and view transitions, keep the color fades.

### Don't:

- **Don't** put shadows on cards, rows or anything else in the page's flow. Shadows are only for floating surfaces.
- **Don't** use CS2 orange for generic emphasis or calls to action that aren't about a game moment.
- **Don't** set controls, data or body text in the display face.
- **Don't** hand-pick hover hexes. Derive them with `color-mix` from the palette.
- **Don't** use raw font sizes or inline `style` for static values.
