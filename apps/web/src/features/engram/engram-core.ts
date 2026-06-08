import {
  CAPTURE_ANCHOR,
  FALLBACK_DROP,
  itemCenter,
  panToAnchor,
  screenToWorld,
  VIEWPORT_CENTER,
} from "./canvas-viewport";
import { ITEM_DIMENSIONS, TASK_ACCENT } from "./config";
import type { Accent, CanvasViewState, ChecklistItem, EngramData, Item, ItemType, Priority, Space } from "./types";

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
  tags?: string[];
  /** Override which space the item is created in (defaults to activeSpaceId). */
  spaceId?: string;
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

export function updateSpace(data: EngramData, spaceId: string, patch: UpdateSpaceInput): EngramData {
  const timestamp = now();
  return {
    ...data,
    spaces: data.spaces.map((s) =>
      s.id === spaceId
        ? { ...s, ...patch, updatedAt: timestamp }
        : s,
    ),
  };
}

export function deleteSpace(data: EngramData, spaceId: string): EngramData {
  const remaining = data.spaces.filter((s) => s.id !== spaceId);
  const remainingViewStates = data.viewStates.filter((vs) => vs.spaceId !== spaceId);
  const remainingItems = data.items.filter((i) => i.spaceId !== spaceId);
  const remainingLinks = data.links.filter(
    (l) => !remainingItems.some((i) => i.id === l.fromItemId) && !remainingItems.some((i) => i.id === l.toItemId)
      ? false
      : true,
  ).filter((l) =>
    remainingItems.some((i) => i.id === l.fromItemId) && remainingItems.some((i) => i.id === l.toItemId),
  );

  const activeSpaceId = data.activeSpaceId === spaceId
    ? (remaining[0]?.id ?? data.activeSpaceId)
    : data.activeSpaceId;

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

/** Build the Item a capture would create, positioned in the active viewport. */
export function buildItem(input: CreateItemInput, data: EngramData): Item {
  const timestamp = now();
  const targetSpaceId = input.spaceId ?? data.activeSpaceId;
  const viewState = data.viewStates.find((view) => view.spaceId === targetSpaceId);
  const drop = viewState ? screenToWorld(CAPTURE_ANCHOR, viewState) : FALLBACK_DROP;

  const dims = ITEM_DIMENSIONS[input.type];
  return {
    id: createId("item"),
    spaceId: targetSpaceId,
    type: input.type,
    x: input.x ?? drop.x,
    y: input.y ?? drop.y,
    width: dims.width,
    height: dims.height,
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
    tags: input.tags,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
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
    selectedItemId: data.selectedItemId && set.has(data.selectedItemId) ? undefined : data.selectedItemId,
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

export function moveItemToSpace(data: EngramData, itemId: string, targetSpaceId: string): EngramData {
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
    items: data.items.map((i) => i.id === itemId ? { ...i, spaceId: targetSpaceId, updatedAt: now() } : i),
    links: validLinks,
  };
}

/** Select an item, switch to its space/canvas, and center it in the viewport. */
export function centerItem(data: EngramData, id: string): EngramData {
  const item = data.items.find((candidate) => candidate.id === id);
  if (!item) {
    return data;
  }

  const timestamp = now();
  const viewStates = data.viewStates.map((viewState) =>
    viewState.spaceId === item.spaceId
      ? {
          ...viewState,
          ...panToAnchor(itemCenter(item), VIEWPORT_CENTER, viewState.zoom),
          updatedAt: timestamp,
        }
      : viewState,
  );

  return { ...data, activeSpaceId: item.spaceId, selectedItemId: id, viewStates };
}
