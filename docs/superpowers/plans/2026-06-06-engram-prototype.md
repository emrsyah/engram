# Engram Prototype Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available and explicitly approved by the user) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first high-fidelity Engram prototype: a single-user spatial second-brain canvas with capture, draggable cards, links, search, timeline, and priority lenses.

**Architecture:** Replace the starter app UI with a client-side Engram shell backed by a local data service. Keep all data normalized behind an adapter boundary so the prototype can later move to PowerSync/Postgres without rewriting the canvas.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui primitives from `packages/ui`, lucide-react icons, local browser persistence.

---

## File Structure

- Create: `apps/web/src/features/engram/types.ts`
  - Owns Engram domain types: `Space`, `Item`, `ItemLink`, `CanvasViewState`, view names, priorities, accents.
- Create: `apps/web/src/features/engram/seed.ts`
  - Provides reference-quality starter spaces, items, links, and canvas state.
- Create: `apps/web/src/features/engram/store.tsx`
  - Client-side data service and React hook. Owns local persistence, mutations, derived timeline/priority/search data, and active view state.
- Create: `apps/web/src/features/engram/components/engram-app.tsx`
  - Top-level app composition.
- Create: `apps/web/src/features/engram/components/app-sidebar.tsx`
  - Left navigation, spaces, recent items, footer icons.
- Create: `apps/web/src/features/engram/components/top-bar.tsx`
  - View switcher, search trigger, capture trigger.
- Create: `apps/web/src/features/engram/components/canvas-view.tsx`
  - Canvas viewport, pan/zoom state, card rendering, connector rendering, double-click creation.
- Create: `apps/web/src/features/engram/components/canvas-card.tsx`
  - Card rendering for thought, task, link, image, and file types.
- Create: `apps/web/src/features/engram/components/connector-layer.tsx`
  - SVG bezier connectors between card centers.
- Create: `apps/web/src/features/engram/components/capture-dialog.tsx`
  - shadcn dialog for `N` capture.
- Create: `apps/web/src/features/engram/components/search-dialog.tsx`
  - shadcn-style command/search dialog.
- Create: `apps/web/src/features/engram/components/timeline-view.tsx`
  - Scheduled task projection.
- Create: `apps/web/src/features/engram/components/priorities-view.tsx`
  - P1/P2/P3 task projection.
- Create: `apps/web/src/features/engram/components/chips.tsx`
  - Reusable priority, due date, and type labels.
- Create: `apps/web/src/features/engram/components/icons.tsx`
  - Thin wrapper around lucide icons used by Engram.
- Modify: `apps/web/src/app/page.tsx`
  - Replace starter health page with `<EngramApp />`.
- Modify: `apps/web/src/app/layout.tsx`
  - Update metadata and remove starter `Header` from the Engram shell.
- Modify: `apps/web/src/index.css`
  - Add Engram dark theme helpers, canvas grid background, scrollbar styling, and root sizing.

## Chunk 1: Domain Model And Store

### Task 1: Add Engram Types

**Files:**
- Create: `apps/web/src/features/engram/types.ts`

- [ ] **Step 1: Create domain types**

Add:

```ts
export type EngramView = "canvas" | "timeline" | "priorities";
export type ItemType = "thought" | "task" | "image" | "link" | "file";
export type Priority = 1 | 2 | 3;
export type Accent = "violet" | "gold" | "teal" | "red" | "blue";

export type Space = {
  id: string;
  name: string;
  icon: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type Item = {
  id: string;
  spaceId: string;
  type: ItemType;
  x: number;
  y: number;
  width: number;
  height: number;
  title?: string;
  text?: string;
  url?: string;
  source?: string;
  caption?: string;
  accent: Accent;
  done: boolean;
  priority?: Priority;
  dueAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ItemLink = {
  id: string;
  spaceId: string;
  fromItemId: string;
  toItemId: string;
  createdAt: string;
};

export type CanvasViewState = {
  id: string;
  spaceId: string;
  panX: number;
  panY: number;
  zoom: number;
  gridVisible: boolean;
  updatedAt: string;
};
```

- [ ] **Step 2: Run typecheck**

Run: `bun run check-types`

Expected: existing project typecheck either passes or reports unrelated pre-existing issues. No errors should reference `types.ts`.

### Task 2: Add Seed Data

**Files:**
- Create: `apps/web/src/features/engram/seed.ts`

- [ ] **Step 1: Write seed data**

Create realistic starter data matching the reference: `Mind`, `Work`, `Reading list`, mixed thought/task/link/image cards, and connector links.

Use fixed IDs like `space-mind`, `item-origin`, `item-task-capture`, and ISO timestamps. Keep every task as an `Item` with `type: "task"`.

- [ ] **Step 2: Verify imports**

Run: `bun run check-types`

