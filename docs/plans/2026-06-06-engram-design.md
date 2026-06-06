# Engram Design

Date: 2026-06-06
Status: Approved design

## Product Scope

Engram v1 is a single-user, high-fidelity canvas prototype that is architected for PowerSync later.

The first validated loop is:

1. Open Engram directly into the canvas.
2. Press `N` to capture a thought or task.
3. New item appears centered in the current viewport.
4. Drag cards around the spatial canvas.
5. Connect items with visible curved links.
6. Search and jump to items.
7. See task projections in Timeline and Priorities as read-only or lightly interactive lenses.

The canvas owns the data model. Timeline and Priorities are projections over the same items.

Out of scope for v1:

- Real multi-device sync.
- External calendar sync.
- AI features.
- Full file storage pipeline.
- Rich document editing.
- Multi-user collaboration.

## Architecture

The app should use a data adapter boundary so the first prototype is useful now and still points toward the long-term PowerSync architecture.

```txt
Next.js client UI
  -> Engram data service
    -> local prototype adapter now
    -> PowerSync adapter later
  -> shared Engram schema/types
Postgres + PowerSync later
```

The UI should not read or write directly to browser storage or a future sync SDK. Components call a small data service:

```ts
createItem()
updateItem()
moveItem()
toggleDone()
connectItems()
deleteLink()
setViewState()
searchItems()
```

For v1, the adapter persists locally. Records should already look like future Postgres and PowerSync rows so that the adapter can later be replaced without rewriting the canvas.

Long-term PowerSync shape:

```txt
Postgres source tables
PowerSync service sync streams
client-side local database
React app reads and writes local database
backend write endpoint or PowerSync upload queue handles writes
```

Card movement must be local and immediate. Persistence should be debounced, especially for drag position updates.

## Data Model

Core records:

```ts
type Space = {
  id: string;
  name: string;
  icon: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type Item = {
  id: string;
  spaceId: string;
  type: "thought" | "task" | "image" | "link" | "file";
  x: number;
  y: number;
  width: number;
  height: number;
  title?: string;
  text?: string;
  url?: string;
  source?: string;
  caption?: string;
  accent: "violet" | "gold" | "teal" | "red" | "blue";
  done: boolean;
  priority?: 1 | 2 | 3;
  dueAt?: string;
  createdAt: string;
  updatedAt: string;
};

type ItemLink = {
  id: string;
  spaceId: string;
  fromItemId: string;
  toItemId: string;
  createdAt: string;
};

type CanvasViewState = {
  id: string;
  spaceId: string;
  panX: number;
  panY: number;
  zoom: number;
  gridVisible: boolean;
  updatedAt: string;
};
```

Tasks are item records, not a separate table, because tasks remain first-class canvas cards. Links are separate records so connectors can be independently deleted and synced. Coordinates are canvas-world coordinates, not screen coordinates.

Timeline and Priorities are computed from `items` where `type === "task"`.

## UI Components

The starter page should be replaced with the Engram app shell.

Main components:

```txt
EngramApp
AppSidebar
TopBar
CanvasView
CanvasViewport
CanvasCard
ConnectorLayer
CaptureModal
SearchCommand
TimelineView
PrioritiesView
```

Canvas behavior:

- Full-screen app surface.
- Left sidebar with primary views, spaces, and recent items.
- Top bar with current view switcher, search, and capture button.
- Dot-grid infinite-feeling canvas.
- Absolutely positioned cards in world coordinates.
- SVG connector layer behind cards.
- Pointer drag for cards.
- Empty-space double-click creates a thought.
- `N` opens capture.
- `/` or `Cmd/Ctrl+K` opens search.
- Zoom controls can start simple, then pointer-wheel zoom can be added after drag is stable.

Card types:

- Thought: text-first card with small type label.
- Task: checkbox, title, priority chip, due chip.
- Link: title, domain, short description.
- Image/file: metadata card with placeholder preview in v1.

Timeline and Priorities render the same item records. Clicking a task switches to canvas and centers that item.

## Styling System

Use shadcn/ui primitives for standard interface controls:

- Buttons.
- Inputs.
- Dropdowns and menus.
- Dialog for capture.
- Command/search palette.
- Checkbox.
- Tabs or segmented controls.
- Tooltip.

Custom components handle the spatial surface:

- Canvas viewport.
- Card positioning.
- Connector SVG.
- Dot grid.
- Zoom and pan controls.

Visual direction:

```txt
near-black app shell
charcoal cards
thin warm borders
muted violet primary accent
gold/red/blue priority chips
teal link/image accents
Geist Sans + Geist Mono
8px or lower card radius
```

The reference images are the fidelity target. The UI should stay dense, restrained, and usable.

## Data Flow And Sync Readiness

The app should expose a single local state source through an Engram hook or service:

```ts
useEngramStore()
```

That store owns:

- `spaces`
- `items`
- `links`
- `viewState`
- `activeSpaceId`
- UI-only state like active view, capture modal, and search modal.

Write flow:

```txt
user action
-> data service mutation
-> local state updates immediately
-> persistence saves normalized records
-> later PowerSync adapter maps same mutation to local DB/write queue
```

Examples:

```txt
drag card
-> update in memory every pointer move
-> persist x/y after drag ends or debounce

capture thought
-> create item immediately
-> persist immediately
-> center card in current viewport

click timeline task
-> set active view canvas
-> set pan/zoom so item is centered
```

Sync-readiness rules:

- Use client-generated IDs.
- Store timestamps on every record.
- Keep records normalized.
- Avoid permanent timeline or priority records.
- Keep file and image content behind a `source` field so storage can later become Supabase, S3, or local file handles.

## Error Handling

For v1:

- If local persistence fails, show a shadcn toast and keep the in-memory session alive.
- If saved data is invalid or from an older schema, load seed data and preserve the bad payload under a backup key.
- If a card is dragged outside the visible area, search and jump can recenter it.
- If a link points to a missing item, hide that connector.
- If capture input is empty, `Enter` does nothing.
- If there are no tasks in Timeline or Priorities, show a quiet empty state.
- On mobile-sized viewports, keep the sidebar collapsible and prioritize the canvas and top bar.

For future PowerSync:

- Show sync status: local, syncing, synced, error.
- Never block card movement on network state.
- Batch and debounce canvas-position writes.
- Treat conflicts on simple item fields as last-write-wins initially.

## Testing And Validation

Automated checks:

- Typecheck with the repo's typecheck command.
- Build with the repo's build command.
- Unit-test pure data helpers if a test setup exists. Do not add a test framework just for the first prototype.

Manual browser validation:

- App opens directly to Engram canvas.
- `N` opens capture.
- Capturing a thought creates a card in the viewport.
- Double-click canvas creates a thought.
- Cards drag smoothly and persist after reload.
- Links render between moved cards.
- Timeline and Priorities reflect the same task data.
- Search jumps to an offscreen item.
- Mobile viewport has no broken overlap.

Future PowerSync validation:

- Offline create, edit, and reload.
- Reconnect sync.
- Multi-device convergence.
- Conflict behavior for simultaneous edits.
- Migration from local prototype storage to synced database.
