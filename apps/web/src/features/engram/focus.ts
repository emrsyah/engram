// ─────────────────────────────────────────────────────────────────────────────
// Focus — the cohesive home for the daily-focus sub-domain.
//
// "Focus" lets a user pin tasks for a given day, rank them into a Top-3 tier and
// a backlog, reorder them, and have completed ones swept away. Its rules used to
// be smeared across focus-view.tsx (derivation + destructive useEffects) and
// store.tsx (ordering math). They live here now:
//
//   • Derivations (pure, read-only): sortFocusItems, focusBuckets,
//     staleFocusDoneIds, focusDoneTodayIds.
//   • Mutations (pure EngramData -> EngramData): pinToFocus, unpinFromFocus,
//     setFocusTier, reorderFocusPlan, purgeStaleFocusDone. These COMPOSE the
//     engram-core primitives (patchItem / deleteItems) so all invariants and
//     timestamping stay owned by the core — focus.ts is the feature layer on top.
//
// `today` (a YYYY-MM-DD prefix) is always passed in, never read from the clock,
// so every function here is pure and unit-testable. The store supplies it via
// todayPrefix(); the views never compute focus state themselves.
// ─────────────────────────────────────────────────────────────────────────────

import { deleteItems, patchItem } from "./engram-core";
import { focusPinnedItems } from "./projections";
import type { EngramData, FocusTier, Item } from "./types";

/** How many tasks the "Top" tier shows before the rest spill into the backlog. */
export const FOCUS_TOP_LIMIT = 3;

/** Stable focus ordering: explicit sort order first, then creation order. */
export function sortFocusItems(items: Item[]): Item[] {
  return [...items].sort((a, b) => {
    const order = (a.focusSortOrder ?? 9999) - (b.focusSortOrder ?? 9999);
    if (order !== 0) return order;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export type FocusBuckets = {
  /** Pending top-tier tasks for today, capped at FOCUS_TOP_LIMIT. */
  top: Item[];
  /** Pending backlog tasks for today, plus any top-tier overflow. */
  backlog: Item[];
  /** Today's completed focus tasks. */
  done: Item[];
  /** Today's pending tasks in sort order (the reorderable list). */
  pending: Item[];
  /** Pinned focus tasks carried over from previous days. */
  legacy: Item[];
};

/** Split today's pinned focus tasks into top / backlog / done, plus legacy carry-over. */
export function focusBuckets(items: Item[], today: string): FocusBuckets {
  const pinnedTasks = focusPinnedItems(items).filter((item) => item.type === "task");

  const todays = sortFocusItems(pinnedTasks.filter((item) => item.focusPlanDate === today));
  const legacy = sortFocusItems(pinnedTasks.filter((item) => item.focusPlanDate !== today));

  const done = todays.filter((item) => item.done);
  const pending = todays.filter((item) => !item.done);

  const top = pending.filter((item) => item.focusTier === "top").slice(0, FOCUS_TOP_LIMIT);
  const overflowTop = pending.filter((item) => item.focusTier === "top").slice(FOCUS_TOP_LIMIT);
  const backlog = pending.filter((item) => item.focusTier !== "top").concat(overflowTop);

  return { top, backlog, done, pending, legacy };
}

/** Done focus tasks left over from earlier days — swept on hydrate / day rollover. */
export function staleFocusDoneIds(items: Item[], today: string): string[] {
  return items
    .filter(
      (item) =>
        item.type === "task" && item.done && item.focusPlanDate && item.focusPlanDate < today,
    )
    .map((item) => item.id);
}

/** Today's completed focus tasks — swept at end of day. */
export function focusDoneTodayIds(items: Item[], today: string): string[] {
  return focusBuckets(items, today).done.map((item) => item.id);
}

// ── Mutations (compose engram-core) ─────────────────────────────────────────

function maxFocusOrder(items: Item[], today: string): number {
  return Math.max(
    -1,
    ...items
      .filter((item) => item.focusPinned && item.focusPlanDate === today)
      .map((item) => item.focusSortOrder ?? -1),
  );
}

/** Pin a task into today's focus plan, appended to the backlog. */
export function pinToFocus(data: EngramData, id: string, today: string): EngramData {
  return patchItem(data, id, {
    focusPinned: true,
    focusPlanDate: today,
    focusTier: "backlog",
    focusSortOrder: maxFocusOrder(data.items, today) + 1,
  });
}

/** Remove a task from the focus plan entirely. */
export function unpinFromFocus(data: EngramData, id: string): EngramData {
  return patchItem(data, id, {
    focusPinned: false,
    focusPlanDate: undefined,
    focusTier: undefined,
    focusSortOrder: undefined,
  });
}

/** Move a task to a tier (pinning it into today's plan if it wasn't already). */
export function setFocusTier(
  data: EngramData,
  id: string,
  tier: FocusTier,
  today: string,
): EngramData {
  const item = data.items.find((candidate) => candidate.id === id);
  if (!item) return data;
  return patchItem(data, id, {
    focusPinned: true,
    focusPlanDate: today,
    focusTier: tier,
    focusSortOrder: item.focusSortOrder ?? maxFocusOrder(data.items, today) + 1,
  });
}

/** Apply a new ordering to the focus plan; ids not listed keep their position. */
export function reorderFocusPlan(data: EngramData, orderedIds: string[]): EngramData {
  return orderedIds.reduce((acc, id, index) => patchItem(acc, id, { focusSortOrder: index }), data);
}

/** Delete completed focus tasks carried over from previous days. */
export function purgeStaleFocusDone(data: EngramData, today: string): EngramData {
  return deleteItems(data, staleFocusDoneIds(data.items, today));
}
