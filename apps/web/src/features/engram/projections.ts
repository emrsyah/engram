import { RECENT_ITEMS_LIMIT, SEARCH_RESULT_LIMIT } from "./config";
import { seedViewStates } from "./seed";
import type { CanvasViewState, EngramData, Item, ItemLink, Priority, Space } from "./types";

/**
 * Projections — read-only lenses over the canonical Engram data.
 *
 * The canvas owns the data model; everything here derives a view of it
 * (active space slices, recent items, task lenses, search). All pure
 * functions of their inputs, so the interface is the test surface.
 */

export function selectActiveSpace(data: EngramData): Space | undefined {
  return data.spaces.find((space) => space.id === data.activeSpaceId);
}

export function selectActiveItems(data: EngramData): Item[] {
  return data.items.filter((item) => item.spaceId === data.activeSpaceId && !item.inbox);
}

export function selectActiveLinks(data: EngramData): ItemLink[] {
  // Only links whose endpoints are both visible on the active canvas (excludes
  // links touching Inbox items, which aren't placed yet).
  const visible = new Set(
    data.items.filter((i) => i.spaceId === data.activeSpaceId && !i.inbox).map((i) => i.id),
  );
  return data.links.filter(
    (link) =>
      link.spaceId === data.activeSpaceId &&
      visible.has(link.fromItemId) &&
      visible.has(link.toItemId),
  );
}

/** Untriaged captures awaiting a home, newest first. */
export function inboxItems(items: Item[]): Item[] {
  return items.filter((item) => item.inbox).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function selectActiveViewState(data: EngramData): CanvasViewState {
  return (
    data.viewStates.find((viewState) => viewState.spaceId === data.activeSpaceId) ??
    seedViewStates[0]
  );
}

export function recentItems(items: Item[]): Item[] {
  return [...items]
    .filter((item) => !item.inbox)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, RECENT_ITEMS_LIMIT);
}

export function scheduledTasks(items: Item[]): Item[] {
  return items
    .filter((item) => item.type === "task" && !item.inbox)
    .sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"));
}

export function tasksByPriority(items: Item[]): Record<Priority, Item[]> {
  const placed = items.filter((item) => item.type === "task" && !item.inbox);
  return {
    1: placed.filter((item) => item.priority === 1),
    2: placed.filter((item) => item.priority === 2),
    3: placed.filter((item) => item.priority === 3),
  };
}

export function searchItems(items: Item[], query: string, fallback: Item[]): Item[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  return items
    .filter((item) =>
      [item.title, item.text, item.url, item.caption, item.source]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    )
    .slice(0, SEARCH_RESULT_LIMIT);
}

/**
 * Returns tasks due on a specific calendar day.
 * `datePrefix` is a YYYY-MM-DD string; "someday" matches tasks with no dueAt.
 */
export function tasksForDay(tasks: Item[], datePrefix: string): Item[] {
  if (datePrefix === "someday") {
    return tasks.filter((task) => !task.dueAt);
  }
  return tasks.filter((task) => task.dueAt?.startsWith(datePrefix));
}

/** All items marked as pinned to the focus panel (across all spaces). */
export function focusPinnedItems(items: Item[]): Item[] {
  return items.filter((item) => item.focusPinned && !item.inbox);
}

/** Tasks due today that have NOT been pinned to the focus panel. */
export function todayUnpinnedTasks(items: Item[]): Item[] {
  const prefix = todayPrefix();
  return items.filter(
    (item) => item.type === "task" && !item.inbox && !item.done && item.dueAt?.startsWith(prefix) && !item.focusPinned,
  );
}

/** Returns today's YYYY-MM-DD prefix in local time. */
export function todayPrefix(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Tasks due today (across all spaces), sorted by done status then creation order. */
export function todayTasks(items: Item[]): Item[] {
  const prefix = todayPrefix();
  return items
    .filter((item) => item.type === "task" && !item.inbox && item.dueAt?.startsWith(prefix))
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return a.createdAt.localeCompare(b.createdAt);
    });
}

/** All items created today or due today (for the focus mini-canvas). */
export function todayItems(items: Item[]): Item[] {
  const prefix = todayPrefix();
  return items.filter(
    (item) =>
      !item.inbox &&
      (item.createdAt.startsWith(prefix) || item.dueAt?.startsWith(prefix)),
  );
}

export function itemsByTag(items: Item[], tag: string): Item[] {
  return items.filter((i) => i.tags?.includes(tag));
}

