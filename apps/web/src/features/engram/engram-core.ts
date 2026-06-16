import { TASK_ACCENT } from "./config";
import type {
  Accent,
  CanvasViewState,
  ChecklistItem,
  DailyBriefing,
  EngramData,
  Item,
  ItemLink,
  ItemType,
  Priority,
  Space,
  TaskQueue,
} from "./types";

/**
 * The pure Engram domain core.
 *
 * Every mutation is a pure `EngramData -> EngramData` transform. Invariants
 * (no self/cross-space/duplicate links, task accent derivation, item sizing)
 * live here, decoupled from React state and persistence. The provider is the
 * thin shell that calls these and saves the result.
 */

export type CreateItemInput = {
  type: ItemType;
  text?: string;
  title?: string;
  x?: number;
  y?: number;
  priority?: Priority;
  dueAt?: string;
  url?: string;
  source?: string;
  caption?: string;
  focusPinned?: boolean;
  taskQueue?: TaskQueue;
  taskSortOrder?: number;
  tags?: string[];
  /** Override which space the item is created in (defaults to activeSpaceId). */
  spaceId?: string;
  /** Land in the Inbox instead of being placed on a canvas. */
  inbox?: boolean;
  /** Deferred with no due date on purpose. */
  someday?: boolean;
  stayOnCurrentView?: boolean;
};

export const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

const now = () => new Date().toISOString();

export type CreateSpaceInput = {
  name: string;
  icon: string;
  color: Accent;
};

