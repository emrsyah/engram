# Design System: Engram — v2 "Cool Tool" Dark

**Status:** Target spec for the design refactor. The current implemented system lives in
[`DESIGN.md`](./DESIGN.md) (warm, candlelit). This document describes where we are
going — **do not treat it as the current state until the refactor lands.**

**Source:** Synthesized from four reference interfaces (Attio CRM, an IT-ops Assistant,
Attio dark table, a Langfuse-style observability dashboard).

**Locked direction:**
- **Neutrals:** cool near-black (true neutral gray-black, *not* warm brown).
- **Primary accent:** blue (Attio "Sync changes" blue).
- **Radius / density:** medium-balanced — soft-but-tight; shadows only on overlays.
- **Typography:** serif display for large headings, Inter for UI/body, monospace for numbers & IDs.

**Implementation note:** Every value below maps onto the existing Tailwind `@theme`
tokens in `apps/web/src/index.css`. Refactoring = swapping token *values* (and adding
a few new semantic/badge tokens), not rewriting components. Token names are given in
`code` next to each role.

---

## 1. Visual Theme & Atmosphere

**Atmosphere:** Quiet, precise, utilitarian. The interface feels like a professional
instrument — a cool, near-black canvas where information is the only ornament. Where v1
was a candlelit study, v2 is a clean control room: calm, low-glare, and unmistakably a
*tool*.

**Density philosophy:** Dense but unhurried. Rows and lists pack tightly, yet a touch
more vertical breathing room than a raw spreadsheet (rows ~44–48px). Hierarchy comes
from typographic weight and muted-gray secondary text, never from heavy chrome.

**Depth philosophy:** Flat. Separation is achieved almost entirely through 1px
hairline borders and one-step surface shifts — not shadows. Shadow appears *only* on
floating overlays (popovers, dialogs, dropdowns) and is soft and diffuse, never heavy.

**Aesthetic character:** Restraint. A single saturated accent (blue) carries primary
action; everything else is neutral gray. Color is rationed and meaningful — reserved
for status badges, semantic labels, and entity icons.

---

## 2. Color Palette & Roles

### Core surfaces — Cool near-black, darkest → lightest

| Token | Hex | Descriptive name | Role |
| --- | --- | --- | --- |
| `--color-void` | `#0a0a0b` | Carbon Black | Shell / outermost frame, top bar |
| `--color-base` | `#0e0e10` | Graphite Void | Main content background — the floor |
| `--color-sunken` | `#0c0c0e` | Pit Black | Nested wells, input rest background |
| `--color-panel` | `#161618` | Slate Panel | Popovers, dropdowns, dialogs |
| `--color-surface` | `#17181a` | Gunmetal | Card & row backgrounds |
| `--color-clay` | `#1a1a1d` | Iron | Elevated surfaces, capture bar |
| `--color-fill` | `#1f2023` | Ash Fill | Subtle fills: badges, tracks, tab hover |
| `--color-raise` | `#26272b` | Cool Pewter | Row/card hover, drag-over target |

### Lines / borders — Hairline → strong (cool gray)

| Token | Hex | Descriptive name | Role |
| --- | --- | --- | --- |
| `--color-line` | `#202125` | Whisper Rule | The universal hairline divider — table rows, card edges |
| `--color-line-soft` | `#26272c` | Faint Steel | Secondary separators |
| `--color-line-2` | `#2d2e33` | Cool Slate | Input borders, control outlines |
| `--color-line-strong` | `#3a3b41` | Brushed Steel | Hover/active borders, focus step-up |
| `--color-line-max` | `#4a4b52` | Bright Steel | Strongest borders, scrollbar thumb |

### Ink / text — Cool off-white → gray

| Token | Hex | Descriptive name | Role |
| --- | --- | --- | --- |
| `--color-ink-bright` | `#f4f5f6` | Pure Snow | Highest-emphasis headings, input text |
| `--color-ink` | `#e6e7e9` | Cool White | Primary body & titles — default text |
| `--color-ink-2` | `#c2c4c8` | Light Ash | Secondary content, row values |
| `--color-ink-3` | `#a4a6ab` | Silver Gray | Tertiary text, active nav labels |
| `--color-ink-muted` | `#8a8c90` | Muted Steel | Column headers, inactive nav, metadata |
| `--color-ink-dim` | `#6f7176` | Dim Gray | Hints, placeholder elevation, section labels |
| `--color-ink-faint` | `#595b60` | Faint Slate | Row numbers, timestamps, faint labels |
| `--color-ink-ghost` | `#45474c` | Ghost Gray | Disabled text, empty-state copy |
| `--color-done` | `#5a5c61` | Spent Gray | Completed/struck-through task text |

