# Design System: Engram

## 1. Visual Theme & Atmosphere

**Atmosphere:** Warm, intimate darkness. Engram feels like a candlelit study — dense but never oppressive. The interface breathes through carefully calibrated warm grays and amber undertones that prevent the dark palette from feeling cold or clinical. Every surface is wrapped in warm brown-blacks, and every interaction produces a subtle, intentional response.

**Density philosophy:** Information-dense but visually clear. Cards and lists pack content tightly (small gaps, compact padding) but maintain readability through strict typographic hierarchy and accent color signposting. The canvas view is the exception — generous negative space between nodes creates spatial breathing room.

**Aesthetic character:** Utilitarian elegance. No ornamentation for its own sake. Visual polish comes from precision: exact border radii, consistent spacing increments, and transitions that feel inevitable rather than decorative.

## 2. Color Palette & Roles

### Core surfaces

| Name | Hex | Role |
| --- | --- | --- |
| Obsidian Void | `#0b0b0a` | Shell/sidebar deepest background. Used only at the outermost frame. |
| Charcoal Earth | `#151310` | Main content area background. The "floor" all views sit on. |
| Warm Espresso | `#1a1714` | Panel and popover backgrounds. Slightly lifted from the floor. |
| Dried Clay | `#1c1916` | Capture bar, elevated card surfaces. One step warmer than panels. |
| Cocoa Bark | `#211e1a` | Card/row backgrounds, sidebar nav hover, default card fill. |
| Burnt Umber | `#252220` | Subtle fills: progress track, tab hover, badge backgrounds, section dividers. |
| Tempered Bronze | `#272421` | Card hover state, drag-over target fill. |
| Aged Copper | `#2e2b26` | Borders — the universal separator. Used on every card, panel, and section boundary. |
| Worn Iron | `#302c27` | Secondary borders, calendar outline, secondary card borders. |
| Tarnished Steel | `#34302b` | Default card border color (`.engram-card`). The most common border value. |
| Weathered Tin | `#3a3530` | Active/hover borders, focus ring step-up, pressed button borders. |
| Pewter | `#4c463e` | Strong borders: drag-over inset, focused card borders, detail panel input focus. |
| Smoke | `#474038` | Small action button borders (3-dot menu, link button on cards). |

### Accent colors