export function addSpace(data: EngramData, input: CreateSpaceInput): EngramData {
  const timestamp = now();
  const id = createId("space");
  const sortOrder = data.spaces.length;
  const space: Space = {
    id,
    name: input.name.trim() || "Untitled",
    icon: input.icon,
    color: input.color,
    sortOrder,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const viewState: CanvasViewState = {
    id: createId("view"),
    spaceId: id,
    panX: 280,
    panY: 90,
    zoom: 1,
    gridVisible: true,
    updatedAt: timestamp,
  };
  return {
    ...data,
    spaces: [...data.spaces, space],
    viewStates: [...data.viewStates, viewState],
    activeSpaceId: id,
  };
}

export type UpdateSpaceInput = {
  name?: string;
  icon?: string;
  color?: Accent;
  sortOrder?: number;
};

export function updateSpace(
  data: EngramData,
  spaceId: string,
  patch: UpdateSpaceInput,
): EngramData {
  const timestamp = now();
  return {
    ...data,
    spaces: data.spaces.map((s) =>
      s.id === spaceId ? { ...s, ...patch, updatedAt: timestamp } : s,
    ),
  };
}

export function deleteSpace(data: EngramData, spaceId: string): EngramData {
  const remaining = data.spaces.filter((s) => s.id !== spaceId);
  const remainingViewStates = data.viewStates.filter((vs) => vs.spaceId !== spaceId);
  const remainingItems = data.items.filter((i) => i.spaceId !== spaceId);
  const remainingLinks = data.links
    .filter((l) =>
      !remainingItems.some((i) => i.id === l.fromItemId) &&
      !remainingItems.some((i) => i.id === l.toItemId)
        ? false
        : true,
    )
    .filter(
      (l) =>
        remainingItems.some((i) => i.id === l.fromItemId) &&
        remainingItems.some((i) => i.id === l.toItemId),
    );

  const activeSpaceId =
    data.activeSpaceId === spaceId ? (remaining[0]?.id ?? data.activeSpaceId) : data.activeSpaceId;

  return {
    ...data,
    spaces: remaining,
    viewStates: remainingViewStates,
    items: remainingItems,
    links: remainingLinks,
    activeSpaceId,
  };
}

function taskAccent(priority?: Priority): Accent {
  return priority ? TASK_ACCENT[priority] : "gold";
}

function nextTaskSortOrder(data: EngramData, queue: TaskQueue): number {
  const orders = data.items
    .filter((item) => item.type === "task" && (item.taskQueue ?? "next") === queue)
    .map((item) => item.taskSortOrder ?? 0);
  return orders.length ? Math.max(...orders) + 1 : 0;
}

/** Build the Item a capture would create. */
export function buildItem(input: CreateItemInput, data: EngramData): Item {
  const timestamp = now();
  const targetSpaceId = input.spaceId ?? data.activeSpaceId;
  const taskQueue = input.type === "task" ? (input.taskQueue ?? "later") : undefined;
  return {
    id: createId("item"),
    spaceId: targetSpaceId,
    type: input.type,
    title: input.title,
    text: input.text,
    url: input.url,
    source: input.source,
    caption: input.caption,
    accent: input.type === "task" ? taskAccent(input.priority) : "violet",
    done: false,
    priority: input.priority,
    dueAt: input.dueAt,
    focusPinned: input.focusPinned,
    taskQueue,
    taskSortOrder:
      input.type === "task" ? (input.taskSortOrder ?? nextTaskSortOrder(data, taskQueue ?? "later")) : undefined,
    tags: input.tags,
    inbox: input.inbox,
    someday: input.someday,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function setTaskQueue(
  data: EngramData,
  id: string,
  queue: TaskQueue,
  sortOrder?: number,
): EngramData {
  return patchItem(data, id, {
    taskQueue: queue,
    taskSortOrder: sortOrder ?? nextTaskSortOrder(data, queue),
  });
}

export function addItem(data: EngramData, item: Item): EngramData {
  return { ...data, items: [...data.items, item], selectedItemId: item.id };
}

export function patchItem(data: EngramData, id: string, patch: Partial<Item>): EngramData {
  return {
    ...data,
    items: data.items.map((item) =>
      item.id === id ? { ...item, ...patch, updatedAt: now() } : item,
    ),
  };
}

export function toggleItemDone(data: EngramData, id: string): EngramData {
  return {
    ...data,
    items: data.items.map((item) => {
      if (item.id !== id) return item;
      const done = !item.done;
      return {
        ...item,
        done,
        checklistItems: done
          ? item.checklistItems?.map((ci) => ({ ...ci, done: true }))
          : item.checklistItems,
        updatedAt: now(),
      };
    }),
  };
}

export function deleteItems(data: EngramData, ids: string[]): EngramData {
  const set = new Set(ids);
  return {
    ...data,
    items: data.items.filter((item) => !set.has(item.id)),
    links: data.links.filter((link) => !set.has(link.fromItemId) && !set.has(link.toItemId)),
    selectedItemId:
      data.selectedItemId && set.has(data.selectedItemId) ? undefined : data.selectedItemId,
  };
}

export function deleteItem(data: EngramData, id: string): EngramData {
  return {
    ...data,
    items: data.items.filter((item) => item.id !== id),
    links: data.links.filter((link) => link.fromItemId !== id && link.toItemId !== id),
    selectedItemId: data.selectedItemId === id ? undefined : data.selectedItemId,
  };
}

export function addChecklistItem(data: EngramData, itemId: string, text: string): EngramData {
  const ci: ChecklistItem = { id: createId("cl"), text, done: false };
  return {
    ...data,
    items: data.items.map((item) =>
      item.id === itemId
        ? { ...item, checklistItems: [...(item.checklistItems ?? []), ci], updatedAt: now() }
        : item,
    ),
  };
}

export function toggleChecklistItem(data: EngramData, itemId: string, ciId: string): EngramData {
  return {
    ...data,
    items: data.items.map((item) => {
      if (item.id !== itemId) return item;
      const checklistItems = item.checklistItems?.map((ci) =>
        ci.id === ciId ? { ...ci, done: !ci.done } : ci,
      );
      const hasChecklist = (checklistItems?.length ?? 0) > 0;
      const done = hasChecklist ? checklistItems!.every((ci) => ci.done) : item.done;
      return {
        ...item,
        done,
        checklistItems,
        updatedAt: now(),
      };
    }),
  };
}

export function removeChecklistItem(data: EngramData, itemId: string, ciId: string): EngramData {
  return {
    ...data,
    items: data.items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            checklistItems: item.checklistItems?.filter((ci) => ci.id !== ciId),
            updatedAt: now(),
          }
        : item,
    ),
  };
}

export function reorderChecklistItems(
  data: EngramData,
  itemId: string,
  checklistItems: ChecklistItem[],
): EngramData {
  return {
    ...data,
    items: data.items.map((item) =>
      item.id === itemId ? { ...item, checklistItems, updatedAt: now() } : item,
    ),
  };
}

/** Add a link, enforcing no self-links, no cross-space links, no duplicates. */
export function addLink(data: EngramData, fromItemId: string, toItemId: string): EngramData {
  if (fromItemId === toItemId) {
    return data;
  }

  const from = data.items.find((item) => item.id === fromItemId);
  const to = data.items.find((item) => item.id === toItemId);
  if (!from || !to || from.spaceId !== to.spaceId) {
    return data;
  }

  const exists = data.links.some(
    (link) =>
      link.spaceId === from.spaceId &&
      ((link.fromItemId === fromItemId && link.toItemId === toItemId) ||
        (link.fromItemId === toItemId && link.toItemId === fromItemId)),
  );
  if (exists) {
    return data;
  }

  return {
    ...data,
    links: [
      ...data.links,
      {
        id: createId("link"),
        spaceId: from.spaceId,
        fromItemId,
        toItemId,
        createdAt: now(),
      },
    ],
  };
}

export function removeLink(data: EngramData, id: string): EngramData {
  return { ...data, links: data.links.filter((link) => link.id !== id) };
}

export function patchViewState(
  data: EngramData,
  spaceId: string,
  patch: Partial<CanvasViewState>,
): EngramData {
  const timestamp = now();
  return {
    ...data,
    viewStates: data.viewStates.map((viewState) =>
      viewState.spaceId === spaceId ? { ...viewState, ...patch, updatedAt: timestamp } : viewState,
    ),
  };
}

export function setItemTags(data: EngramData, id: string, tags: string[]): EngramData {
  return patchItem(data, id, { tags });
}

export function addItemTag(data: EngramData, id: string, tag: string): EngramData {
  const item = data.items.find((i) => i.id === id);
  if (!item) return data;
  const tags = [...new Set([...(item.tags ?? []), tag])];
  return patchItem(data, id, { tags });
}

export function removeItemTag(data: EngramData, id: string, tag: string): EngramData {
  const item = data.items.find((i) => i.id === id);
  if (!item) return data;
  const tags = (item.tags ?? []).filter((t) => t !== tag);
  return patchItem(data, id, { tags });
}

export function moveItemToSpace(
  data: EngramData,
  itemId: string,
  targetSpaceId: string,
): EngramData {
  const item = data.items.find((i) => i.id === itemId);
  if (!item) return data;
  const validLinks = data.links.filter((l) => {
    if (l.fromItemId !== itemId && l.toItemId !== itemId) return true;
    const otherId = l.fromItemId === itemId ? l.toItemId : l.fromItemId;
    const other = data.items.find((i) => i.id === otherId);
    return other?.spaceId === targetSpaceId;
  });
  return {
    ...data,
    items: data.items.map((i) =>
      i.id === itemId ? { ...i, spaceId: targetSpaceId, updatedAt: now() } : i,
    ),
    links: validLinks,
  };
}

/**
 * File an Inbox item into a space: clear the inbox flag and assign it to the space.
 * Links to items in other spaces are dropped (links are space-scoped),
 * mirroring moveItemToSpace.
 */
export function fileItem(data: EngramData, itemId: string, targetSpaceId: string): EngramData {
  const item = data.items.find((i) => i.id === itemId);
  if (!item) return data;
  const validLinks = data.links.filter((l) => {
    if (l.fromItemId !== itemId && l.toItemId !== itemId) return true;
    const otherId = l.fromItemId === itemId ? l.toItemId : l.fromItemId;
    const other = data.items.find((i) => i.id === otherId);
    return other?.spaceId === targetSpaceId;
  });
  return {
    ...data,
    items: data.items.map((i) =>
      i.id === itemId ? { ...i, spaceId: targetSpaceId, inbox: false, updatedAt: now() } : i,
    ),
    links: validLinks,
  };
}

// ── Selection & navigation ──────────────────────────────────────────────────

/** Make a space active. */
export function setActiveSpace(data: EngramData, spaceId: string): EngramData {
  return { ...data, activeSpaceId: spaceId };
}

/** Select an item, switching to its space. No-op if the item is gone. */
export function selectItem(data: EngramData, id: string): EngramData {
  const item = data.items.find((i) => i.id === id);
  if (!item) return data;
  return { ...data, activeSpaceId: item.spaceId, selectedItemId: id };
}

/**
 * Restore previously deleted items and their links (undo). Items already present
 * are skipped; links are re-added only if they still satisfy the link invariants
 * against the restored item set (no self/cross-space/duplicate, both endpoints
 * present), so undo can never resurrect an invalid link.
 */
export function restoreItems(data: EngramData, items: Item[], links: ItemLink[]): EngramData {
  const presentIds = new Set(data.items.map((i) => i.id));
  const itemsToAdd = items.filter((i) => !presentIds.has(i.id));
  const nextItems = [...data.items, ...itemsToAdd];

  const itemById = new Map(nextItems.map((i) => [i.id, i]));
  const existingLinkIds = new Set(data.links.map((l) => l.id));
  const validLinks = links.filter((l) => {
    if (existingLinkIds.has(l.id)) return false;
    if (l.fromItemId === l.toItemId) return false;
    const from = itemById.get(l.fromItemId);
    const to = itemById.get(l.toItemId);
    if (!from || !to || from.spaceId !== to.spaceId) return false;
    return !data.links.some(
      (existing) =>
        existing.spaceId === from.spaceId &&
        ((existing.fromItemId === l.fromItemId && existing.toItemId === l.toItemId) ||
          (existing.fromItemId === l.toItemId && existing.toItemId === l.fromItemId)),
    );
  });

  return { ...data, items: nextItems, links: [...data.links, ...validLinks] };
}

// ── Daily briefing & note ───────────────────────────────────────────────────

/** Store the AI briefing for its date, replacing any existing one. */
export function saveDailyBriefing(data: EngramData, briefing: DailyBriefing): EngramData {
  return {
    ...data,
    dailyBriefings: { ...data.dailyBriefings, [briefing.date]: briefing },
  };
}

/** Create or update today's daily-note thought, keyed by its titled prefix. */
export function upsertDailyNote(data: EngramData, datePrefix: string, text: string): EngramData {
  const noteTitle = `Daily Note — ${datePrefix}`;
  const existing = data.items.find((item) => item.type === "thought" && item.title === noteTitle);
  if (existing) return patchItem(data, existing.id, { text });
  const item = buildItem(
    { type: "thought", title: noteTitle, text, stayOnCurrentView: true },
    data,
  );
  return addItem(data, item);
}
