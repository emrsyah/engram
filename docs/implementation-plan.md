# Engram Implementation Plan

Derived from [ux-analysis.md](./ux-analysis.md). Ordered by impact — items that unblock the most value come first.

---

## Phase 1: Mental Model Shift — Focus-First

Goal: Make Focus the default view so the app opens to what matters each day, not an empty canvas.

### 1.1 Change default route to `/focus`

**Files:**
- `apps/web/src/app/page.tsx` — change redirect from `/canvas` to `/focus`
- `apps/web/src/features/engram/components/hotkeys.tsx` — `1` already maps to Focus, but update descriptions if needed

**Changes:**
```ts
// page.tsx
redirect("/focus");
```

**Risk:** Low. One-line change. Canvas is still accessible via sidebar/nav/hotkey `2`.

### 1.2 Update TopBar context when on Focus view

**Files:**
- `apps/web/src/features/engram/components/top-bar.tsx`

**Changes:**
- When `pathname === "/focus"`, show "Focus" as the title instead of `activeSpace.name`. Currently shows the active space name regardless of which view you're on, which is misleading on Focus/Timeline/Priorities.

---

## Phase 2: Tags (The #1 Gap)

Goal: Items can have multiple tags, enabling overlapping contexts and better retrieval.

### 2.1 Add `tags` field to Item type

**Files:**
- `apps/web/src/features/engram/types.ts` — add `tags?: string[]` to `Item`
- `apps/web/src/features/engram/persistence.ts` — add `tags: z.array(z.string()).optional()` to `ItemSchema`
- `apps/web/src/features/engram/seed.ts` — add sample tags to seed items (e.g. `["school"]`, `["work", "urgent"]`)

### 2.2 Tag mutations in domain core

**Files:**
- `apps/web/src/features/engram/engram-core.ts`

**Add:**
```ts
export function setItemTags(data: EngramData, id: string, tags: string[]): EngramData {
  return patchItem(data, id, { tags });
}

export function addItemTag(data: EngramData, id: string, tag: string): EngramData {
  const item = data.items.find(i => i.id === id);
  if (!item) return data;
  const tags = [...new Set([...(item.tags ?? []), tag])];
  return patchItem(data, id, { tags });
}

export function removeItemTag(data: EngramData, id: string, tag: string): EngramData {
  const item = data.items.find(i => i.id === id);
  if (!item) return data;
  const tags = (item.tags ?? []).filter(t => t !== tag);
  return patchItem(data, id, { tags });
}
```

### 2.3 Tag projections

**Files:**
- `apps/web/src/features/engram/projections.ts`

**Add:**
```ts
export function itemsByTag(items: Item[], tag: string): Item[] {
  return items.filter(i => i.tags?.includes(tag));
}

export function allTags(items: Item[]): string[] {
  return [...new Set(items.flatMap(i => i.tags ?? []))].sort();
}

export function searchItemsByTag(items: Item[], query: string): Item[] {
  const normalized = query.toLowerCase().replace(/^#/, "");
  return items.filter(i => i.tags?.some(t => t.toLowerCase().includes(normalized)));
}
```

### 2.4 Tag support in Quick Capture

**Files:**
- `apps/web/src/features/engram/components/quick-capture-bar.tsx`

**Changes:**
- Parse `#tag` patterns from capture text (same pattern as `!p1` parsing)
- Extract tags before creating the item
- Show parsed tags tags as chips (same visual pattern as priority/due chips)
- Support: `call dentist #school tomorrow 3pm !p1`

**Add to `parseTaskText`-equivalent:**
```ts
const tagMatches = [...value.matchAll(/#(\w[\w-]*)/g)];
const tags = tagMatches.map(m => m[1]);
// Remove tag tokens from cleanText, add to item input
```

### 2.5 Tag chips on item cards and detail panel

**Files:**
- `apps/web/src/features/engram/components/item-card-bodies.tsx` — render tag chips below title/text
- `apps/web/src/features/engram/components/item-detail-panel.tsx` — add tag editor section
- `apps/web/src/features/engram/components/chips.tsx` — add `TagChip` component

**Detail panel tag section:**
- Show existing tags as removable chips
- Input to add new tag (Enter to add)
- Suggest existing tags (autocomplete from `allTags()`)

### 2.6 Tag filtering in Search

**Files:**
- `apps/web/src/features/engram/components/search-dialog.tsx`

**Changes:**
- When query starts with `#`, filter by tag instead of text
- Show tag matches with tag chip styling

### 2.7 Wire into store

**Files:**
- `apps/web/src/features/engram/store.tsx` — expose `setItemTags`, `addItemTag`, `removeItemTag` from the store context

---

## Phase 3: Capture Improvements

Goal: Remove friction from the capture flow so it works as a true inbox.

### 3.1 Space selector in Quick Capture

**Files:**
- `apps/web/src/features/engram/components/quick-capture-bar.tsx`
- `apps/web/src/features/engram/engram-core.ts` — `CreateItemInput` already has `spaceId?: string`
- `apps/web/src/features/engram/store.tsx` — `createItem` already passes `input.spaceId`