| Name | Hex | Role |
| --- | --- | --- |
| Amethyst Signal | `#907ce8` | **Primary accent.** Focus pin indicator, Pomodoro work phase, primary CTA buttons, active tab highlight, search accent dot, checkbox checked state. The "do something" color. |
| Pale Lavender | `#a08ef2` | Primary button hover state (Amethyst Signal shifted lighter). |
| Soft Lilac | `#c4b5fd` | Active sidebar item text (Today's Focus). |
| Deep Violet | `#231d3d` | Active timer button background; violet-tinted surfaces for active states. |
| Violet Glow | `#9b88ff` | Link-source outline, drag overlay ring, search result accent. |
| Golden Amber | `#d7b238` | Canvas selection outline, checklist progress fill, calendar scheduled dot, "Due" chip background, timeline "Today" number. |
| Honey Gold | `#d6a93a` | Due date chip text, due button active state. |
| Verdigris Teal | `#43b6a6` | Pomodoro break phase, teal-tinted accents. |
| Coral Ember | `#e46f50` | Unpin/remove-from-focus hover, delete button text. |
| Cerulean Mist | `#4aa5c8` | P3 priority chip background, blue accent. |
| Jade Spring | `#53b9a8` | Link URLs (clickable text), domain display in link cards. |
| Lime Burst | `#a8e06b` | Task-complete celebration particle. |

### Text hierarchy

| Name | Hex | Role |
| --- | --- | --- |
| Warm White | `#efe9df` | Page and card titles, primary body text. The default text color. |
| Parchment | `#f0ebe3` | Input text, item titles in detail panel, headings that need slightly more warmth. |
| Linen | `#e0d8cf` | Task row titles, secondary card text. |
| Sandstone | `#d8d2ca` | Note/thought body text, textarea content, secondary content. |
| Dawn Mist | `#c8bfb2` | Hover text on muted elements, input placeholder elevation, secondary button text. |
| Fawn | `#b0a99f` | Scratchpad body, unpinned task text, chip text. |
| Silver Sage | `#a09889` | Thought notes label, secondary metadata. |
| Warm Gray | `#948c82` | Tab text (inactive), toggle group text. |
| Stone | `#938a80` | Small action button text (card overlay buttons). |
| Driftwood | `#8d857b` | Subtitle text, footer hint text, inactive nav pill text, capture bar collapsed text. |
| Ash | `#8a8378` | Count badges, timestamp text. |
| Dust | `#82786e` | Timeline date labels, calendar month text, section metadata. |
| Muted Earth | `#7f776d` | Quick capture mode tab text (inactive), footer hints. |
| Fossil | `#706a62` | Top-bar icon button text, panel close buttons. |
| Shadow Bark | `#6b6560` | Section labels ("Due today"), done task text, timer phase label. |
| Twilight | `#5c554d` | Detail panel section labels, placeholder text in inputs, empty states. |
| Charcoal Moss | `#5a5450` | "Keep open" checkbox label, tertiary metadata. |
| Deep Moss | `#4a4540` | Input placeholder text, timer toggle inactive text. |
| Abyss | `#3d3830` | Disabled text, disabled button text. |
| Obscure | `#3e3a35` | Grip handle icon, pin-off icon default color. |
| Buried | `#342f2a` | Search bar border, top bar input border. |

### Done/completed state

| Name | Hex | Role |
| --- | --- | --- |
| Faded Bark | `#756e65` | Done task title (with line-through). |
| Worn Thread | `#655e56` | Done checklist item text, done timeline task title. |
| Dim Thread | `#5a5450` | Done checklist item text (scratchpad panel). |
| Deep Thread | `#4e4840` | Done checklist input text (detail panel). |

### Priority chips

| Priority | Background | Text | Semantic name |
| --- | --- | --- | --- |
| P1 | `#5a2a20` | `#f07d5e` | Critical — smoldering red |
| P2 | `#514017` | `#e5b83d` | Important — molten gold |
| P3 | `#183d4b` | `#58b8d8` | Eventually — deep ocean |

## 3. Typography Rules

**Font family:** System font stack (via `@alphonse/ui`). No custom web fonts. Monospace for metadata, counts, timestamps, and keyboard shortcuts.

**Weight usage:**
- `font-bold` — Page headings (`text-3xl`), section labels (`text-xs uppercase tracking-widest`), panel headers, chip content
- `font-semibold` — Task titles, card titles, nav items, capture bar mode labels, priority button labels, CTA buttons
- `font-medium` — Sidebar space names, toggle labels, secondary buttons
- `font-normal` — Body text, task descriptions, list items

**Sizing pattern:**
- `text-3xl` — Page heading ("Focus", "Timeline", "Priorities")
- `text-lg` — Detail panel item title
- `text-base` — Priority card task title (Focus view)
- `text-[15px]` — Capture bar input, thought card title
- `text-sm` — Default body text, task rows, descriptions
- `text-xs` — Button labels, hint text, toggle items
- `text-[11px]` — Section labels, metadata, uppercase tracking labels
- `text-[10px]` — Mono labels, count badges, keyboard hints
- `text-[9px]` — "Main" tag on capture task

**Letter-spacing:**
- `tracking-widest` (`0.1em`) — Panel headers, section labels
- `tracking-[0.14em]` — Sidebar "Spaces" / "Recent" labels, Focus "Top 3 Priorities"
- `tracking-[0.12em]` — Type label on cards, shortcuts dialog section headers
- `tracking-wide` — Timer phase labels
- Default — Everything else (no extra tracking)

**Monospace usage:** `font-mono` strictly for: count badges, due date chips, timestamps, keyboard shortcut keys, progress percentages, "P1/P2/P3" labels, file size display.

## 4. Component Stylings

### Buttons

**Primary CTA (Capture button):**
- Background: Amethyst Signal `#907ce8`, text: `#17131f` (near-black on violet)
- Hover: Pale Lavender `#a08ef2`
- Active: `scale(0.97)` with 100ms transition
- Pill shape, bold text, includes hotkey hint

**Small action buttons (card overlays, 3-dot menu):**
- Size: 24×24px (`size-6`), rounded `[5px]`
- Border: Smoke `#474038`, background: `#15130f`
- Hover: `bg-[#1e1b16] text-[#c8bfb2]`
- Active: `scale(0.92)` with 100ms transition
- Opacity: 0 by default, `group-hover:opacity-100` for reveal

**Ghost buttons (sidebar, top-bar icons):**
- No border, no background
- Text: Fossil `#706a62`, hover: `text-[#c8bfb2]`
- Active variant (sidebar): `bg-[#22201f] text-white`
- Focus variant (top-bar): `bg-[#251f38] text-[#907ce8]`

**Outline buttons (detail panel):**
- Border: `#302c27`, background: `#1c1916`
- Text: `#c8bfb2`, hover: `bg-[#272421]`
- Delete variant: `border-[#3d2020] bg-[#1a1212] text-[#e06b6b]`

**Inline pill buttons (priority, due):**
- Height: 24px (`h-6`), rounded `[5px]`
- Inactive: `border-[#2f2a25] bg-[#181511] text-[#6b6258]`
- Active: `border-[#4c463e] bg-[#2a2621] text-[#f0ebe3]`
- Due active: `border-[#3a3327] bg-[#3a3327] text-[#d6a93a]`

### Cards / Containers

**Canvas cards (`.engram-card`):**
- Border: `#34302b` (1px), rounded: `8px`
- Background: `#211e1a`
- Shadow: `0 16px 40px rgb(0 0 0 / 24%)`
- Hover: `border-color: #4c463e` (150ms ease-out transition)
- Transition: `border-color 150ms, box-shadow 150ms, opacity 150ms` using `--ease-out`

**Focus priority cards:**
- Border: `#907ce8/20` (1px), rounded: `10px`
- Background: `#1e1b25` (violet-tinted)
- Hover: `border-[#907ce8]/40`
- Padding: `p-4`

**Panel containers (popovers, detail panel):**
- Border: `#2e2b26`, rounded: `12px`
- Background: `#1a1714`
- Shadow: `shadow-2xl`

**Section cards (detail panel, timeline):**
- Border: `#252118`, rounded: `7px`
- Background: `#100e0c` (darker than parent for nesting)

**View page cards (Priorities columns, right column cards):**
- Border: `#302c27`, rounded: `8px`
- Background: `#211e1a`
- Drag-over: `border-[#4c463e] bg-[#272421] shadow-[inset_0_0_0_1px_#4c463e]`

### Inputs / Forms

**Text inputs:**
- Border: transparent (rest), `#302c27` (focus)
- Background: transparent (rest), `#100e0c` (focus)
- Focus padding shift: `px-0 py-0` → `px-2 py-1` on focus
- Text: Parchment `#f0ebe3`, placeholder: Abyss `#3d3830`

**Capture bar input:**
- No border, no background, transparent
- Text: white `text-white`, placeholder: `#6b6460`
- Height: `h-10`, font-size: `text-[15px]`

**Textarea:**
- Border: `#2a2621` (rest), `#3a3530` (focus)
- Background: `#181511`
- Text: `#d8d2ca`, monospace, leading-6

**Checkbox:**
- Size: default / `size-3.5` (compact) / `size-4` (focus cards)
- Border: `#4a4540` (default), `#5a546d` (focus cards)
- Rounded: `rounded-[4px]` (default), `rounded-full` (task cards, timeline)
- Checked: `border-[#907ce8] bg-[#907ce8]` with white check icon

### Badges / Chips

**Priority chip:**
- Height: `h-6`, rounded: `rounded-[5px]`, padding: `px-2`
- Font: bold, 10px, with leading dot indicator (`size-1.5 rounded-full bg-current`)
- P1: `bg-[#5a2a20] text-[#f07d5e]`
- P2: `bg-[#514017] text-[#e5b83d]`
- P3: `bg-[#183d4b] text-[#58b8d8]`

**Due chip:**
- Height: `h-6`, rounded: `rounded-[5px]`, padding: `px-2`
- Background: `bg-[#3a3327]`, text: `#d6a93a`, mono font

**Count badge:**
- Rounded-full, `bg-[#252220]`, text: `#8a8378`, mono, `text-[10px]`

### Progress bars

- Height: `h-1` (focus panel), `h-1.5` (detail panel)
- Track: `bg-[#252220]`, rounded-full, overflow-hidden
- Fill: `bg-[#907ce8]` (focus), `bg-[#d7b238]` (checklist)
- Transition: `width 200ms-500ms` ease

### Drag overlay

- Border: `#907ce8/30` / `#9b88ff/40`
- Background: `#1c1916` / `#211e1a`
- Shadow: `shadow-xl` / `shadow-2xl`
- Ring: `ring-1 ring-[#9b88ff]/20`
- Transform: `rotate-1 scale-[1.02]` (subtle tilt for lift effect)

## 5. Layout Principles

### Shell structure

```
┌──────────┬────────────────────────────────────────┐
│          │  Top Bar (h-14, fixed)                  │
│          ├────────────────────────────────────────┤
│ Sidebar  │                                        │
│ w-[252]  │  Main content area (flex-1, overflow)   │
│          │                                        │
│          ├────────────────────────────────────────┤
│          │  Quick Capture Bar (fixed, bottom-6)    │
└──────────┴────────────────────────────────────────┘
```

- Sidebar collapses to `w-0` with 200ms width transition
- Main area uses `min-h-0 flex-1 overflow-hidden` to prevent flex blowout
- Full viewport: `100svh × 100vw`, `overflow: hidden` on body

### Grid and spacing

**Canvas grid:** Radial dot grid at 28px intervals, `rgb(255 255 255 / 7%)` dot color.

**Standard gaps:**
- Between sections: `gap-5` / `gap-6`
- Between items in a list: `space-y-0.5` / `space-y-1`
- Between cards in grid: `gap-5`
- Between chips/badges: `gap-1` / `gap-1.5`
- Between action buttons: `gap-1` / `gap-2`
- Page horizontal padding: `px-8` → `md:px-16` → `lg:px-28`
- Page vertical padding: `py-10`
- Card internal padding: `p-4` / `p-5`

**Sidebar spacing:**
- Nav items: `h-[36px]`, `px-3 py-2`, `gap-3`
- Section headers: `px-3`, `text-[11px] uppercase tracking-[0.14em]`
- Bottom bar: `px-5 py-5`

### View layouts

**Focus page:** 70/30 split on desktop (`lg:w-[70%]` / `lg:w-[30%]`), stacked on mobile.

**Priorities page:** 3-column grid (`lg:grid-cols-3`).

**Timeline page:** 2-column grid for calendar view (`lg:grid-cols-[360px_1fr]`), otherwise stacked list with `grid-cols-[92px_1fr]` timeline layout.

**Max content width:** `max-w-[1160px]`, centered with `mx-auto`.

## 6. Animation & Interaction Language

> Guided by Emil Kowalski's design engineering philosophy: unseen details compound into something that feels right.

### Custom easing curves

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);      /* Strong ease-out for UI interactions */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);   /* Strong ease-in-out for on-screen movement */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);    /* iOS-like drawer curve */
```

These curves are stronger than CSS defaults. They give interactions a sense of intentionality — elements snap into place rather than coasting.

### Duration rules

| Element | Duration | Easing |
| --- | --- | --- |
| Button press / active feedback | 100-160ms | `--ease-out` |
| Hover color changes | 150ms | `--ease-out` |
| Card border/shadow transitions | 150ms | `--ease-out` |
| Quick capture bar entry | 220ms | `--ease-drawer` |
| Detail panel slide-in | 200ms | `ease-out` |
| Quick capture extras (mode switch, subtask add) | 200ms | `--ease-out` |
| Progress bar fill | 200-500ms | Default / linear |
| Sidebar width transition | 200ms | Default |
| Stagger fade-up items | 220ms | `--ease-out` |

**Rule: UI animations stay under 300ms.** Perceived performance matters more than actual speed.

### Active / press feedback

Every interactive element must respond to press:

```css
active:scale(0.97)   /* Primary buttons */
active:scale(0.96)   /* Small buttons, CTA */
active:scale(0.95)   /* Calendar date buttons */
active:scale(0.94)   /* Tiny action buttons, priority pills */
active:scale(0.92)   /* Icon-only buttons (24px) */
active:scale(0.99)   /* Large list items (timeline tasks) */
```

Always paired with `transition: transform 160ms --ease-out` and `transform-gpu` for hardware acceleration. Protected with `motion-reduce:active:scale-100` and `motion-reduce:transition-none`.

### Stagger animations

List and grid items use `.stagger-item` class with staggered `animation-delay`:

```css
.stagger-item {
  opacity: 0;
  animation: fadeUp 220ms var(--ease-out) forwards;
}
```

- Page title: 0ms delay
- Page subtitle: 40ms delay
- First column/item: 80ms delay
- Subsequent items: +35-60ms per item

**Reduced motion:** `animation: none; opacity: 1` — removes motion but preserves the end state.

### Celebration burst (task completion)

16 particles radiate from the checkbox center in a circle. Each particle is a 2px rounded dot, colored from the accent palette (`#907ce8`, `#d9a82f`, `#43b6a6`, `#e46f50`, `#4aa5c8`), cycling. Animation: `0.65s ease-out forwards`, translating along a radial axis with scale fading to 0.

