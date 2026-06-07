import type { ItemType, Priority, Accent } from "./types";

/** Dimensions for each item type when first created. */
export const ITEM_DIMENSIONS: Record<ItemType, { width: number; height: number }> = {
  thought: { width: 280, height: 126 },
  task: { width: 280, height: 112 },
  link: { width: 280, height: 180 },
  image: { width: 260, height: 280 },
  file: { width: 280, height: 126 },
};

/** Accent color for a task based on its priority. */
export const TASK_ACCENT: Record<Priority, Accent> = {
  1: "red",
  2: "gold",
  3: "blue",
};

/** Max items returned by a search query. */
export const SEARCH_RESULT_LIMIT = 8;

/** Max items shown in the Recent sidebar section. */
export const RECENT_ITEMS_LIMIT = 5;

/** Debounce delay (ms) before persisting state changes. */
export const PERSIST_DEBOUNCE_MS = 120;

/** Default space to activate on first load. */
export const DEFAULT_SPACE_ID = "space-mind";

/** The always-present Today's Focus space ID. */
export const TODAY_FOCUS_SPACE_ID = "space-today-focus";
