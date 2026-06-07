"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  addChecklistItem as coreAddChecklistItem,
  addItem,
  addLink,
  buildItem,
  centerItem,
  type CreateItemInput,
  deleteItem,
  deleteItems,
  patchItem,
  patchViewState,
  removeChecklistItem as coreRemoveChecklistItem,
  reorderChecklistItems as coreReorderChecklistItems,
  removeLink,
  toggleChecklistItem as coreToggleChecklistItem,
  toggleItemDone,
} from "./engram-core";
import { DEFAULT_SPACE_ID, PERSIST_DEBOUNCE_MS } from "./config";
import { createLocalStorageAdapter } from "./persistence";
import {
  focusPinnedItems as projectFocusPinnedItems,
  recentItems,
  scheduledTasks,
  searchItems as projectSearchItems,
  selectActiveItems,
  selectActiveLinks,
  selectActiveSpace,
  selectActiveViewState,
  tasksByPriority,
  todayItems as projectTodayItems,
  todayPrefix,
  todayTasks as projectTodayTasks,
  todayUnpinnedTasks as projectTodayUnpinnedTasks,
} from "./projections";
import { seedItems, seedLinks, seedSpaces, seedViewStates } from "./seed";
import { DeleteToast } from "./components/delete-toast";
import { TaskCompleteToast } from "./components/task-complete-toast";
import type {
  CanvasViewState,
  ChecklistItem,
  EngramData,
  Item,
  ItemLink,
  Priority,
  Space,
} from "./types";

type EngramStore = {
  // Raw data
  spaces: Space[];
  items: Item[];
  links: ItemLink[];
  viewStates: CanvasViewState[];
  activeSpaceId: string;
  selectedItemId?: string;
  // Derived / projected
  activeSpace?: Space;
  activeItems: Item[];
  activeLinks: ItemLink[];
  activeViewState: CanvasViewState;
  recentItems: Item[];
  scheduledTasks: Item[];
  tasksByPriority: Record<Priority, Item[]>;
  // Mutations
  setActiveSpace: (spaceId: string) => void;
  createItem: (input: CreateItemInput) => Item;
  updateItem: (id: string, patch: Partial<Item>) => void;
  moveItem: (id: string, x: number, y: number) => void;
  toggleDone: (id: string) => void;
  connectItems: (fromItemId: string, toItemId: string) => void;
  deleteLink: (id: string) => void;
  setViewState: (spaceId: string, patch: Partial<CanvasViewState>) => void;
  jumpToItem: (id: string) => void;
  searchItems: (query: string) => Item[];
  removeItem: (id: string) => void;
  removeItems: (ids: string[]) => void;
  undoDelete: () => void;
  addChecklistItem: (itemId: string, text: string) => void;
  toggleChecklistItem: (itemId: string, ciId: string) => void;
  removeChecklistItem: (itemId: string, ciId: string) => void;
  reorderChecklistItems: (itemId: string, checklistItems: ChecklistItem[]) => void;
  todayTasks: Item[];
  todayItems: Item[];
  focusPinnedItems: Item[];
  todayUnpinnedTasks: Item[];
  pinToFocus: (id: string) => void;
  unpinFromFocus: (id: string) => void;
  upsertDailyNote: (text: string) => void;
};

const EngramContext = createContext<EngramStore | null>(null);

const createInitialData = (): EngramData => ({
  spaces: seedSpaces,
  items: seedItems,
  links: seedLinks,
  viewStates: seedViewStates,
  activeSpaceId: DEFAULT_SPACE_ID,
  selectedItemId: undefined,
});

const persistence = createLocalStorageAdapter();