### Quick capture bar

Entry uses `@starting-style` with `translateY(8px) scale(0.97) → translateY(0) scale(1)` over 220ms with `--ease-drawer`. Transform origin: `bottom center` so it scales up from the capture button position.

Highlight pulse: Box shadow transitions from `shadow-lg` to `0 0 0 2px rgba(155,136,255,0.45), 0 0 36px 6px rgba(155,136,255,0.18)` over 500ms, creating a soft violet glow.

Extra elements (subtask rows, parsed tokens, link previews) use `qcb-extra` class with `@starting-style translateY(4px) → 0` at 200ms.

### Drag interactions

- Activation constraint: `distance: 6px` (prevents accidental drags on click)
- Dragging item: `opacity: 0.3-0.4`
- Drop target: `transition-[background-color,border-color,box-shadow] duration-150` with inset ring shadow
- Drag overlay: `rotate-1 scale-[1.02]` with `dropAnimation: null` (instant placement, no settling animation)
- Cursor: `cursor-grab` → `active:cursor-grabbing`

### Hover reveal pattern

Card action buttons use `opacity-0 group-hover:opacity-100` with `transition-opacity duration-150`. Selected state forces `opacity-100`. This applies to:
- Grip handles on sortable rows
- Pin/unpin buttons
- 3-dot context menus
- Link/action buttons on canvas cards

