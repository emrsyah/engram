"use client";

import type { Route } from "next";
import { useRouter, usePathname } from "next/navigation";
import { useHotkeys } from "react-hotkeys-hook";

import { useEngramStore } from "../store";
import { useUIStore } from "../ui-store";

/**
 * Mounts all global keyboard shortcuts for the app.
 * Renders nothing — purely a side-effect component.
 */
export function Hotkeys() {
  const router = useRouter();
  const pathname = usePathname();
  const { spaces, items, setActiveSpace, removeItems, undoDelete, pinToFocus, unpinFromFocus } = useEngramStore();
  const {
    expandQuickCapture,
    quickCaptureExpanded,
    openSearch,
    openShortcuts,
    toggleSidebar,
    toggleMinimap,
    setLinkSource,
    searchOpen,
    shortcutsOpen,
    canvasSelectedIds,
    detailItemId,
  } = useUIStore();

  const anyDialogOpen = searchOpen || shortcutsOpen || !!detailItemId;
  const onCanvas = pathname === "/canvas";

  // ── Capture ──────────────────────────────────────────────────────────
  useHotkeys("n", () => expandQuickCapture(), {
    description: "Open quick capture",
    preventDefault: true,
    enabled: !anyDialogOpen && !quickCaptureExpanded,
  });
  useHotkeys("mod+t", () => expandQuickCapture("task"), {
    description: "Capture a task",
    preventDefault: true,
    enabled: !anyDialogOpen && !quickCaptureExpanded,
  });

  // ── Search ───────────────────────────────────────────────────────────
  useHotkeys(
    ["slash", "mod+k"],
    openSearch,
    { description: "Search items", preventDefault: true, enabled: !anyDialogOpen },
  );

  // ── View navigation ──────────────────────────────────────────────────
  useHotkeys("1", () => router.push("/canvas" as Route<string>), {
    description: "Go to Canvas",
    enabled: !anyDialogOpen,
  });
  useHotkeys("2", () => router.push("/timeline" as Route<string>), {
    description: "Go to Timeline",
    enabled: !anyDialogOpen,
  });
  useHotkeys("3", () => router.push("/priorities" as Route<string>), {
    description: "Go to Priorities",
    enabled: !anyDialogOpen,
  });

  // ── Space switching ───────────────────────────────────────────────────
  useHotkeys(
    "mod+1",
    () => spaces[0] && setActiveSpace(spaces[0].id),
    { description: "Switch to Space 1", preventDefault: true, enabled: !anyDialogOpen },
  );
  useHotkeys(
    "mod+2",
    () => spaces[1] && setActiveSpace(spaces[1].id),
    { description: "Switch to Space 2", preventDefault: true, enabled: !anyDialogOpen },
  );
  useHotkeys(
    "mod+3",
    () => spaces[2] && setActiveSpace(spaces[2].id),
    { description: "Switch to Space 3", preventDefault: true, enabled: !anyDialogOpen },
  );

  // ── Sidebar toggle ────────────────────────────────────────────────────
  useHotkeys("[", toggleSidebar, {
    description: "Toggle sidebar",
    enabled: !anyDialogOpen,
  });

  // ── Shortcuts help ────────────────────────────────────────────────────
  useHotkeys("shift+slash", openShortcuts, {
    description: "Show keyboard shortcuts",
    preventDefault: true,
    enabled: !shortcutsOpen,
  });

  // ── Canvas node shortcuts ─────────────────────────────────────────────
  useHotkeys(
    "delete,backspace",
    () => { removeItems(canvasSelectedIds); },
    { description: "Delete selected node", enabled: onCanvas && !anyDialogOpen && canvasSelectedIds.length > 0 },
  );

  // ── Pin selected task nodes to focus ─────────────────────────────────
  useHotkeys(
    "f",
    () => {
      for (const id of canvasSelectedIds) {
        const item = items.find((i) => i.id === id);
        if (!item || item.type !== "task") continue;
        if (item.focusPinned) unpinFromFocus(id);
        else pinToFocus(id);
      }
    },
    {
      description: "Toggle focus pin on selected task(s)",
      preventDefault: true,
      enabled: onCanvas && !anyDialogOpen && canvasSelectedIds.length > 0,
    },
  );


  // ── Minimap ───────────────────────────────────────────────────────────
  useHotkeys("m", toggleMinimap, {
    description: "Toggle minimap",
    enabled: !anyDialogOpen,
  });

  // ── Undo delete ───────────────────────────────────────────────────────
  useHotkeys("mod+z", undoDelete, {
    description: "Undo last deletion",
    preventDefault: true,
    enabled: !anyDialogOpen,
  });

  // ── Escape — context-aware dismiss ───────────────────────────────────
  useHotkeys("escape", () => setLinkSource(undefined), {
    description: "Cancel link mode",
    enabled: !anyDialogOpen,
  });

  return null;
}