export function EngramProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [data, setData] = useState<EngramData>(createInitialData);
  const hydrated = useRef(false);
  const dataRef = useRef(data);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Hydrate from localStorage once on mount.
  useEffect(() => {
    const result = persistence.load();
    if (result.status === "ok") {
      setData(result.data);
    } else if (result.status === "corrupt") {
      toast.error("Engram loaded seed data because saved data was invalid.");
    }
    hydrated.current = true;
  }, []);

  // Debounced persist on every data change.
  useEffect(() => {
    if (!hydrated.current) return;
    const timeout = window.setTimeout(() => {
      try {
        persistence.save(data);
      } catch {
        toast.error("Engram could not save changes locally.");
      }
    }, PERSIST_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [data]);

  useEffect(() => {
    const saveNow = () => {
      if (!hydrated.current) return;
      try {
        persistence.save(dataRef.current);
      } catch {
        // Avoid surfacing unload-time storage errors; normal save path will toast.
      }
    };

    window.addEventListener("pagehide", saveNow);
    document.addEventListener("visibilitychange", saveNow);
    return () => {
      window.removeEventListener("pagehide", saveNow);
      document.removeEventListener("visibilitychange", saveNow);
    };
  }, []);

  const setActiveSpace = useCallback(
    (spaceId: string) => {
      setData((current) => ({ ...current, activeSpaceId: spaceId }));
      router.push("/canvas" as Route<string>);
    },
    [router],
  );

  const setViewState = useCallback((spaceId: string, patch: Partial<CanvasViewState>) => {
    setData((current) => patchViewState(current, spaceId, patch));
  }, []);

  const createItem = useCallback(
    (input: CreateItemInput) => {
      const item = buildItem(input, data);
      setData((current) => addItem(current, item));
      if (!input.stayOnCurrentView) {
        router.push("/canvas" as Route<string>);
      }
      return item;
    },
    [data, router],
  );

  const updateItem = useCallback((id: string, patch: Partial<Item>) => {
    setData((current) => patchItem(current, id, patch));
  }, []);

  const moveItem = useCallback(
    (id: string, x: number, y: number) => updateItem(id, { x, y }),
    [updateItem],
  );

  const toggleDone = useCallback((id: string) => {
    const before = data.items.find((item) => item.id === id);
    setData((current) => toggleItemDone(current, id));
    if (!before || before.type !== "task" || before.done) return;

    const label = before.title ?? "Task";
    let toastId: string | number | undefined;
    const keep = () => {
      if (toastId !== undefined) toast.dismiss(toastId);
    };
    const deleteCompleted = () => {
      if (toastId !== undefined) toast.dismiss(toastId);
      setData((current) => deleteItem(current, id));
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "d") {
        event.preventDefault();
        window.removeEventListener("keydown", onKey);
        deleteCompleted();
      }
      if (event.key === "Escape") {
        window.removeEventListener("keydown", onKey);
        keep();
      }
    };

    toastId = toast.custom(
      () => React.createElement(TaskCompleteToast, { label, onDelete: deleteCompleted, onKeep: keep }),
      {
        duration: 7000,
        onDismiss: () => window.removeEventListener("keydown", onKey),
        onAutoClose: () => window.removeEventListener("keydown", onKey),
      },
    );
    window.addEventListener("keydown", onKey);
  }, [data.items]);

  const connectItems = useCallback((fromItemId: string, toItemId: string) => {
    setData((current) => addLink(current, fromItemId, toItemId));
  }, []);

  const deleteLink = useCallback((id: string) => {
    setData((current) => removeLink(current, id));
  }, []);

  const jumpToItem = useCallback(
    (id: string) => {
      setData((current) => centerItem(current, id));
      router.push("/canvas" as Route<string>);
    },
    [router],
  );

  const lastDeletedRef = useRef<{ items: Item[]; links: ItemLink[] } | null>(null);
  const undoToastIdRef = useRef<string | number | null>(null);
  const undoClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const undoDelete = useCallback(() => {
    if (!lastDeletedRef.current) return;
    const { items, links } = lastDeletedRef.current;
    lastDeletedRef.current = null;
    if (undoClearRef.current) clearTimeout(undoClearRef.current);
    if (undoToastIdRef.current !== null) toast.dismiss(undoToastIdRef.current);
    setData((current) => ({
      ...current,
      items: [...current.items, ...items],
      links: [...current.links, ...links],
    }));
  }, []);

  const removeItem = useCallback(
    (id: string) => {
      const item = data.items.find((i) => i.id === id);
      const links = data.links.filter((l) => l.fromItemId === id || l.toItemId === id);
      if (item) lastDeletedRef.current = { items: [item], links };

      setData((current) => deleteItem(current, id));

      if (undoClearRef.current) clearTimeout(undoClearRef.current);
      undoClearRef.current = setTimeout(() => { lastDeletedRef.current = null; }, 5000);

      const label = item?.title ?? item?.text ?? item?.url ?? "item";
      if (undoToastIdRef.current !== null) toast.dismiss(undoToastIdRef.current);
      undoToastIdRef.current = toast.custom(
        () => React.createElement(DeleteToast, { label, onUndo: undoDelete }),
        { duration: 5000 },
      );
    },
    [data.items, data.links, undoDelete],
  );

  const removeItems = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      if (ids.length === 1) { removeItem(ids[0]); return; }

      const items = data.items.filter((i) => ids.includes(i.id));
      const links = data.links.filter((l) => ids.includes(l.fromItemId) || ids.includes(l.toItemId));
      lastDeletedRef.current = { items, links };

      setData((current) => deleteItems(current, ids));

      if (undoClearRef.current) clearTimeout(undoClearRef.current);
      undoClearRef.current = setTimeout(() => { lastDeletedRef.current = null; }, 5000);

      const label = `${items.length} items`;
      if (undoToastIdRef.current !== null) toast.dismiss(undoToastIdRef.current);
      undoToastIdRef.current = toast.custom(
        () => React.createElement(DeleteToast, { label, onUndo: undoDelete }),
        { duration: 5000 },
      );
    },
    [data.items, data.links, removeItem, undoDelete],
  );

  const addChecklistItemFn = useCallback((itemId: string, text: string) => {
    setData((current) => coreAddChecklistItem(current, itemId, text));
  }, []);

  const toggleChecklistItemFn = useCallback((itemId: string, ciId: string) => {
    const before = data.items.find((item) => item.id === itemId);
    const wasComplete =
      before?.type === "task" &&
      before.done &&
      (before.checklistItems?.length ?? 0) > 0 &&
      before.checklistItems!.every((ci) => ci.done);
    setData((current) => coreToggleChecklistItem(current, itemId, ciId));
    if (!before || before.type !== "task" || wasComplete) return;
    const toggled = before.checklistItems?.map((ci) =>
      ci.id === ciId ? { ...ci, done: !ci.done } : ci,
    );
    if (!toggled?.length || !toggled.every((ci) => ci.done)) return;

    const label = before.title ?? "Task";
    let toastId: string | number | undefined;
    const keep = () => {
      if (toastId !== undefined) toast.dismiss(toastId);
    };
    const deleteCompleted = () => {
      if (toastId !== undefined) toast.dismiss(toastId);
      setData((current) => deleteItem(current, itemId));
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "d") {
        event.preventDefault();
        window.removeEventListener("keydown", onKey);
        deleteCompleted();
      }
      if (event.key === "Escape") {
        window.removeEventListener("keydown", onKey);
        keep();
      }
    };

    toastId = toast.custom(
      () => React.createElement(TaskCompleteToast, { label, onDelete: deleteCompleted, onKeep: keep }),
      {
        duration: 7000,
        onDismiss: () => window.removeEventListener("keydown", onKey),
        onAutoClose: () => window.removeEventListener("keydown", onKey),
      },
    );
    window.addEventListener("keydown", onKey);
  }, [data.items]);

  const removeChecklistItemFn = useCallback((itemId: string, ciId: string) => {
    setData((current) => coreRemoveChecklistItem(current, itemId, ciId));
  }, []);

  const reorderChecklistItemsFn = useCallback((itemId: string, checklistItems: ChecklistItem[]) => {
    setData((current) => coreReorderChecklistItems(current, itemId, checklistItems));
  }, []);

  const upsertDailyNote = useCallback((text: string) => {
    const prefix = todayPrefix();
    const noteTitle = `Daily Note — ${prefix}`;
    const existing = data.items.find(
      (item) => item.type === "thought" && item.title === noteTitle,
    );
    if (existing) {
      setData((current) => patchItem(current, existing.id, { text }));
    } else {
      const item = buildItem(
        { type: "thought", title: noteTitle, text, stayOnCurrentView: true },
        data,
      );
      setData((current) => addItem(current, item));
    }
  }, [data]);

  // Projections — derived from data, recomputed only when data changes.
  const activeSpace = useMemo(() => selectActiveSpace(data), [data]);
  const activeItems = useMemo(() => selectActiveItems(data), [data]);
  const activeLinks = useMemo(() => selectActiveLinks(data), [data]);
  const activeViewState = useMemo(() => selectActiveViewState(data), [data]);
  const recent = useMemo(() => recentItems(data.items), [data.items]);
  const scheduled = useMemo(() => scheduledTasks(data.items), [data.items]);
  const byPriority = useMemo(() => tasksByPriority(data.items), [data.items]);
  const todayTasksList = useMemo(() => projectTodayTasks(data.items), [data.items]);
  const todayItemsList = useMemo(() => projectTodayItems(data.items), [data.items]);
  const focusPinnedList = useMemo(() => projectFocusPinnedItems(data.items), [data.items]);
  const todayUnpinnedList = useMemo(() => projectTodayUnpinnedTasks(data.items), [data.items]);

  const pinToFocus = useCallback((id: string) => {
    setData((current) => patchItem(current, id, { focusPinned: true }));
  }, []);

  const unpinFromFocus = useCallback((id: string) => {
    setData((current) => patchItem(current, id, { focusPinned: false }));
  }, []);

  const searchItems = useCallback(
    (query: string) => projectSearchItems(data.items, query, recent),
    [data.items, recent],
  );

  const value = useMemo<EngramStore>(
    () => ({
      ...data,
      activeSpace,
      activeItems,
      activeLinks,
      activeViewState,
      recentItems: recent,
      scheduledTasks: scheduled,
      tasksByPriority: byPriority,
      todayTasks: todayTasksList,
      todayItems: todayItemsList,
      focusPinnedItems: focusPinnedList,
      todayUnpinnedTasks: todayUnpinnedList,
      pinToFocus,
      unpinFromFocus,
      setActiveSpace,
      createItem,
      updateItem,
      moveItem,
      toggleDone,
      connectItems,
      deleteLink,
      setViewState,
      jumpToItem,
      searchItems,
      removeItem,
      removeItems,
      undoDelete,
      addChecklistItem: addChecklistItemFn,
      toggleChecklistItem: toggleChecklistItemFn,
      removeChecklistItem: removeChecklistItemFn,
      reorderChecklistItems: reorderChecklistItemsFn,
      upsertDailyNote,
    }),
    [
      data,
      activeSpace,
      activeItems,
      activeLinks,
      activeViewState,
      recent,
      scheduled,
      byPriority,
      todayTasksList,
      todayItemsList,
      focusPinnedList,
      todayUnpinnedList,
      pinToFocus,
      unpinFromFocus,
      setActiveSpace,
      createItem,
      updateItem,
      moveItem,
      toggleDone,
      connectItems,
      deleteLink,
      setViewState,
      jumpToItem,
      searchItems,
      removeItem,
      removeItems,
      undoDelete,
      addChecklistItemFn,
      toggleChecklistItemFn,
      removeChecklistItemFn,
      reorderChecklistItemsFn,
      upsertDailyNote,
      pinToFocus,
      unpinFromFocus,
    ],
  );

  return <EngramContext.Provider value={value}>{children}</EngramContext.Provider>;
}

export function useEngramStore() {
  const context = useContext(EngramContext);
  if (!context) throw new Error("useEngramStore must be used inside EngramProvider");
  return context;
}