**Changes:**
- Add a small space selector dropdown (PopoverTrigger with space list) next to the mode tabs
- Default: active space (current behavior)
- Show current target space icon + name
- Clicking a different space sets `spaceId` for the next capture
- When `stayOnCurrentView` is true, item lands in the chosen space without navigating away

### 3.2 "Someday" / "Later" as capture keywords

**Files:**
- `apps/web/src/features/engram/components/quick-capture-bar.tsx`

**Changes in `parseDuePhrase`:**
- Add patterns: `\bsomeday\b`, `\blater\b`, `\bno rush\b`
- These resolve to `dueAt: undefined` but produce a visible chip "Someday" / "Later"
- Differentiate from "no due date" by adding an optional `dueLabel?: "someday" | "later"` field, or simply show the chip when the word was parsed but no date was set

**Visual:**
- Show a chip like the "Due Tomorrow" chip but with "Later" styling (muted, no date)

### 3.3 "Move to space" action in detail panel

**Files:**
- `apps/web/src/features/engram/components/item-detail-panel.tsx`
- `apps/web/src/features/engram/engram-core.ts`
- `apps/web/src/features/engram/store.tsx`

**Add to core:**
```ts
export function moveItemToSpace(data: EngramData, itemId: string, targetSpaceId: string): EngramData {
  const item = data.items.find(i => i.id === itemId);
  if (!item) return data;
  // Remove links that cross spaces (same invariant as addLink)
  const validLinks = data.links.filter(l => {
    if (l.fromItemId !== itemId && l.toItemId !== itemId) return true;
    // This link involves the moved item — remove it if the other item isn't in target space
    const otherId = l.fromItemId === itemId ? l.toItemId : l.fromItemId;
    const other = data.items.find(i => i.id === otherId);
    return other?.spaceId === targetSpaceId;
  });
  return {
    ...data,
    items: data.items.map(i => i.id === itemId ? { ...i, spaceId: targetSpaceId, updatedAt: now() } : i),
    links: validLinks,
  };
}
```

**Detail panel:**
- Add a "Space" section with a dropdown to change space
- Show current space name/icon

---

## Phase 4: Overdue + Morning Triage

Goal: No task falls through the cracks. Focus surfaces everything that needs attention today.

### 4.1 Overdue projection

**Files:**
- `apps/web/src/features/engram/projections.ts`

**Add:**
```ts
export function overdueTasks(items: Item[]): Item[] {
  const now = new Date().toISOString();
  return items
    .filter(i => i.type === "task" && !i.done && i.dueAt && i.dueAt < now)
    .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!));
}

export function overdueNotPinned(items: Item[]): Item[] {
  const today = todayPrefix();
  return overdueTasks(items).filter(i => !i.focusPinned);
}
```

### 4.2 Overdue section in Focus view

**Files:**
- `apps/web/src/features/engram/components/focus-view.tsx`

**Changes:**
- Add an "Overdue" section above "Due today" (same layout as `TodayUnpinnedSection`)
- Each overdue task shows: title, due date (in red/warning styling), Pin button
- Same collapse/expand pattern as the existing "Due today" section

### 4.3 Morning triage on Focus load

**Files:**
- `apps/web/src/features/engram/components/focus-view.tsx`
- `apps/web/src/features/engram/ui-store.tsx`

**Add:**
- A `triageOpen` UI state (auto-opens when Focus loads and there are unpinned overdue + today tasks)
- Triage modal/banner at top of Focus: "You have 3 overdue and 2 today tasks not in focus. Triage now?"
- Quick actions per task: Pin to Focus, Snooze (reschedule to tomorrow), Dismiss (mark as not focus-worthy, could set `focusDismissed: true` with auto-clear at end of day)

**Snooze implementation:**
```ts
// In engram-core.ts
export function snoozeItem(data: EngramData, id: string, toDate: string): EngramData {
  return patchItem(data, id, { dueAt: toDate });
}
```

### 4.4 Reschedule button on overdue tasks

**Files:**
- `apps/web/src/features/engram/components/chips.tsx`
- `apps/web/src/features/engram/components/focus-view.tsx`

**Changes:**
- When a `DueChip` shows an overdue date, render it with a warning/red accent
- Add a small calendar icon button next to overdue chips that opens the date picker popover (reuse the same Calendar + time picker from capture/detail panel)

---

## Phase 5: Link/Bookmark Improvements

Goal: Make links a real "read later" system, not just URL cards.

### 5.1 Link read status

**Files:**
- `apps/web/src/features/engram/types.ts` — add `readStatus?: "unread" | "reading" | "archived"` to `Item`
- `apps/web/src/features/engram/persistence.ts` — add `readStatus: z.enum(["unread", "reading", "archived"]).optional()` to `ItemSchema`
- `apps/web/src/features/engram/engram-core.ts` — add `markLinkStatus` mutation

**Add:**
```ts
export function markLinkStatus(data: EngramData, id: string, status: "unread" | "reading" | "archived"): EngramData {
  return patchItem(data, id, { readStatus: status });
}
```

