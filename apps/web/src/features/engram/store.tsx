"use client";

import { toast } from "sonner";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { seedItems, seedLinks, seedSpaces, seedViewStates } from "./seed";
import type {
  CanvasViewState,
  EngramData,
  EngramView,
  Item,
  ItemLink,
  ItemType,
  Priority,
  Space,
} from "./types";

const STORAGE_KEY = "engram.prototype.v1";
const STORAGE_BACKUP_KEY = "engram.prototype.v1.backup";

type CreateItemInput = {
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
};

type PersistedEngramData = EngramData;

type EngramStore = PersistedEngramData & {
  captureOpen: boolean;
  searchOpen: boolean;
  linkSourceId?: string;
  activeSpace?: Space;
  activeItems: Item[];
  activeLinks: ItemLink[];
  activeViewState: CanvasViewState;
  recentItems: Item[];
  scheduledTasks: Item[];
  tasksByPriority: Record<Priority, Item[]>;
  setActiveView: (view: EngramView) => void;
  setActiveSpace: (spaceId: string) => void;
  createItem: (input: CreateItemInput) => Item;
  updateItem: (id: string, patch: Partial<Item>) => void;
  moveItem: (id: string, x: number, y: number) => void;
  toggleDone: (id: string) => void;
  connectItems: (fromItemId: string, toItemId: string) => void;
  deleteLink: (id: string) => void;
  setViewState: (spaceId: string, patch: Partial<CanvasViewState>) => void;
  jumpToItem: (id: string) => void;
  openCapture: () => void;
  closeCapture: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  setLinkSource: (id?: string) => void;
  searchItems: (query: string) => Item[];
};

const EngramContext = createContext<EngramStore | null>(null);

const createInitialData = (): PersistedEngramData => ({
  spaces: seedSpaces,
  items: seedItems,
  links: seedLinks,
  viewStates: seedViewStates,
  activeSpaceId: "space-mind",
  activeView: "canvas",
  selectedItemId: undefined,
});

const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
};