Gated behind `@media (hover: hover) and (pointer: fine)` for the `.engram-card:hover` rule to prevent false hover on touch devices.

### Keyboard interaction rules

Per Emil's animation decision framework:

| Frequency | Decision |
| --- | --- |
| 100+/day (view navigation with `1-4`, sidebar toggle `[`) | **No animation.** Instant route change. |
| Tens/day (hover states, list navigation) | **Remove or drastically reduce.** 150ms color transitions only. |
| Occasional (detail panel, capture bar, search dialog) | **Standard animation.** 200-220ms with custom easing. |
| Rare/first-time (celebration burst, onboarding) | **Can add delight.** 650ms particle burst. |

**Never animate keyboard-initiated actions** (view switching, search open). These are repeated hundreds of times daily; animation makes them feel delayed.

### Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  .stagger-item { animation: none; opacity: 1; }
  .qcb-card, .qcb-extra { transition: opacity 120ms linear; transform: none !important; }
}
```

All `active:scale()` changes include `motion-reduce:active:scale-100 motion-reduce:transition-none` protection.

## 7. Iconography

**Icon library:** Lucide React. Consistent 1.5px stroke weight.

**Standard sizes:**
- `size-4` (16px) — Default. Nav items, top-bar buttons, card actions, search bar icon
- `size-3.5` (14px) — Compact contexts: sortable row grips, panel close buttons, timer controls, shortcut dialog
- `size-3` (12px) — Tiny contexts: checkbox check marks, badge dot indicators, file type icons

**Icon + label pattern:** `gap-1.5` to `gap-2` between icon and text, always icon-first.

**Custom SVG icons:**
- Grip dots (6-dot, 2-column pattern) — used in `size-3.5` for row handles and `size-4` for drag overlays
- Accent dot (`size-2 rounded-[2px]`) — color-coded type indicator on cards

## 8. Scrollbar Styling

Custom thin scrollbar via `.engram-scrollbar`:

```css
scrollbar-color: #4a433b transparent;
scrollbar-width: thin;
/* WebKit */
width: 8px; thumb: border-radius 999px, background #4a433b;
```

Applied to overflow containers. The transparent track keeps scroll unobtrusive against dark backgrounds.

## 9. Z-Index Layers

| Range | Purpose |
| --- | --- |
| 10 | Canvas card selection outline, focus pin indicator |
| 20 | Card overlay actions (3-dot menu, link button) |
| 40 | Detail panel backdrop (click-away dismiss) |
| 50 | Detail panel, focus popover panels, note editor |
| 100 | Command dialog / search |
| 300 | Celebration burst particles (pointer-events-none) |
| 999 | Quick capture bar |

## 10. Key Design Decisions

1. **No pure blacks.** Every surface is warm-tinted. Even `#0b0b0a` (the deepest background) carries a faint warmth. Pure `#000000` is never used for backgrounds or borders.

2. **Consistent border strategy.** Nearly every container uses a 1px solid border in the `#25-#35` warm-gray range. The border color progresses lighter with interaction: rest → hover → focus/active. No container relies on shadow alone for definition.

3. **Accent color as identity.** Amethyst Signal `#907ce8` is the thread that ties the app together — it marks focus, primary actions, active states, and celebration. The other accents (amber, teal, coral, blue) are subordinate, used only for semantic meaning (priority, due dates, phases).

4. **Opacity as state.** Done items drop to `opacity-55`. Dragging items fade to `opacity-30-40`. Hover-revealed actions use `opacity-0 → opacity-100` transitions. This creates a consistent grammar of visibility = importance.

5. **Micro-feedback everywhere.** Every clickable element has an `active:scale()` state. Every transition uses a custom easing curve. Every panel entry has a `@starting-style` animation. The sum of these invisible details is what makes the interface feel alive without being animated.
