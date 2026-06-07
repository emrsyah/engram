# Engram — Domain Context

Vocabulary for the Engram feature. The canvas owns the data model; the other
views are read-only lenses over the same records. See
`docs/plans/2026-06-06-engram-design.md` for the full product/architecture design.

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
  React, no storage.
- **Projections** (`projections.ts`) — pure read-only lenses over `EngramData`:
  active-space slices, recent items, task-by-priority and timeline-by-day
  groupings, search. Timeline and Priorities are projections, never stored.
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