### Primary accent — Attio Blue

| Token | Hex | Descriptive name | Role |
| --- | --- | --- | --- |
| `--color-brand` | `#3b6ef5` | Signal Blue | **Primary CTA**, active tab/nav, checked state, focus pin. The "do something" color. |
| `--color-brand-bright` | `#5b86ff` | Bright Azure | Primary button hover, pressed-active |
| `--color-brand-glow` | `#6f95ff` | Sky Glow | Focus ring, link-source outline, drag-overlay ring |
| `--color-brand-soft` | `#aac1ff` | Pale Sky | Brand text on dark surfaces, active-item label |
| `--color-brand-ink` | `#ffffff` | Pure White | Text/icon on a solid brand button |
| `--color-brand-surface` | `#15203a` | Deep Harbor | Blue-tinted active surface — selected row, active nav pill |

### Semantic accents — rationed, for status & labels

Badges use a **tinted background + saturated foreground** pairing (see Badges below).
Foreground colors:

| Token | Hex | Descriptive name | Role |
| --- | --- | --- | --- |
| `--color-success` | `#4ec77f` | Spring Green | Accepted, healthy, published, positive |
| `--color-amber` | `#e0a23a` | Signal Amber | Pending, warning, attention |
| `--color-info` | `#5b9bd8` | Glacier Blue | Informational labels, "won", neutral status |
| `--color-coral` | `#e5675c` | Ember Coral | Error, danger, delete, abandoned |
| `--color-purple` | `#a884f0` | Orchid | Category/label accents, "planning", secondary tag |
| `--color-teal` | `#46bdac` | Verdigris | Tertiary accent, focus/break phases |

### Priority chips (cool re-tint)

| Priority | Background | Text | Semantic |
| --- | --- | --- | --- |
| P1 | `#3a1f1c` (`--color-p1`) | `#f0857a` (`--color-p1-ink`) | Critical — ember red |
| P2 | `#332a14` (`--color-p2`) | `#e0b24a` (`--color-p2-ink`) | Important — amber |
| P3 | `#15293a` (`--color-p3`) | `#62b0e0` (`--color-p3-ink`) | Eventually — glacier blue |

**Key decision — no pure black, no pure saturation overload.** Surfaces are true
*neutral* (no brown, faint cool cast), and only ~6 hues ever appear, each tied to a
fixed meaning.

---

## 3. Typography Rules

**Families:**
- **Display serif** — large page/greeting headings only (e.g. "What can I help with?").
  A refined serif (system: `ui-serif, Georgia`; ideal: a humanist serif like *Lora* /
  *Source Serif*). Provides editorial character against the neutral UI.
- **Sans (UI/body)** — `Inter` (system fallback `ui-sans-serif`). Everything else:
  nav, tables, labels, buttons, body.
- **Monospace** — `ui-monospace` for numbers, currency, phone numbers, IDs, counts,
  timestamps, token/cost/latency metrics, keyboard shortcuts.

**Weight usage:**
- Serif display headings → `font-normal` to `font-medium` (serifs carry weight on their own; avoid bold).
- Section/page sub-headings (sans) → `font-semibold`.
- Table column headers, nav labels → `font-medium`, often `text-ink-muted`.
- Body, row values → `font-normal`, `text-ink-2`.
- Uppercase group labels (sidebar `TICKETING`, `TRACK`) → `font-semibold`,
  `text-[11px]`, `tracking-[0.08em]`, `text-ink-dim`.

**Sizing pattern:**
- `text-4xl`–`text-3xl` — serif greeting/hero heading.
- `text-xl` — page title (sans semibold).
- `text-sm` (14px) — default UI body, table cells, nav items.
- `text-[13px]` — dense table cells, secondary rows.
- `text-xs` (12px) — column headers, button labels, hints.
- `text-[11px]` — uppercase section labels, count badges, status pills.

**Letter-spacing:** Tight-to-default for sans. Uppercase labels get `tracking-[0.08em]`.
Serif headings use default tracking (never letter-space a serif).

**Numeric data is always monospace** and right-aligned in tables where it represents
quantities (currency, headcount, tokens, cost, latency).

---

## 4. Component Stylings

### Buttons

