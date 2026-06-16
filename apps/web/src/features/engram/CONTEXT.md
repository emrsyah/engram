# Engram — Domain Context

Vocabulary for the Engram feature. `engram-core.ts` owns the data model; the
views are read-only lenses over the same records. See
`docs/plans/2026-06-06-engram-design.md` for the full product/architecture design.

> ⚠️ **Stale sections below.** The canvas (React Flow, `CanvasViewState`,
> `canvas-view.tsx`, `item-node.tsx`, `floating-edge.tsx`) was dropped in the
> clusters/tasks redesign and no longer exists in the code. Those bullets are
> kept only until this doc is refreshed; trust the code over them.

## Records

- **Space** — a named canvas. All items and links belong to one space.
- **Item** — a card on the canvas in _world_ coordinates. Types: `thought`,
  `task`, `image`, `link`, `file`. Tasks are items, not a separate table.
- **ItemLink** — a connector between two items in the same space. Stored
  separately so connectors can be deleted and synced independently.
- **CanvasViewState** — per-space pan / zoom / grid for the canvas window.

## Modules (the seams)

- **Domain core** (`engram-core.ts`) — pure `EngramData -> EngramData`
  mutations. Owns every invariant: no self/cross-space/duplicate links, task
  accent derivation, item sizing, capture positioning, jump-to centering. No
  React, no storage. Every write goes through here — including undo restoration
  (`restoreItems`, which re-validates links so undo can't resurrect an invalid
  one), selection/navigation (`setActiveSpace`, `selectItem`), and the daily
  briefing/note writes (`saveDailyBriefing`, `upsertDailyNote`). The store is a
  thin shell that calls these; it never builds `EngramData` inline. Tested in
  `engram-core.test.ts` via `bun test`.
- **Projections** (`projections.ts`) — pure read-only lenses over `EngramData`:
  active-space slices, recent items, task-by-priority and timeline-by-day
  groupings, search. Timeline and Priorities are projections, never stored.
- **Focus** (`focus.ts`) — the cohesive home for the daily-focus sub-domain:
  pinning tasks to a day, the Top-3 / backlog tiers, reordering, and sweeping
  completed tasks. Pure derivations (`focusBuckets`, `sortFocusItems`,
  `staleFocusDoneIds`) and pure mutations (`pinToFocus`, `setFocusTier`,
  `reorderFocusPlan`, `purgeStaleFocusDone`) that **compose** the `engram-core`
  primitives, so invariants stay in the core. `today` is always passed in (never
  read from the clock) so the module is pure and tested in `focus.test.ts`. The
  store owns the *timing* of housekeeping (sweep on hydrate, schedule end-of-day
  purge); the views read `focusBuckets` and never derive focus state themselves.
- **Focus utility hooks** (`components/use-pomodoro.ts`, `components/use-daily-note.tsx`)
  — the shared logic behind the focus dock and top-bar popovers. `usePomodoro`
  owns the timer engine (countdown, work/break transitions, sessions);
  `useDailyNote` owns today's-note lookup, debounced autosave, and markdown key
  handling (plus a shared `SaveStateIndicator`). The `*-panel` (top-bar popover)
  and `*-inline` (focus dock) components are thin presentational shells over these
  hooks, so the timing/autosave logic can't drift between the two placements.
- **Capture grammar** (`capture-grammar.ts`) — the single source of truth for
  the quick-capture syntax (`!priority`, `#tag`, `@mention`, due-date phrases,
  `someday`). Two pure entry points share one set of token rules:
  `parseCapture(text)` → an Item payload (used on commit by `QuickCaptureBar`),
  and `highlightSegments(text)` → display segments (used per-keystroke by
  `CaptureInput`). Adding or fixing a rule here updates parsing and highlighting
  together so they cannot drift. Tested in `capture-grammar.test.ts` via
  `bun test`. Three legacy parse/highlight disagreements are preserved and
  marked `RECONCILE` in the source, pending a follow-up.
- **Canvas surface** (`components/canvas-view.tsx`) — the spatial canvas is
  rendered by **React Flow** (`@xyflow/react`), run _controlled_ by the store:
  Items map to nodes, ItemLinks to edges, CanvasViewState to the viewport.
  React Flow owns pan / zoom / node dragging; its callbacks route back into the
  domain core (`onNodesChange` → `moveItem`, `onViewportChange` → `setViewState`,
  `onEdgeClick` → `deleteLink`). Linking still uses the click-the-link-button
  flow wired through `onNodeClick` → `connectItems`.
  - **Item node** (`components/item-node.tsx`) — React Flow node wrapper; renders
    card chrome around a shared body.
  - **Item card bodies** (`components/item-card-bodies.tsx`) — the per-type HTML
    card bodies (thought/task/link/image/file), free of canvas concerns.
  - **Floating edge** (`components/floating-edge.tsx`) — center-to-center
    connector matching the original curve.
- **Canvas viewport** (`canvas-viewport.ts`) — coordinate helpers still used by
  the domain core for capture placement (`CAPTURE_ANCHOR`) and jump-to-center
  (`VIEWPORT_CENTER`). Note: those two anchors differ — preserved from the
  original prototype, worth revisiting.
- **Persistence adapter** (`persistence.ts`) — the `EngramPersistence` seam
  (`load` / `save`). The localStorage adapter satisfies it today; a PowerSync
  adapter can satisfy it later without touching the canvas. Validation and
  corrupt-payload backup live here.
- **Store** (`store.tsx`) — the thin React shell. Holds UI-only state (capture
  / search modals, link-source selection, keyboard shortcuts), wires the domain
  core to `setData`, and debounces saves through the persistence adapter.
