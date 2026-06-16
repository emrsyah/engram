"use client";

import { useEngramStore } from "../store";
import { useUIStore } from "../ui-store";
import { BlitzDialog, sectionOf, sortTasks } from "./tasks-view";

/**
 * App-level host for Blitz focus mode. Rendered in the (app) layout — above the
 * router outlet — so the timer (which lives in the UI store) keeps running as
 * the user navigates between pages.
 */
export function BlitzContainer() {
	const {
		blitzOpen,
		blitzRunning,
		blitzSecondsLeft,
		blitzActiveIndex,
		blitzDuration,
		closeBlitz,
		toggleBlitzRunning,
		resetBlitz,
		advanceBlitz,
	} = useUIStore();
	const { allTaskItems, toggleDone } = useEngramStore();

	if (!blitzOpen) return null;

	const nowTasks = sortTasks(
		allTaskItems.filter((task) => !task.done && sectionOf(task) === "now"),
	);

	return (
		<BlitzDialog
			open={blitzOpen}
			onClose={closeBlitz}
			tasks={nowTasks}
			secondsLeft={blitzSecondsLeft}
			running={blitzRunning}
			activeIndex={blitzActiveIndex}
			duration={blitzDuration}
			onToggleRun={toggleBlitzRunning}
			onReset={resetBlitz}
			onComplete={(id) => {
				toggleDone(id);
				advanceBlitz();
			}}
		/>
	);
}
