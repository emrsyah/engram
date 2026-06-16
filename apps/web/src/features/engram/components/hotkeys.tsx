"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useHotkeys } from "react-hotkeys-hook";

import { useEngramStore } from "../store";
import { useUIStore } from "../ui-store";

export function Hotkeys() {
	const router = useRouter();
	const { undoDelete } = useEngramStore();
	const {
		expandQuickCapture,
		quickCaptureExpanded,
		openSearch,
		openShortcuts,
		toggleSidebar,
		setLinkSource,
		searchOpen,
		shortcutsOpen,
		detailItemId,
	} = useUIStore();

	const anyDialogOpen = searchOpen || shortcutsOpen || !!detailItemId;

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

	useHotkeys(["slash", "mod+k"], openSearch, {
		description: "Search items",
		preventDefault: true,
		enabled: !anyDialogOpen,
	});

	useHotkeys("1", () => router.push("/tasks" as Route<string>), {
		description: "Go to Tasks",
		enabled: !anyDialogOpen,
	});

	useHotkeys("2", () => router.push("/library" as Route<string>), {
		description: "Go to Library",
		enabled: !anyDialogOpen,
	});

	useHotkeys("[", toggleSidebar, {
		description: "Toggle sidebar",
		enabled: !anyDialogOpen,
	});

	useHotkeys("shift+slash", openShortcuts, {
		description: "Show keyboard shortcuts",
		preventDefault: true,
		enabled: !shortcutsOpen,
	});

	useHotkeys("mod+z", undoDelete, {
		description: "Undo last deletion",
		preventDefault: true,
		enabled: !anyDialogOpen,
	});

	useHotkeys("escape", () => setLinkSource(undefined), {
		description: "Cancel link mode",
		enabled: !anyDialogOpen,
	});

	return null;
}