export function EngramProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<PersistedEngramData>(createInitialData);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [linkSourceId, setLinkSourceId] = useState<string>();
  const hydrated = useRef(false);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      hydrated.current = true;
      return;
    }

    try {
      const parsed = JSON.parse(raw) as PersistedEngramData;
      if (!Array.isArray(parsed.items) || !Array.isArray(parsed.spaces)) {
        throw new Error("Invalid Engram payload");
      }
      setData(parsed);
    } catch {
      localStorage.setItem(STORAGE_BACKUP_KEY, raw);
      toast.error("Engram loaded seed data because saved data was invalid.");
    } finally {
      hydrated.current = true;
    }
  }, []);

  useEffect(() => {
    if (!hydrated.current) {
      return;
    }

    const timeout = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        toast.error("Engram could not save changes locally.");
      }
    }, 120);

    return () => window.clearTimeout(timeout);
  }, [data]);

  const setActiveView = useCallback((view: EngramView) => {
    setData((current) => ({ ...current, activeView: view }));
  }, []);

  const setActiveSpace = useCallback((spaceId: string) => {
    setData((current) => ({ ...current, activeSpaceId: spaceId, activeView: "canvas" }));
  }, []);

  const setViewState = useCallback((spaceId: string, patch: Partial<CanvasViewState>) => {
    setData((current) => {
      const timestamp = new Date().toISOString();
      return {
        ...current,
        viewStates: current.viewStates.map((viewState) =>
          viewState.spaceId === spaceId ? { ...viewState, ...patch, updatedAt: timestamp } : viewState,
        ),
      };
    });
  }, []);

  const createItem = useCallback(
    (input: CreateItemInput) => {
      const timestamp = new Date().toISOString();
      const viewState = data.viewStates.find((view) => view.spaceId === data.activeSpaceId);
      const item: Item = {
        id: createId("item"),
        spaceId: data.activeSpaceId,
        type: input.type,
        x: input.x ?? (viewState ? (520 - viewState.panX) / viewState.zoom : 260),
        y: input.y ?? (viewState ? (260 - viewState.panY) / viewState.zoom : 220),
        width: input.type === "image" ? 260 : 280,
        height: input.type === "image" ? 280 : input.type === "task" ? 112 : 126,
        title: input.title,
        text: input.text,
        url: input.url,
        source: input.source,
        caption: input.caption,
        accent: input.type === "task" ? (input.priority === 1 ? "red" : input.priority === 3 ? "blue" : "gold") : "violet",
        done: false,
        priority: input.priority,
        dueAt: input.dueAt,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      setData((current) => ({
        ...current,
        items: [...current.items, item],
        selectedItemId: item.id,
        activeView: "canvas",
      }));
      return item;
    },
    [data.activeSpaceId, data.viewStates],
  );

  const updateItem = useCallback((id: string, patch: Partial<Item>) => {
    setData((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item,
      ),
    }));
  }, []);

  const moveItem = useCallback(
    (id: string, x: number, y: number) => updateItem(id, { x, y }),
    [updateItem],
  );

  const toggleDone = useCallback((id: string) => {
    setData((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id ? { ...item, done: !item.done, updatedAt: new Date().toISOString() } : item,
      ),
    }));
  }, []);

  const connectItems = useCallback((fromItemId: string, toItemId: string) => {
    if (fromItemId === toItemId) {
      setLinkSourceId(undefined);
      return;
    }

    setData((current) => {
      const from = current.items.find((item) => item.id === fromItemId);
      const to = current.items.find((item) => item.id === toItemId);
      if (!from || !to || from.spaceId !== to.spaceId) {
        return current;
      }

      const exists = current.links.some(
        (link) =>
          link.spaceId === from.spaceId &&
          ((link.fromItemId === fromItemId && link.toItemId === toItemId) ||
            (link.fromItemId === toItemId && link.toItemId === fromItemId)),
      );

      if (exists) {
        return current;
      }

      return {
        ...current,
        links: [
          ...current.links,
          {
            id: createId("link"),
            spaceId: from.spaceId,
            fromItemId,
            toItemId,
            createdAt: new Date().toISOString(),
          },
        ],
      };
    });
    setLinkSourceId(undefined);
  }, []);

  const deleteLink = useCallback((id: string) => {
    setData((current) => ({ ...current, links: current.links.filter((link) => link.id !== id) }));
  }, []);

  const jumpToItem = useCallback((id: string) => {
    setData((current) => {
      const item = current.items.find((candidate) => candidate.id === id);
      if (!item) {
        return current;
      }

      const viewStates = current.viewStates.map((viewState) =>
        viewState.spaceId === item.spaceId
          ? {
              ...viewState,
              panX: 760 - (item.x + item.width / 2) * viewState.zoom,
              panY: 420 - (item.y + item.height / 2) * viewState.zoom,
              updatedAt: new Date().toISOString(),
            }
          : viewState,
      );

      return {
        ...current,
        activeSpaceId: item.spaceId,
        activeView: "canvas",
        selectedItemId: id,
        viewStates,
      };
    });
    setSearchOpen(false);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.key === "Escape") {
        setLinkSourceId(undefined);
      }

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setCaptureOpen(true);
      }

      if (event.key === "/" || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k")) {
        event.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const activeSpace = data.spaces.find((space) => space.id === data.activeSpaceId);
  const activeItems = data.items.filter((item) => item.spaceId === data.activeSpaceId);
  const activeLinks = data.links.filter((link) => link.spaceId === data.activeSpaceId);
  const activeViewState =
    data.viewStates.find((viewState) => viewState.spaceId === data.activeSpaceId) ?? seedViewStates[0];
  const recentItems = [...data.items]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);
  const scheduledTasks = data.items
    .filter((item) => item.type === "task")
    .sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"));
  const tasksByPriority = {
    1: data.items.filter((item) => item.type === "task" && item.priority === 1),
    2: data.items.filter((item) => item.type === "task" && item.priority === 2),
    3: data.items.filter((item) => item.type === "task" && item.priority === 3),
  };

  const searchItems = useCallback(
    (query: string) => {
      const normalized = query.trim().toLowerCase();
      if (!normalized) {
        return recentItems;
      }

      return data.items
        .filter((item) =>
          [item.title, item.text, item.url, item.caption, item.source]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(normalized),
        )
        .slice(0, 8);
    },
    [data.items, recentItems],
  );

  const value = useMemo<EngramStore>(
    () => ({
      ...data,
      captureOpen,
      searchOpen,
      linkSourceId,
      activeSpace,
      activeItems,
      activeLinks,
      activeViewState,
      recentItems,
      scheduledTasks,
      tasksByPriority,
      setActiveView,
      setActiveSpace,
      createItem,
      updateItem,
      moveItem,
      toggleDone,
      connectItems,
      deleteLink,
      setViewState,
      jumpToItem,
      openCapture: () => setCaptureOpen(true),
      closeCapture: () => setCaptureOpen(false),
      openSearch: () => setSearchOpen(true),
      closeSearch: () => setSearchOpen(false),
      setLinkSource: setLinkSourceId,
      searchItems,
    }),
    [
      data,
      captureOpen,
      searchOpen,
      linkSourceId,
      activeSpace,
      activeItems,
      activeLinks,
      activeViewState,
      recentItems,
      scheduledTasks,
      tasksByPriority,
      setActiveView,
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
    ],
  );

  return <EngramContext.Provider value={value}>{children}</EngramContext.Provider>;
}

export function useEngramStore() {
  const context = useContext(EngramContext);
  if (!context) {
    throw new Error("useEngramStore must be used inside EngramProvider");
  }
  return context;
}