**Primary CTA** (e.g. "Sync changes"):
- Solid `bg-brand`, `text-brand-ink` (white), `font-medium`.
- Radius `rounded-[8px]`, height `h-9` (36px), padding `px-3.5`.
- Hover `bg-brand-bright`; active `scale-[0.98]` + 120ms `--ease-out`.
- No border, no shadow.

**Secondary / ghost** (e.g. "Share", toolbar icons):
- Transparent or `bg-fill`, `text-ink-2`, 1px `border-line-2`.
- Hover `bg-raise` + `text-ink`, `border-line-strong`.
- Radius `rounded-[8px]`, height `h-9`.

**Outline button** (e.g. "Create new view"):
- `bg-surface`, 1px `border-line-2`, `text-ink-2`, centered, `font-medium`.
- Hover `border-line-strong` + `text-ink`.

**Small icon buttons** (sort, filter, settings, 24–28px):
- `size-7`–`size-8`, `rounded-[7px]`, `text-ink-muted`, transparent rest.
- Hover `bg-fill` + `text-ink-2`. Active `scale-[0.94]`.

**Send button (chat input)** — solid dark square `bg-raise`/`bg-brand`, `rounded-[8px]`,
`size-8`, arrow icon centered. Filled state uses `bg-brand`.

### Cards / Containers

**Standard card / panel:**
- `bg-surface`, 1px `border-line`, `rounded-[12px]`.
- No shadow at rest. Hover (if interactive) → `border-line-strong` + `bg-raise`.

**Floating overlay** (popover, dropdown, dialog):
- `bg-panel`, 1px `border-line-2`, `rounded-[12px]`.
- **Soft shadow allowed here only:** `0 8px 24px -6px rgba(0,0,0,0.5)`.

**Table container:**
- Sits directly on `bg-base`, framed by `border-line`.
- Header row: `bg-base`/`bg-surface`, `border-line` bottom, sticky.
- Rows: separated by `border-line` hairlines; hover `bg-surface`/`bg-fill`.
- Selected row: `bg-brand-surface` with a `border-brand`/left accent.
- Row number: `text-ink-faint`, mono, narrow leading column.

**Modal / dialog:** `bg-panel`, `rounded-[14px]`, `border-line-2`, soft shadow, generous
internal padding (`p-5`–`p-6`).

### Inputs / Forms

**Text input / search:**
- `bg-sunken`, 1px `border-line-2`, `rounded-[8px]`, height `h-9`.
- Text `text-ink`, placeholder `text-ink-dim`.
- Leading icon (search) `text-ink-muted`.
- Focus: `border-brand` + 1px `ring-brand-glow/40` (subtle), no glow bloom.

**Large chat/composer input:**
- `bg-surface`/`bg-sunken`, `border-line-2`, `rounded-[12px]`, multi-line, `p-3.5`.
- Attach icon bottom-left (`text-ink-muted`), send button bottom-right.
- Focus border `border-line-strong` (quiet) — composer doesn't shout.

**Checkbox:**
- `size-4`, `rounded-[5px]`, `border-line-strong` rest.
- Checked: `bg-brand` + `border-brand`, white check.

**Toggle / segmented control (tabs like Logs/Traces, columns/stacked):**
- Track `bg-fill`, `rounded-[8px]`, `p-0.5`.
- Inactive segment `text-ink-muted`; active segment `bg-raise` + `text-ink` (or
  `bg-brand-surface` + `text-brand-soft` for a colored active).

### Badges / Chips / Pills

**Status badge** (Pending / Accepted / Opportunity won):
- Full pill `rounded-full`, `px-2 py-0.5`, `text-[11px]`, `font-medium`.
- Tinted bg at ~14% of the semantic hue + saturated foreground:
  - Success → `bg-success/14 text-success`
  - Amber → `bg-amber/14 text-amber`
  - Info → `bg-info/14 text-info`
  - Coral → `bg-coral/14 text-coral`
  - Purple → `bg-purple/14 text-purple`

**Outline label pill** (Langfuse labels: frustrated / mobile app):
- `rounded-full`, 1px border in the semantic hue at low opacity, colored text, optional
  leading dot. `border-success/30 text-success`, etc.

**Count badge** (Inbox 7, Tasks 3):
- `rounded-full`/`rounded-[6px]`, `bg-fill`, `text-ink-muted`, mono, `text-[11px]`,
  `px-1.5`. Active context → `bg-brand-surface text-brand-soft`.

