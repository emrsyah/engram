"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { usePersistentState } from "./use-persistent-state";

type QuickCaptureMode = "thought" | "task" | "link" | "attach";
type QuickCaptureIntent = "focus-task";

export type BlitzPhase = "work" | "break";

/** User-customizable Blitz settings, persisted across sessions. */
export type BlitzPrefs = {
  workMinutes: number;
  breakMinutes: number;
  breakEnabled: boolean;
  autoStartNext: boolean;
  chime: boolean;
};

const BLITZ_PREFS_KEY = "engram.blitz.prefs.v1";
export const DEFAULT_BLITZ_PREFS: BlitzPrefs = {
  workMinutes: 45,
  breakMinutes: 5,
  breakEnabled: true,
  autoStartNext: false,
  chime: true,
};

/** Short two-tone chime via the Web Audio API — no asset needed. */
function playBlitzChime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    for (const [i, freq] of [660, 880].entries()) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
      osc.start(start);
      osc.stop(start + 0.34);
    }
    setTimeout(() => ctx.close(), 800);
  } catch {
    // audio unavailable — silently skip
  }
}

type UIStore = {
  timerOpen: boolean;
  scratchpadOpen: boolean;
  focusTasksOpen: boolean;
  // Blitz focus mode — lives here (above the page) so the timer keeps running
  // while navigating between views.
  blitzOpen: boolean;
  blitzExpanded: boolean;
  blitzRunning: boolean;
  blitzSecondsLeft: number;
  blitzActiveIndex: number;
  blitzPhase: BlitzPhase;
  blitzPhaseDuration: number;
  blitzPrefs: BlitzPrefs;
  openBlitz: () => void;
  closeBlitz: () => void;
  minimizeBlitz: () => void;
  expandBlitz: () => void;
  toggleBlitzRunning: () => void;
  resetBlitz: () => void;
  advanceBlitz: () => void;
  skipBlitzPhase: () => void;
  setBlitzWorkMinutes: (minutes: number) => void;
  setBlitzBreakMinutes: (minutes: number) => void;
  setBlitzPrefs: (patch: Partial<BlitzPrefs>) => void;
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
  mobileNavOpen: boolean;
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
  openMobileNav: () => void;
  closeMobileNav: () => void;
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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

  const [blitzPrefs, setBlitzPrefsState] = usePersistentState<BlitzPrefs>(
    BLITZ_PREFS_KEY,
    DEFAULT_BLITZ_PREFS,
  );
  const [blitzOpen, setBlitzOpen] = useState(false);
  const [blitzExpanded, setBlitzExpanded] = useState(false);
  const [blitzRunning, setBlitzRunning] = useState(false);
  const [blitzPhase, setBlitzPhase] = useState<BlitzPhase>("work");
  const [blitzPhaseDuration, setBlitzPhaseDuration] = useState(DEFAULT_BLITZ_PREFS.workMinutes * 60);
  const [blitzSecondsLeft, setBlitzSecondsLeft] = useState(DEFAULT_BLITZ_PREFS.workMinutes * 60);
  const [blitzActiveIndex, setBlitzActiveIndex] = useState(0);

  // Begin a phase: set its length, reset the clock, and optionally auto-run.
  const startSegment = useCallback((phase: BlitzPhase, seconds: number, run: boolean) => {
    setBlitzPhase(phase);
    setBlitzPhaseDuration(seconds);
    setBlitzSecondsLeft(seconds);
    setBlitzRunning(run);
  }, []);

  const openBlitz = useCallback(() => {
    setBlitzActiveIndex(0);
    startSegment("work", blitzPrefs.workMinutes * 60, false);
    setBlitzExpanded(true);
    setBlitzOpen(true);
  }, [blitzPrefs.workMinutes, startSegment]);
  // Full exit: stop the timer and tear down the session.
  const closeBlitz = useCallback(() => {
    setBlitzOpen(false);
    setBlitzExpanded(false);
    setBlitzRunning(false);
  }, []);
  // Collapse the fullscreen view to the running banner (timer keeps going).
  const minimizeBlitz = useCallback(() => setBlitzExpanded(false), []);
  const expandBlitz = useCallback(() => setBlitzExpanded(true), []);
  const toggleBlitzRunning = useCallback(() => {
    setBlitzRunning((running) => {
      // Pressing play on a finished segment restarts it from the top.
      if (!running && blitzSecondsLeft === 0) setBlitzSecondsLeft(blitzPhaseDuration);
      return !running;
    });
  }, [blitzSecondsLeft, blitzPhaseDuration]);
  const resetBlitz = useCallback(() => {
    setBlitzSecondsLeft(blitzPhaseDuration);
    setBlitzRunning(false);
  }, [blitzPhaseDuration]);
  const advanceBlitz = useCallback(() => {
    setBlitzActiveIndex((i) => i + 1);
    startSegment("work", blitzPrefs.workMinutes * 60, blitzPrefs.autoStartNext);
  }, [blitzPrefs.workMinutes, blitzPrefs.autoStartNext, startSegment]);
  const skipBlitzPhase = useCallback(() => {
    const next: BlitzPhase = blitzPhase === "work" ? "break" : "work";
    const minutes = next === "work" ? blitzPrefs.workMinutes : blitzPrefs.breakMinutes;
    startSegment(next, minutes * 60, false);
  }, [blitzPhase, blitzPrefs.workMinutes, blitzPrefs.breakMinutes, startSegment]);

  const setBlitzWorkMinutes = useCallback(
    (minutes: number) => {
      setBlitzPrefsState((p) => ({ ...p, workMinutes: minutes }));
      // Live-apply if we're currently in (a paused) work phase.
      if (blitzPhase === "work") {
        setBlitzPhaseDuration(minutes * 60);
        setBlitzSecondsLeft(minutes * 60);
        setBlitzRunning(false);
      }
    },
    [blitzPhase, setBlitzPrefsState],
  );
  const setBlitzBreakMinutes = useCallback(
    (minutes: number) => {
      setBlitzPrefsState((p) => ({ ...p, breakMinutes: minutes }));
      if (blitzPhase === "break") {
        setBlitzPhaseDuration(minutes * 60);
        setBlitzSecondsLeft(minutes * 60);
        setBlitzRunning(false);
      }
    },
    [blitzPhase, setBlitzPrefsState],
  );
  const setBlitzPrefs = useCallback(
    (patch: Partial<BlitzPrefs>) => setBlitzPrefsState((p) => ({ ...p, ...patch })),
    [setBlitzPrefsState],
  );

  // The single source of truth for the countdown. Runs in the provider (which
  // sits above the router outlet), so it ticks regardless of the active page.
  useEffect(() => {
    if (!blitzRunning) return;
    const id = window.setInterval(() => {
      setBlitzSecondsLeft((current) => {
        if (current <= 1) {
          setBlitzRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [blitzRunning]);

  // End-of-segment handling: chime, then transition work↔break per prefs.
  useEffect(() => {
    if (!blitzOpen || blitzSecondsLeft !== 0) return;
    if (blitzPrefs.chime) playBlitzChime();
    if (blitzPhase === "work" && blitzPrefs.breakEnabled && blitzPrefs.breakMinutes > 0) {
      startSegment("break", blitzPrefs.breakMinutes * 60, true);
    } else if (blitzPhase === "break") {
      startSegment("work", blitzPrefs.workMinutes * 60, false);
    }
  }, [blitzSecondsLeft, blitzOpen, blitzPhase, blitzPrefs, startSegment]);

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
  const openMobileNav  = useCallback(() => setMobileNavOpen(true), []);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
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
        blitzOpen,
        blitzExpanded,
        blitzRunning,
        blitzSecondsLeft,
        blitzActiveIndex,
        blitzPhase,
        blitzPhaseDuration,
        blitzPrefs,
        openBlitz,
        closeBlitz,
        minimizeBlitz,
        expandBlitz,
        toggleBlitzRunning,
        resetBlitz,
        advanceBlitz,
        skipBlitzPhase,
        setBlitzWorkMinutes,
        setBlitzBreakMinutes,
        setBlitzPrefs,
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
        mobileNavOpen,
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
        openMobileNav,
        closeMobileNav,
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