Expected: TypeScript accepts the seed data.

### Task 3: Add Local Engram Store

**Files:**
- Create: `apps/web/src/features/engram/store.tsx`

- [ ] **Step 1: Implement store provider and hook**

The store should export:

```ts
export function EngramProvider({ children }: { children: React.ReactNode }) {}
export function useEngramStore() {}
```

State should include:

```ts
spaces
items
links
viewStates
activeSpaceId
activeView
selectedItemId
captureOpen
searchOpen
```

Mutations should include:

```ts
setActiveView(view)
setActiveSpace(spaceId)
createItem(input)
updateItem(id, patch)
moveItem(id, x, y)
toggleDone(id)
connectItems(fromItemId, toItemId)
deleteLink(id)
setViewState(spaceId, patch)
jumpToItem(id)
openCapture()
closeCapture()
openSearch()
closeSearch()
```

- [ ] **Step 2: Add local persistence**

Use one key:

```ts
const STORAGE_KEY = "engram.prototype.v1";
```

Load on mount. Save after state changes. If parsing fails, preserve the bad payload under:

```ts
localStorage.setItem("engram.prototype.v1.backup", badPayload);
```

- [ ] **Step 3: Add derived selectors**

Expose:

```ts
activeSpace
activeItems
activeLinks
recentItems
scheduledTasks
tasksByPriority
searchItems(query)
```

- [ ] **Step 4: Run typecheck**

Run: `bun run check-types`

Expected: No type errors in `store.tsx`.

## Chunk 2: App Shell And Styling

### Task 4: Replace Starter Page With Engram Shell

**Files:**
- Create: `apps/web/src/features/engram/components/engram-app.tsx`
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Create `EngramApp` composition**

Render:

```tsx
<EngramProvider>
  <div className="engram-shell">
    <AppSidebar />
    <main className="engram-main">
      <TopBar />
      {/* active view */}
      <CaptureDialog />
      <SearchDialog />
    </main>
  </div>
</EngramProvider>
```

- [ ] **Step 2: Replace `apps/web/src/app/page.tsx`**

Remove the starter health check and render only:

```tsx
import { EngramApp } from "@/features/engram/components/engram-app";

export default function Home() {
  return <EngramApp />;
}
```

- [ ] **Step 3: Update layout metadata and remove starter header**

Set metadata title/description to Engram. Remove the starter `Header` wrapper so the app owns the full viewport.

- [ ] **Step 4: Run typecheck**

Run: `bun run check-types`

Expected: Missing component errors are allowed until later tasks if referenced components are not created yet. Once all shell components exist, this must pass.

### Task 5: Add Styling Foundation

**Files:**
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Add Engram shell styles**

Add CSS classes for:

```css
.engram-shell
.engram-main
.engram-card
.engram-grid
.engram-scrollbar
```

Use near-black surfaces, charcoal cards, warm borders, muted violet accents, and no oversized rounded cards.

- [ ] **Step 2: Verify no layout overflow at root**

Run: `bun run build`

Expected: Build succeeds after referenced components exist.

## Chunk 3: Navigation And Controls

### Task 6: Build Sidebar

**Files:**
- Create: `apps/web/src/features/engram/components/app-sidebar.tsx`
- Create: `apps/web/src/features/engram/components/icons.tsx`

- [ ] **Step 1: Render fixed-width sidebar**

Use lucide icons for brand, views, spaces, recent items, and footer actions. Use shadcn `Button` variants where appropriate.

- [ ] **Step 2: Wire view and space switching**

Clicking Canvas, Timeline, Priorities, or a space calls store mutations.

- [ ] **Step 3: Run typecheck**

Run: `bun run check-types`

Expected: Sidebar compiles.

### Task 7: Build Top Bar

**Files:**
- Create: `apps/web/src/features/engram/components/top-bar.tsx`

- [ ] **Step 1: Render active view switcher**

Use shadcn `Button` components and lucide icons. Keep controls compact and aligned like the reference.

- [ ] **Step 2: Wire search and capture buttons**

Search opens `SearchDialog`. Capture opens `CaptureDialog`.

- [ ] **Step 3: Add keyboard listeners**

At app level or top bar level:

```ts
N -> openCapture()
/ -> openSearch()
Cmd/Ctrl+K -> openSearch()
```

Ignore hotkeys when typing in an input or textarea.

## Chunk 4: Canvas

### Task 8: Build Canvas View

**Files:**
- Create: `apps/web/src/features/engram/components/canvas-view.tsx`
- Create: `apps/web/src/features/engram/components/connector-layer.tsx`

- [ ] **Step 1: Render world-coordinate canvas**

Use an absolutely positioned inner world transformed by `translate(panX, panY) scale(zoom)`.

- [ ] **Step 2: Add empty-canvas double-click**

