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
