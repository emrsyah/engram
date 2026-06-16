"use client";

import { useEffect, useRef } from "react";

import { useEngramStore } from "../store";
import { useUIStore } from "../ui-store";
import {
	BlitzBanner,
	BlitzDialog,
	formatBlitzSeconds,
	sectionOf,
	sortTasks,
	taskTitle,
} from "./tasks-view";

/**
 * App-level host for Blitz focus mode. Rendered in the (app) layout — above the
 * router outlet — so the timer (which lives in the UI store) keeps running as
 * the user navigates between pages.
 *
 * Renders nothing inline; the fullscreen dialog portals to the body. The
 * running banner is rendered separately by {@link BlitzBannerSlot}.
 */
export function BlitzContainer() {
	const {
		blitzOpen,
		blitzExpanded,
		blitzRunning,
		blitzSecondsLeft,
		blitzActiveIndex,
		blitzPhase,
		blitzPhaseDuration,
		blitzPrefs,
		closeBlitz,
		minimizeBlitz,
		toggleBlitzRunning,
		resetBlitz,
		advanceBlitz,
		skipBlitzPhase,
		setBlitzWorkMinutes,
		setBlitzBreakMinutes,
		setBlitzPrefs,
	} = useUIStore();
	const { allTaskItems, toggleDone } = useEngramStore();

	const nowTasks = sortTasks(
		allTaskItems.filter((task) => !task.done && sectionOf(task) === "now"),
	);
	const safeIndex = Math.min(blitzActiveIndex, Math.max(nowTasks.length - 1, 0));
	const activeTask = nowTasks[safeIndex];
	const label =
		blitzPhase === "break" ? "Break" : activeTask ? taskTitle(activeTask) : "Blitz";

	// Reflect the running timer in the browser tab title, then restore on exit.
	const baseTitle = useRef<string | null>(null);
	useEffect(() => {
		if (!blitzOpen) return;
		if (baseTitle.current === null) baseTitle.current = document.title;
		document.title = `${formatBlitzSeconds(blitzSecondsLeft)} · ${label}`;
	}, [blitzOpen, blitzSecondsLeft, label]);
	useEffect(() => {
		if (blitzOpen) return;
		if (baseTitle.current !== null) {
			document.title = baseTitle.current;
			baseTitle.current = null;
		}
	}, [blitzOpen]);

	if (!blitzOpen || !blitzExpanded) return null;

	return (
		<BlitzDialog
			open={blitzOpen && blitzExpanded}
			onMinimize={minimizeBlitz}
			onEnd={closeBlitz}
			tasks={nowTasks}
			secondsLeft={blitzSecondsLeft}
			running={blitzRunning}
			activeIndex={blitzActiveIndex}
			phase={blitzPhase}
			phaseDuration={blitzPhaseDuration}
			prefs={blitzPrefs}
			onToggleRun={toggleBlitzRunning}
			onReset={resetBlitz}
			onComplete={(id) => {
				toggleDone(id);
				advanceBlitz();
			}}
			onSkipPhase={skipBlitzPhase}
			onSetWorkMinutes={setBlitzWorkMinutes}
			onSetBreakMinutes={setBlitzBreakMinutes}
			onSetPrefs={setBlitzPrefs}
		/>
	);
}

/**
 * The minimized running banner. Lives at the top of the main content area so it
 * sits under the top bar in normal flow (not portaled).
 */
export function BlitzBannerSlot() {
	const {
		blitzOpen,
		blitzExpanded,
		blitzRunning,
		blitzSecondsLeft,
		blitzActiveIndex,
		blitzPhase,
		closeBlitz,
		expandBlitz,
		toggleBlitzRunning,
	} = useUIStore();
	const { allTaskItems } = useEngramStore();

	if (!blitzOpen || blitzExpanded) return null;

	const nowTasks = sortTasks(
		allTaskItems.filter((task) => !task.done && sectionOf(task) === "now"),
	);
	const safeIndex = Math.min(blitzActiveIndex, Math.max(nowTasks.length - 1, 0));
	const activeTask = nowTasks[safeIndex];
	const label = activeTask ? taskTitle(activeTask) : "Blitz";

	return (
		<BlitzBanner
			phase={blitzPhase}
			secondsLeft={blitzSecondsLeft}
			running={blitzRunning}
			label={label}
			onToggleRun={toggleBlitzRunning}
			onExpand={expandBlitz}
			onEnd={closeBlitz}
		/>
	);
}
