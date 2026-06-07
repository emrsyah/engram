export type EngramView = "canvas" | "timeline" | "priorities";
export type ItemType = "thought" | "task" | "image" | "link" | "file";
export type Priority = 1 | 2 | 3;
export type Accent = "violet" | "gold" | "teal" | "red" | "blue";

export type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

export type Space = {
  id: string;
  name: string;
  icon: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type Item = {
  id: string;
  spaceId: string;
  type: ItemType;
  x: number;
  y: number;
  width: number;
  height: number;
  title?: string;
  text?: string;
  url?: string;
  source?: string;
  caption?: string;
  accent: Accent;
  done: boolean;
  priority?: Priority;
  dueAt?: string;
  checklistItems?: ChecklistItem[];
  focusPinned?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ItemLink = {
  id: string;
  spaceId: string;
  fromItemId: string;
  toItemId: string;
  createdAt: string;
};

export type CanvasViewState = {
  id: string;
  spaceId: string;
  panX: number;
  panY: number;
  zoom: number;
  gridVisible: boolean;
  updatedAt: string;
};

export type EngramData = {
  spaces: Space[];
  items: Item[];
  links: ItemLink[];
  viewStates: CanvasViewState[];
  activeSpaceId: string;
  selectedItemId?: string;
};
