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
  return data.items.filter((item) => item.spaceId === data.activeSpaceId);
}

export function selectActiveLinks(data: EngramData): ItemLink[] {
  return data.links.filter((link) => link.spaceId === data.activeSpaceId);
}

export function selectActiveViewState(data: EngramData): CanvasViewState {
  return (
    data.viewStates.find((viewState) => viewState.spaceId === data.activeSpaceId) ??
    seedViewStates[0]
  );
}

export function recentItems(items: Item[]): Item[] {
  return [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, RECENT_ITEMS_LIMIT);
}

export function scheduledTasks(items: Item[]): Item[] {
  return items
    .filter((item) => item.type === "task")
    .sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"));
}

export function tasksByPriority(items: Item[]): Record<Priority, Item[]> {
  return {
    1: items.filter((item) => item.type === "task" && item.priority === 1),
    2: items.filter((item) => item.type === "task" && item.priority === 2),
    3: items.filter((item) => item.type === "task" && item.priority === 3),
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
  return items.filter((item) => item.focusPinned);
}

/** Tasks due today that have NOT been pinned to the focus panel. */
export function todayUnpinnedTasks(items: Item[]): Item[] {
  const prefix = todayPrefix();
  return items.filter(
    (item) => item.type === "task" && !item.done && item.dueAt?.startsWith(prefix) && !item.focusPinned,
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
    .filter((item) => item.type === "task" && item.dueAt?.startsWith(prefix))
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
      item.createdAt.startsWith(prefix) ||
      (item.dueAt?.startsWith(prefix)),
  );
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
