"use client";

import { createContext, useCallback, useContext, useState } from "react";

type QuickCaptureMode = "thought" | "task" | "link" | "attach";
type QuickCaptureIntent = "focus-task";

type UIStore = {
  timerOpen: boolean;
  scratchpadOpen: boolean;
  focusTasksOpen: boolean;
  newSpaceDialogOpen: boolean;
  editingSpaceId?: string;
  deletingSpaceId?: string;
  toggleTimer: () => void;
  toggleScratchpad: () => void;
  toggleFocusTasks: () => void;
  openNewSpaceDialog: () => void;
  closeNewSpaceDialog: () => void;
  openEditSpaceDialog: (spaceId: string) => void;
  closeEditSpaceDialog: () => void;
  openDeleteSpaceDialog: (spaceId: string) => void;
  closeDeleteSpaceDialog: () => void;
  quickCaptureExpanded: boolean;
  quickCaptureHighlight: number;
  quickCaptureMode?: QuickCaptureMode;
  quickCaptureIntent?: QuickCaptureIntent;
  searchOpen: boolean;
  shortcutsOpen: boolean;
  sidebarCollapsed: boolean;
  linkSourceId?: string;
  detailItemId?: string;
  noteEditorItemId?: string;
  canvasSelectedId?: string;
  canvasSelectedIds: string[];
  minimapVisible: boolean;
  toggleMinimap: () => void;
  expandQuickCapture: (mode?: QuickCaptureMode, intent?: QuickCaptureIntent) => void;
  collapseQuickCapture: () => void;
  consumeQuickCaptureIntent: () => QuickCaptureIntent | undefined;
  openSearch: () => void;
  closeSearch: () => void;
  openShortcuts: () => void;
  closeShortcuts: () => void;
  toggleSidebar: () => void;
  setLinkSource: (id?: string) => void;
  openDetail: (id: string) => void;
  closeDetail: () => void;
  openNoteEditor: (id: string) => void;
  closeNoteEditor: () => void;
  setCanvasSelectedId: (id?: string) => void;
  setCanvasSelectedIds: (ids: string[]) => void;
};

const UIContext = createContext<UIStore | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [quickCaptureExpanded, setQuickCaptureExpanded] = useState(false);
  const [quickCaptureHighlight, setQuickCaptureHighlight] = useState(0);
  const [quickCaptureMode, setQuickCaptureMode] = useState<QuickCaptureMode>();
  const [quickCaptureIntent, setQuickCaptureIntent] = useState<QuickCaptureIntent>();
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [linkSourceId, setLinkSourceId] = useState<string>();
  const [detailItemId, setDetailItemId] = useState<string>();
  const [noteEditorItemId, setNoteEditorItemId] = useState<string>();
  const [canvasSelectedIds, setCanvasSelectedIds] = useState<string[]>([]);
  const canvasSelectedId = canvasSelectedIds[0];
  const setCanvasSelectedId = useCallback((id?: string) => setCanvasSelectedIds(id ? [id] : []), []);
  const [minimapVisible, setMinimapVisible] = useState(true);
  const toggleMinimap = useCallback(() => setMinimapVisible((v) => !v), []);
  const [timerOpen, setTimerOpen] = useState(false);
  const [scratchpadOpen, setScratchpadOpen] = useState(false);
  const [focusTasksOpen, setFocusTasksOpen] = useState(false);
  const [newSpaceDialogOpen, setNewSpaceDialogOpen] = useState(false);
  const [editingSpaceId, setEditingSpaceId] = useState<string>();
  const [deletingSpaceId, setDeletingSpaceId] = useState<string>();
  const toggleTimer = useCallback(() => setTimerOpen((v) => !v), []);
  const toggleScratchpad = useCallback(() => setScratchpadOpen((v) => !v), []);
  const toggleFocusTasks = useCallback(() => setFocusTasksOpen((v) => !v), []);
  const openNewSpaceDialog = useCallback(() => setNewSpaceDialogOpen(true), []);
  const closeNewSpaceDialog = useCallback(() => setNewSpaceDialogOpen(false), []);
  const openEditSpaceDialog = useCallback((id: string) => setEditingSpaceId(id), []);
  const closeEditSpaceDialog = useCallback(() => setEditingSpaceId(undefined), []);
  const openDeleteSpaceDialog = useCallback((id: string) => setDeletingSpaceId(id), []);
  const closeDeleteSpaceDialog = useCallback(() => setDeletingSpaceId(undefined), []);

  const expandQuickCapture = useCallback((mode?: QuickCaptureMode, intent?: QuickCaptureIntent) => {
    setQuickCaptureMode(mode);
    setQuickCaptureIntent(intent);
    setQuickCaptureExpanded(true);
    setQuickCaptureHighlight((n) => n + 1);
  }, []);
  const collapseQuickCapture = useCallback(() => setQuickCaptureExpanded(false), []);
  const consumeQuickCaptureIntent = useCallback(() => {
    let intent: QuickCaptureIntent | undefined;
    setQuickCaptureIntent((current) => {
      intent = current;
      return undefined;
    });
    return intent;
  }, []);

  const openSearch     = useCallback(() => setSearchOpen(true), []);
  const closeSearch    = useCallback(() => setSearchOpen(false), []);
  const openShortcuts  = useCallback(() => setShortcutsOpen(true), []);
  const closeShortcuts = useCallback(() => setShortcutsOpen(false), []);
  const toggleSidebar  = useCallback(() => setSidebarCollapsed((v) => !v), []);
  const setLinkSource  = useCallback((id?: string) => setLinkSourceId(id), []);
  const openDetail     = useCallback((id: string) => setDetailItemId(id), []);
  const closeDetail    = useCallback(() => setDetailItemId(undefined), []);
  const openNoteEditor  = useCallback((id: string) => {
    setDetailItemId(undefined);
    setNoteEditorItemId(id);
  }, []);
  const closeNoteEditor = useCallback(() => setNoteEditorItemId(undefined), []);

  return (
    <UIContext.Provider
      value={{
        timerOpen,
        scratchpadOpen,
        focusTasksOpen,
        newSpaceDialogOpen,
        editingSpaceId,
        deletingSpaceId,
        toggleTimer,
        toggleScratchpad,
        toggleFocusTasks,
        openNewSpaceDialog,
        closeNewSpaceDialog,
        openEditSpaceDialog,
        closeEditSpaceDialog,
        openDeleteSpaceDialog,
        closeDeleteSpaceDialog,
        quickCaptureExpanded,
        quickCaptureHighlight,
        quickCaptureMode,
        quickCaptureIntent,
        expandQuickCapture,
        collapseQuickCapture,
        consumeQuickCaptureIntent,
        searchOpen,
        shortcutsOpen,
        sidebarCollapsed,
        linkSourceId,
        detailItemId,
        noteEditorItemId,
        openNoteEditor,
        closeNoteEditor,
        canvasSelectedId,
        canvasSelectedIds,
        setCanvasSelectedId,
        setCanvasSelectedIds,
        minimapVisible,
        toggleMinimap,
        openSearch,
        closeSearch,
        openShortcuts,
        closeShortcuts,
        toggleSidebar,
        setLinkSource,
        openDetail,
        closeDetail,
      }}
    >
      {children}
    </UIContext.Provider>
  );
}

export function useUIStore() {
  const context = useContext(UIContext);
  if (!context) throw new Error("useUIStore must be used inside UIProvider");
  return context;
}