### 5.2 Link status in item cards

**Files:**
- `apps/web/src/features/engram/components/item-card-bodies.tsx`
- `apps/web/src/features/engram/components/item-detail-panel.tsx`

**Changes:**
- Link cards show a small status dot/chip: unread (blue dot), reading (amber dot), archived (grey)
- Detail panel has a 3-button toggle for read status (same visual as priority buttons)
- New links default to `unread`

### 5.3 Link collection projection

**Files:**
- `apps/web/src/features/engram/projections.ts`

**Add:**
```ts
export function linksByStatus(items: Item[]): { unread: Item[]; reading: Item[]; archived: Item[] } {
  const links = items.filter(i => i.type === "link");
  return {
    unread: links.filter(i => i.readStatus === "unread" || !i.readStatus),
    reading: links.filter(i => i.readStatus === "reading"),
    archived: links.filter(i => i.readStatus === "archived"),
  };
}
```

### 5.4 URL metadata fetch (server-side)

**Files:**
- `apps/server/src/routes/` — add a tRPC route or Hono endpoint for URL metadata
- `apps/web/src/features/engram/store.tsx` — call metadata endpoint after link creation

**Endpoint:**
- `GET /api/url-meta?url=...` → returns `{ title, description, favicon, ogImage }`
- Server fetches and parses Open Graph / meta tags
- Client receives metadata and patches the link item with `title`, `text` (description), `source` (ogImage URL)

**Security:** Server-side fetch only (no CORS issues, no client-side fetch to arbitrary URLs). Rate-limit to prevent abuse.

---

## Phase 6: Deprioritize / Simplify

Goal: Remove or reduce features that add complexity without proportional daily value.

### 6.1 Deprioritize Priorities page

**Not a code deletion — a UX change:**

**Files:**
- `apps/web/src/features/engram/nav.ts` — move Priorities to last in `NAV_VIEWS`, or remove it
- `apps/web/src/features/engram/components/hotkeys.tsx` — remove `4` hotkey for Priorities, or remap
- `apps/web/src/features/engram/components/top-bar.tsx` — remove Priorities tab from view switcher

**Rationale:** Focus view handles priority grouping. Priorities page is a duplicate projection. Keep the route file but stop surfacing it in navigation.

### 6.2 Mark image/file cards as experimental

**Files:**
- `apps/web/src/features/engram/components/quick-capture-bar.tsx` — remove "Attach" tab from MODE_TABS until file storage is real
- `apps/web/src/features/engram/types.ts` — keep types, no deletion needed

**Rationale:** Blob URLs don't survive reload. The attach flow creates broken cards. Better to remove the tab than ship a broken feature.

### 6.3 Item links — keep but don't over-invest

No code changes. Simply deprioritize any future enhancements to the link/connection system (e.g. link labels, directional links, link types). The current click-to-link flow is sufficient.

---

## Phase 7: Data Safety Net

Goal: Address the localStorage brittleness risk.

### 7.1 Auto-export / backup

**Files:**
- `apps/web/src/features/engram/persistence.ts`

**Add:**
- On every save, also write to a second backup key with a timestamp: `engram-backup-2026-06-09`
- Keep last 7 daily backups
- Add a "Download backup" button in settings that triggers a JSON file download
- Add an "Import backup" flow (file input → parse → `EngramDataSchema.safeParse` → merge or replace)

### 7.2 Data migration path

**Files:**
- `apps/web/src/features/engram/persistence.ts`

**Add:**
- Schema version field in the stored data: `schemaVersion: 1`
- When loading, check version. If older, run migration functions to add new fields with defaults
- This prevents corrupt-data scenarios when new fields (tags, readStatus) are added

```ts
const CURRENT_SCHEMA_VERSION = 2;

function migrate(data: unknown, fromVersion: number): EngramData {
  let result = data;
  if (fromVersion < 2) {
    // Add tags, readStatus defaults to all items
    result = addFieldDefaults(result, { tags: [], readStatus: undefined });
  }
  return result as EngramData;
}
```

---

## Implementation Order Summary

| Phase | What | Impact | Effort |
|---|---|---|---|
| **1** | Focus as default route | High — changes daily entry point | Trivial |
| **2** | Tags on items | High — unblocks overlapping contexts + retrieval | Medium |
| **3** | Capture improvements (space selector, someday, move-to-space) | High — removes capture friction | Medium |
| **4** | Overdue + morning triage | High — prevents tasks falling through cracks | Medium |
| **5** | Link/bookmark improvements | Medium — makes links usable for read-later | Medium-Large |
| **6** | Deprioritize canvas-first, remove attach tab, hide priorities | Medium — reduces clutter and broken features | Trivial |
| **7** | Data safety (backups, migration) | Medium — prevents data loss | Small |

Phases 1 and 6 can be done immediately (under 1 hour combined). Phase 2 is the highest-value feature work. Phases 3-4 follow naturally. Phase 5 can wait until the core flows are solid.
