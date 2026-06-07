"use client";

import { createContext, useCallback, useContext, useState } from "react";

type QuickCaptureMode = "thought" | "task" | "link" | "attach";

type UIStore = {
  quickCaptureExpanded: boolean;
  quickCaptureHighlight: number;
  quickCaptureMode?: QuickCaptureMode;
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
  expandQuickCapture: (mode?: QuickCaptureMode) => void;
  collapseQuickCapture: () => void;
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

  const expandQuickCapture = useCallback((mode?: QuickCaptureMode) => {
    setQuickCaptureMode(mode);
    setQuickCaptureExpanded(true);
    setQuickCaptureHighlight((n) => n + 1);
  }, []);
  const collapseQuickCapture = useCallback(() => setQuickCaptureExpanded(false), []);

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
        quickCaptureExpanded,
        quickCaptureHighlight,
        quickCaptureMode,
        expandQuickCapture,
        collapseQuickCapture,
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
