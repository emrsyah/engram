# Engram Redesign — Canvas → Clusters

Replace the freeform canvas with a **Clusters board**, add an all-**Tasks** view, convert item links to **inline backlinks**. Spaces stay; Canvas and Priorities views are retired.

## Target model
- **Nav:** Focus · Inbox · Tasks · Timeline
- **Space** = Clusters board (named, reorderable, collapsible groups of mixed cards; group-by Clusters/Type/Tag/Recent)
- **Tasks** = projection over all tasks; group-by Space / Priority / Due
- **Links** = inline backlinks (keep `ItemLink`, stop drawing edges), same-space only
- **Data:** add `Cluster`, `Item.clusterId?`, `Item.sortOrder`; retire `Item.x/y/width/height` + `CanvasViewState`

## Stages (execute in order)

- [x] **Stage 1 — Data model + projections** ✅
  - Add `Cluster` type; add `clusterId?` / `sortOrder` to `Item`
  - Core ops: add/rename/delete/reorder cluster, move item to cluster, reorder within cluster
  - Projections: items-by-cluster, all-tasks grouped (space/priority/due), backlinks-for-item
  - Keep canvas working (non-destructive)

- [x] **Stage 2 — Tasks view** ✅
  - New `/tasks` route + `tasks-view.tsx`
  - Group-by toggle (Space / Priority / Due), inline complete, quick-add per group
  - Add to nav; click navigates to item's space

- [x] **Stage 3 — Clusters board (replaces canvas)** ✅
  - New `clusters-view.tsx`; `/canvas` route renders it (or rename to `/space`)
  - Cluster groups, mixed cards (reuse `item-card-bodies`), DnD reorder + move between clusters
  - Group-by switcher; "Unsorted" fallback

- [x] **Stage 4 — Inline backlinks** ✅
  - `🔗 Linked → …` row on cards; Connections section in item detail
  - Add/remove links via `@`-mention picker

- [x] **Stage 5 — Cleanup** ✅
  - Remove React Flow canvas + Priorities view + dead canvas fields
  - Drop unused deps; update shortcuts dialog + nav constants

## Notes
- Stages 1–2 are additive; app stays runnable throughout.
- Each stage executed by a Sonnet agent, reviewed before moving on.