**Beta / meta tag:** small pill, `bg-amber/14 text-amber`, `rounded-full`, `text-[11px]`.

**Status dot:** `size-2 rounded-full` in semantic hue (live = success, error = coral).

### Sidebar / Navigation

- Background `bg-void` (one step darker than content `bg-base`).
- Nav item: `h-9`, `rounded-[8px]`, `px-3`, icon + label, `gap-2.5`.
  - Rest: `text-ink-muted`, colorful entity icon at full saturation.
  - Hover: `bg-fill` + `text-ink-2`.
  - Active: `bg-brand-surface` (or `bg-fill`) + `text-ink` + brand-tinted icon.
- Group/section header: uppercase, `text-[11px]`, `tracking-[0.08em]`,
  `text-ink-dim`, `font-semibold`, with a collapse chevron (`text-ink-faint`).
- Count badge right-aligned per item.

---

## 5. Layout Principles

**Surface stepping (how depth reads without shadow):**
```
void  (#0a0a0b)  ← sidebar / top bar
 └ base  (#0e0e10)  ← main content floor
    └ surface (#17181a)  ← cards / table rows
       └ fill (#1f2023)  ← badges / hover / inset fills
```
Each layer is ~one notch lighter; 1px `border-line` rules do the rest.

**Radius scale:** `5px` (checkbox) · `6–7px` (small icon buttons) · `8px` (buttons,
inputs, nav items, segmented controls) · `12px` (cards, panels, composer) · `14px`
(modals) · `full` (status pills, count badges, dots).

**Spacing scale (4px base):**
- Control inner padding: `px-3`–`px-3.5`, height `h-9`.
- Table row height: `44–48px`; cell padding `px-3 py-2.5`.
- Card padding: `p-4`–`p-5`.
- Section gaps: `gap-4`–`gap-6`.
- Chip/badge gaps: `gap-1.5`.
- Sidebar: items `gap-0.5`, section blocks separated by `mt-5`.
- Page padding: `px-5`–`px-8`, top bar height `h-14`.

**Whitespace strategy:** Tight horizontally (dense tables/lists), comfortable
vertically. Headers and toolbars get a clear `h-14`/`h-12` band separated by a
`border-line` rule. Empty states are centered, generous, and quiet (`text-ink-ghost`).

**Grid alignment:** Tables are the primary structure — fixed leading columns (checkbox,
row number, primary key), then flexible data columns with mono right-aligned numerics.
Column headers always carry a small leading icon in `text-ink-muted`.

---

## 6. Depth, Shadow & Motion

**Shadow:** Effectively none on in-page surfaces. Overlays only:
`0 8px 24px -6px rgba(0,0,0,0.5)` plus a `border-line-2` outline. Selection/active states
use a 1px brand border or `bg-brand-surface`, never a glow bloom.

**Easing & motion** (carried over from v1): `--ease-out: cubic-bezier(0.23,1,0.32,1)`.
- Hover color transitions 150ms.
- Button press `active:scale-[0.98]` / `0.94` (icon buttons), 120ms.
- Overlay entry 180–200ms with `--ease-out`.
- Keep all UI motion < 300ms; never animate high-frequency keyboard navigation.
- Honor `prefers-reduced-motion` (disable scale/translate, keep end state).

---

## 7. Migration Map (v1 warm → v2 cool)

The refactor is a token-value swap in `apps/web/src/index.css` `@theme`. Same token
names, new values (plus new badge tokens `--color-success / --color-info / --color-purple`).

| Token | v1 (warm) | v2 (cool) |
| --- | --- | --- |
| `--color-base` | `#131110` | `#0e0e10` |
| `--color-surface` | `#1f1b17` | `#17181a` |
| `--color-line` | `#2c2823` | `#202125` |
| `--color-ink` | `#f3eee5` | `#e6e7e9` |
| `--color-ink-muted` | `#9a9085` | `#8a8c90` |
| `--color-brand` | `#9784f2` (amethyst) | `#3b6ef5` (blue) |
| `--color-brand-ink` | `#15111d` | `#ffffff` |
| `--color-brand-surface` | `#27203a` | `#15203a` |

Because all engram components already reference tokens (`bg-surface`, `text-ink`,
`border-line`, `bg-brand`), no component markup changes are required for the color shift.
The *structural* upgrades (serif headings, 12px card radius, roomier rows, badge
tint-pairs, sidebar active pill) are the only per-component work.