export function allTags(items: Item[]): string[] {
  return [...new Set(items.flatMap((i) => i.tags ?? []))].sort();
}

export function searchItemsByTag(items: Item[], query: string): Item[] {
  const normalized = query.toLowerCase().replace(/^#/, "");
  return items.filter((i) => i.tags?.some((t) => t.toLowerCase().includes(normalized)));
}

export function overdueTasks(items: Item[]): Item[] {
  const now = new Date().toISOString();
  return items
    .filter((i) => i.type === "task" && !i.inbox && !i.done && i.dueAt && i.dueAt < now)
    .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!));
}

export function overdueNotPinned(items: Item[]): Item[] {
  return overdueTasks(items).filter((i) => !i.focusPinned);
}

/** Builds the 7-day window starting from today for the Timeline view. */
export function buildWeekDays(): { label: string; datePrefix: string }[] {
	const days = [];
	const today = new Date();
	for (let i = 0; i < 7; i++) {
		const d = new Date(today);
		d.setDate(today.getDate() + i);
		const label = i === 0 ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" });
		const datePrefix = d.toISOString().slice(0, 10);
		days.push({ label, datePrefix });
	}
	return days;
}

// ─── All-tasks grouping helpers (for the Tasks view) ─────────────────────────

/** All tasks across every space (excl. inbox), sorted by createdAt. */
function allTaskItems(items: Item[]): Item[] {
	return items.filter((i) => i.type === "task" && !i.inbox);
}

/**
 * Group all tasks by their space.
 * Returns a map of spaceId -> Item[].
 */
export function groupTasksBySpace(items: Item[]): Map<string, Item[]> {
	const tasks = allTaskItems(items);
	const result = new Map<string, Item[]>();
	for (const task of tasks) {
		const bucket = result.get(task.spaceId) ?? [];
		bucket.push(task);
		result.set(task.spaceId, bucket);
	}
	return result;
}

/**
 * Group all tasks by priority.
 * Unprioritised tasks land under the key `undefined`.
 */
export function groupTasksByPriority(items: Item[]): Map<Priority | undefined, Item[]> {
	const tasks = allTaskItems(items);
	const result = new Map<Priority | undefined, Item[]>();
	for (const task of tasks) {
		const key = task.priority;
		const bucket = result.get(key) ?? [];
		bucket.push(task);
		result.set(key, bucket);
	}
	return result;
}

export type DueBucket = "overdue" | "today" | "upcoming" | "someday";

/**
 * Group all tasks by due-date bucket.
 *
 * - overdue  — dueAt is in the past (before today's date prefix)
 * - today    — dueAt starts with today's YYYY-MM-DD prefix
 * - upcoming — dueAt is in the future (after today)
 * - someday  — no dueAt (undated; includes items flagged someday=true)
 */
export function groupTasksByDue(items: Item[]): Map<DueBucket, Item[]> {
	const tasks = allTaskItems(items);
	const prefix = todayPrefix();
	const result = new Map<DueBucket, Item[]>([
		["overdue", []],
		["today", []],
		["upcoming", []],
		["someday", []],
	]);

	for (const task of tasks) {
		let bucket: DueBucket;
		if (!task.dueAt) {
			bucket = "someday";
		} else if (task.dueAt.slice(0, 10) < prefix) {
			bucket = "overdue";
		} else if (task.dueAt.startsWith(prefix)) {
			bucket = "today";
		} else {
			bucket = "upcoming";
		}
		result.get(bucket)!.push(task);
	}

	// Sort overdue oldest-first, others by dueAt then createdAt
	result.get("overdue")!.sort((a, b) => a.dueAt!.localeCompare(b.dueAt!));
	result.get("today")!.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
	result.get("upcoming")!.sort((a, b) => a.dueAt!.localeCompare(b.dueAt!));
	result.get("someday")!.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

	return result;
}

// ─── Backlinks ────────────────────────────────────────────────────────────────

/**
 * Return items linked to the given item — in either direction — within the
 * same space, resolved to full Item objects.
 */
export function backlinksForItem(data: EngramData, itemId: string): Item[] {
	const item = data.items.find((i) => i.id === itemId);
	if (!item) return [];

	const linkedIds = new Set<string>();
	for (const link of data.links) {
		if (link.spaceId !== item.spaceId) continue;
		if (link.fromItemId === itemId) linkedIds.add(link.toItemId);
		else if (link.toItemId === itemId) linkedIds.add(link.fromItemId);
	}

	return data.items.filter((i) => linkedIds.has(i.id));
}