Convert screen coordinates to world coordinates and create a thought item there.

- [ ] **Step 3: Add pan and zoom controls**

Start with drag-empty-space pan plus +/- controls. Clamp zoom from `0.35` to `2.2`.

- [ ] **Step 4: Render connectors behind cards**

Use SVG paths between item centers:

```ts
M startX startY C midX startY, midX endY, endX endY
```

- [ ] **Step 5: Run typecheck**

Run: `bun run check-types`

Expected: Canvas components compile.

### Task 9: Build Canvas Cards

**Files:**
- Create: `apps/web/src/features/engram/components/canvas-card.tsx`
- Create: `apps/web/src/features/engram/components/chips.tsx`

- [ ] **Step 1: Render each card type**

Implement thought, task, link, image, and file card layouts using shadcn `Checkbox` for task completion.

- [ ] **Step 2: Add card dragging**

Use pointer events. Update in memory during drag and call `moveItem` at the end. Prevent drag from toggling checkboxes.

- [ ] **Step 3: Add link creation**

Minimal v1 behavior: expose a small handle on hover. Clicking handle enters link mode; clicking another card creates an `ItemLink`; `Esc` cancels.

- [ ] **Step 4: Run typecheck**

Run: `bun run check-types`

Expected: Cards compile and no implicit `any` event handlers remain.

## Chunk 5: Capture, Search, And Lenses

### Task 10: Build Capture Dialog

**Files:**
- Create: `apps/web/src/features/engram/components/capture-dialog.tsx`

- [ ] **Step 1: Implement shadcn dialog**

Use `Dialog`, `Input`, `Button`, and compact task controls. Default to thought capture.

- [ ] **Step 2: Add keyboard commit**

`Enter` creates the item unless text is empty. `Esc` closes. New item is centered in the current viewport.

- [ ] **Step 3: Run typecheck**

Run: `bun run check-types`

Expected: Capture compiles.

### Task 11: Build Search Dialog

**Files:**
- Create: `apps/web/src/features/engram/components/search-dialog.tsx`

- [ ] **Step 1: Implement search UI**

Use shadcn input/dialog primitives. Show matching item title/text/url/caption.

- [ ] **Step 2: Jump to selected item**

Selecting a result switches to canvas, active item's space, and centers that item.

- [ ] **Step 3: Run typecheck**

Run: `bun run check-types`

Expected: Search compiles.

### Task 12: Build Timeline And Priorities

**Files:**
- Create: `apps/web/src/features/engram/components/timeline-view.tsx`
- Create: `apps/web/src/features/engram/components/priorities-view.tsx`

- [ ] **Step 1: Implement Timeline**

Group task items into Today, upcoming days, and Someday. Use shadcn checkboxes and chips.

- [ ] **Step 2: Implement Priorities**

Group task items by P1, P2, and P3. Show open counts and completed muted rows.

- [ ] **Step 3: Add click-through to canvas**

Clicking a task calls `jumpToItem`.

- [ ] **Step 4: Run typecheck**

Run: `bun run check-types`

Expected: Views compile.

## Chunk 6: Verification

### Task 13: Full Build

**Files:**
- Verify all files above.

- [ ] **Step 1: Run typecheck**

Run: `bun run check-types`

Expected: PASS.

- [ ] **Step 2: Run build**

Run: `bun run build`

Expected: PASS.

### Task 14: Manual Browser QA

**Files:**
- Verify running app only.

- [ ] **Step 1: Start dev server**

Run: `bun run dev:web`

Expected: Next app starts on `http://localhost:3031`.

- [ ] **Step 2: Open the app**

Open: `http://localhost:3031`

Expected: Engram canvas appears immediately.

- [ ] **Step 3: Validate core loop**

Check:

- `N` opens capture.
- `Enter` creates a card in the current viewport.
- Double-clicking empty canvas creates a thought card.
- Cards drag without layout shifts.
- Connectors follow moved cards.
- Timeline and Priorities reflect the same tasks.
- Search jumps to offscreen cards.
- Reload preserves cards and view state.
- Mobile viewport does not overlap sidebar/top bar/content.

### Task 15: Commit Checkpoint

**Files:**
- All created and modified files.

- [ ] **Step 1: Check git availability**

Run: `git status --short`

Expected: If this is a git repository, show changed files. If not, skip commit and report that the workspace is not initialized as Git.

- [ ] **Step 2: Commit if possible**

Run:

```bash
git add apps/web/src/app/page.tsx apps/web/src/app/layout.tsx apps/web/src/index.css apps/web/src/features/engram docs/plans/2026-06-06-engram-design.md docs/superpowers/plans/2026-06-06-engram-prototype.md
git commit -m "feat: add engram prototype"
```

Expected: Commit succeeds only in a valid git repository.
