"use client";

import { Button } from "@alphonse/ui/components/button";
import { Checkbox } from "@alphonse/ui/components/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@alphonse/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@alphonse/ui/components/dropdown-menu";
import { Input } from "@alphonse/ui/components/input";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "@alphonse/ui/components/popover";
import { Tabs, TabsList, TabsTrigger } from "@alphonse/ui/components/tabs";
import { cn } from "@alphonse/ui/lib/utils";
import {
	closestCenter,
	DndContext,
	KeyboardSensor,
	PointerSensor,
	useDroppable,
	useSensor,
	useSensors,
	type DragEndEvent,
} from "@dnd-kit/core";
import {
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useReducer, useState } from "react";

import { useEngramStore } from "../store";
import type { Item, Space, TaskQueue } from "../types";
import { type BlitzPhase, type BlitzPrefs, useUIStore } from "../ui-store";
import { usePersistentState } from "../use-persistent-state";
import { DueChip, PriorityChip } from "./chips";
import { Icons } from "./icons";

type TaskFilter =
	| { kind: "all"; value: "all" }
	| { kind: "group"; value: string }
	| { kind: "tag"; value: string };

type LayoutMode = "columns" | "stacked";
type PlanningSectionId = "later" | "next" | "now";
type SectionId = PlanningSectionId | "done";

/** Durable view preferences — persisted across navigation and reload. */
type TasksPrefs = {
	filter: TaskFilter;
	layoutMode: LayoutMode;
	collapsed: Record<PlanningSectionId, boolean>;
	doneOpen: boolean;
};

/** Ephemeral, per-visit state — fine to reset when leaving the page. */
type TasksUiState = {
	newTask: string;
	focusedTaskId?: string;
};
type TasksUiAction =
	| { type: "newTask"; newTask: string }
	| { type: "focusTask"; taskId?: string };

const SECTIONS: { id: SectionId; label: string; hint: string }[] = [
	{ id: "later", label: "Backlog", hint: "Captured, not planned yet" },
	{ id: "next", label: "This week", hint: "Worth doing soon" },
	{ id: "now", label: "Today", hint: "Ordered focus list" },
];

const ACTIVE_SECTIONS: PlanningSectionId[] = ["later", "next", "now"];

const TASKS_PREFS_KEY = "engram.tasks.prefs.v1";
const DEFAULT_TASKS_PREFS: TasksPrefs = {
	filter: { kind: "all", value: "all" },
	layoutMode: "stacked",
	collapsed: { later: false, next: false, now: false },
	doneOpen: false,
};

const INITIAL_TASKS_UI: TasksUiState = {
	newTask: "",
};

function tasksUiReducer(state: TasksUiState, action: TasksUiAction): TasksUiState {
	switch (action.type) {
		case "newTask":
			return { ...state, newTask: action.newTask };
		case "focusTask":
			return { ...state, focusedTaskId: action.taskId };
	}
}

export function taskTitle(task: Item) {
	return task.title ?? task.text ?? "Untitled task";
}

export function sortTasks(tasks: Item[]) {
	return tasks.toSorted((a, b) => {
		if (a.done !== b.done) return a.done ? 1 : -1;
		const orderA = a.taskSortOrder ?? Number.MAX_SAFE_INTEGER;
		const orderB = b.taskSortOrder ?? Number.MAX_SAFE_INTEGER;
		if (orderA !== orderB) return orderA - orderB;
		return a.createdAt.localeCompare(b.createdAt);
	});
}

function startOfDay(date: Date) {
	const copy = new Date(date);
	copy.setHours(0, 0, 0, 0);
	return copy;
}

/** Where a task's due date places it: today/overdue → Today, any later date → This week. */
function dateBucket(dueAt?: string): PlanningSectionId | undefined {
	if (!dueAt) return undefined;
	const due = startOfDay(new Date(dueAt)).getTime();
	const today = startOfDay(new Date()).getTime();
	return due <= today ? "now" : "next";
}

/**
 * Section resolution, in precedence order:
 *  1. An explicit "now"/"next" queue (set by drag or the lane buttons) wins.
 *  2. Otherwise the due date decides (today → Today, later → This week).
 *  3. Dateless tasks fall to Backlog.
 */
export function sectionOf(task: Item): SectionId {
	if (task.done) return "done";
	if (task.taskQueue === "now") return "now";
	if (task.taskQueue === "next") return "next";
	return dateBucket(task.dueAt) ?? "later";
}

function sectionLabel(id: SectionId) {
	return SECTIONS.find((section) => section.id === id)?.label ?? id;
}

function spaceName(spaces: Space[], id: string) {
	return spaces.find((space) => space.id === id)?.name ?? "Ungrouped";
}

function columnId(section: SectionId) {
	return `section-${section}`;
}

function sectionFromColumnId(id: string): SectionId | undefined {
	return id.startsWith("section-") ? (id.replace("section-", "") as SectionId) : undefined;
}

export function formatBlitzSeconds(seconds: number) {
	const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
	const secs = (seconds % 60).toString().padStart(2, "0");
	return `${mins}:${secs}`;
}

export function TasksView() {
	const { allTaskItems, allTags, createItem, spaces, setTaskQueue, toggleDone, updateItem } =
		useEngramStore();
	const { openDetail, openBlitz } = useUIStore();
	const [ui, dispatchUi] = useReducer(tasksUiReducer, INITIAL_TASKS_UI);
	const [prefs, setPrefs] = usePersistentState<TasksPrefs>(TASKS_PREFS_KEY, DEFAULT_TASKS_PREFS);

	const setFilter = (filter: TaskFilter) => setPrefs((p) => ({ ...p, filter }));
	const setLayout = (layoutMode: LayoutMode) => setPrefs((p) => ({ ...p, layoutMode }));
	const setDoneOpen = (doneOpen: boolean) => setPrefs((p) => ({ ...p, doneOpen }));
	const toggleSection = (id: PlanningSectionId) =>
		setPrefs((p) => ({ ...p, collapsed: { ...p.collapsed, [id]: !p.collapsed[id] } }));

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	const defaultSpaceId = spaces[0]?.id;
	const taskTags = allTags.filter((tag) => allTaskItems.some((task) => task.tags?.includes(tag)));

	const visibleTasks = sortTasks(
		prefs.filter.kind === "group"
			? allTaskItems.filter((task) => task.spaceId === prefs.filter.value)
			: prefs.filter.kind === "tag"
				? allTaskItems.filter((task) => task.tags?.includes(prefs.filter.value))
				: allTaskItems,
	);

	const tasksBySection = new Map<SectionId, Item[]>();
	for (const section of SECTIONS) tasksBySection.set(section.id, []);
	tasksBySection.set("done", []);
	for (const task of visibleTasks) {
		const key = sectionOf(task);
		tasksBySection.get(key)?.push(task);
	}
	for (const [key, tasks] of tasksBySection) tasksBySection.set(key, sortTasks(tasks));

	const addTask = () => {
		const title = ui.newTask.trim();
		if (!title || !defaultSpaceId) return;
		createItem({
			type: "task",
			title,
			taskQueue: "later",
			spaceId: defaultSpaceId,
			stayOnCurrentView: true,
		});
		dispatchUi({ type: "newTask", newTask: "" });
	};

	const focusedTask = ui.focusedTaskId
		? allTaskItems.find((task) => task.id === ui.focusedTaskId && !task.done)
		: undefined;
	const activeFilterLabel =
		prefs.filter.kind === "group"
			? spaceName(spaces, prefs.filter.value)
			: prefs.filter.kind === "tag"
				? `#${prefs.filter.value}`
				: "All tasks";

	const focusTask = (task: Item) => {
		if (task.done) return;
		const todayTasks = sortTasks(
			allTaskItems.filter((item) => item.id !== task.id && !item.done && sectionOf(item) === "now"),
		);
		for (const [index, item] of todayTasks.entries()) {
			updateItem(item.id, { taskSortOrder: index + 1 });
		}
		setTaskQueue(task.id, "now", 0);
		dispatchUi({ type: "focusTask", taskId: task.id });
	};

	const handleDragEnd = ({ active, over }: DragEndEvent) => {
		if (!over || active.id === over.id) return;
		const taskId = String(active.id);
		const activeTask = allTaskItems.find((task) => task.id === taskId);
		if (!activeTask || activeTask.done) return;

		const overId = String(over.id);
		const overTask = allTaskItems.find((task) => task.id === overId);
		const destination = overTask ? sectionOf(overTask) : sectionFromColumnId(overId);
		if (!destination || destination === "done") return;

		const currentDestinationTasks = sortTasks(
			allTaskItems.filter((task) => task.id !== taskId && !task.done && sectionOf(task) === destination),
		);
		const overIndex = overTask
			? currentDestinationTasks.findIndex((task) => task.id === overTask.id)
			: currentDestinationTasks.length;
		const insertIndex = overIndex < 0 ? currentDestinationTasks.length : overIndex;
		const ordered = [
			...currentDestinationTasks.slice(0, insertIndex),
			activeTask,
			...currentDestinationTasks.slice(insertIndex),
		];

		for (const [index, task] of ordered.entries()) {
			if (task.id === taskId) setTaskQueue(task.id, destination, index);
			else updateItem(task.id, { taskSortOrder: index });
		}
	};

	return (
		<section className="flex h-full bg-base text-white">
			<div className="min-w-0 flex-1 overflow-y-auto px-5 py-7 lg:px-8">
				<div className="mx-auto max-w-[1280px]">
					<div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
						<div>
							<h2 className="flex items-center gap-3 font-serif font-medium text-3xl tracking-tight">
								<Icons.square className="size-7 text-brand-glow" />
								Tasks
							</h2>
							<p className="mt-2 max-w-2xl text-ink-muted text-sm">
								Capture to Backlog, plan into This week, and keep Today small and ordered.
							</p>
						</div>

						<div className="flex flex-wrap items-center gap-2">
							<TaskFilterMenu
								filter={prefs.filter}
								label={activeFilterLabel}
								onFilter={setFilter}
								spaces={spaces}
								tasks={allTaskItems}
								tags={taskTags}
							/>
							<Tabs value={prefs.layoutMode} onValueChange={(value) => setLayout(value as LayoutMode)}>
								<TabsList className="h-9 gap-1 rounded-[8px] border border-line-2 bg-sunken p-1">
									{(["columns", "stacked"] as LayoutMode[]).map((mode) => (
										<TabsTrigger
											key={mode}
											value={mode}
											className="h-7 gap-1.5 rounded-[6px] px-2.5 font-medium text-ink-muted capitalize data-active:bg-brand-surface data-active:text-brand-soft"
										>
											<Icons.layout className="size-3.5" />
											{mode}
										</TabsTrigger>
									))}
								</TabsList>
							</Tabs>
							<Button
								type="button"
								variant="ghost"
								onClick={() => setDoneOpen(!prefs.doneOpen)}
								className={cn(
									"h-9 gap-2 rounded-[8px] border px-3",
									prefs.doneOpen
										? "border-brand bg-brand-surface text-brand-soft"
										: "border-line-2 bg-sunken text-ink-muted hover:text-ink-2",
								)}
							>
								<Icons.check className="size-4" />
								Done
								<CountBadge count={tasksBySection.get("done")?.length ?? 0} />
							</Button>
						</div>
					</div>

					{prefs.filter.kind !== "all" ? (
						<div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
							<span className="text-ink-dim">Filtered by</span>
							<button
								type="button"
								onClick={() => setFilter({ kind: "all", value: "all" })}
								className="flex items-center gap-2 rounded-[999px] border border-line bg-surface px-3 py-1.5 font-semibold text-ink-2 hover:border-line-strong"
							>
								{activeFilterLabel}
								<Icons.x className="size-3.5 text-ink-dim" />
							</button>
						</div>
					) : null}

					<div className="mt-6 flex gap-2 rounded-[12px] border border-line-2 bg-sunken p-2 focus-within:border-line-strong">
						<Input
							value={ui.newTask}
							onChange={(event) => dispatchUi({ type: "newTask", newTask: event.target.value })}
							onKeyDown={(event) => {
								if (event.key === "Enter") addTask();
							}}
							placeholder="Add to Backlog..."
							className="h-10 border-0 bg-transparent text-ink-bright placeholder:text-ink-dim focus-visible:ring-0"
						/>
						<Button
							type="button"
							onClick={addTask}
							className="h-10 gap-2 rounded-[8px] bg-brand px-4 font-semibold text-brand-ink hover:bg-brand-bright"
						>
							<Icons.plus className="size-4" />
							Add
						</Button>
					</div>

					{focusedTask ? (
						<div className="mt-4 flex items-center gap-3 rounded-[12px] border border-ink-ghost bg-brand-surface px-4 py-3">
							<Icons.target className="size-5 shrink-0 text-brand-soft" />
							<div className="min-w-0 flex-1">
								<p className="text-ink-3 text-xs font-bold uppercase tracking-[0.14em]">Focused task</p>
								<p className="truncate font-bold text-ink-bright">{taskTitle(focusedTask)}</p>
							</div>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => dispatchUi({ type: "focusTask", taskId: undefined })}
								className="h-8 rounded-[6px] px-3 text-ink-3 hover:text-white"
							>
								Clear
							</Button>
						</div>
					) : null}

					<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
						<div
							className={cn(
								"mt-6 gap-4",
								prefs.layoutMode === "columns"
									? "grid min-w-[780px] grid-cols-3"
									: "grid grid-cols-1",
							)}
						>
							{(prefs.layoutMode === "stacked" ? SECTIONS.toReversed() : SECTIONS).map((section) => (
								<TaskSection
									key={section.id}
									section={section}
									tasks={tasksBySection.get(section.id) ?? []}
									spaces={spaces}
									layoutMode={prefs.layoutMode}
									collapsed={prefs.collapsed[section.id as PlanningSectionId] ?? false}
									onToggleCollapse={() => toggleSection(section.id as PlanningSectionId)}
									onToggleDone={toggleDone}
									onQueue={setTaskQueue}
									onOpen={openDetail}
									onFocus={focusTask}
									focusedTaskId={ui.focusedTaskId}
									onOpenBlitz={section.id === "now" ? openBlitz : undefined}
								/>
							))}
						</div>
					</DndContext>

					<DoneArchive
						tasks={tasksBySection.get("done") ?? []}
						spaces={spaces}
						onToggleDone={toggleDone}
						onOpen={openDetail}
						open={prefs.doneOpen}
						onOpenChange={setDoneOpen}
					/>
				</div>
			</div>
		</section>
	);
}

function TaskFilterMenu({
	filter,
	label,
	onFilter,
	spaces,
	tasks,
	tags,
}: {
	filter: TaskFilter;
	label: string;
	onFilter: (filter: TaskFilter) => void;
	spaces: Space[];
	tasks: Item[];
	tags: string[];
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						className="h-9 gap-2 rounded-[8px] border border-line-2 bg-sunken px-3 text-ink-2 hover:text-white"
					/>
				}
			>
				<Icons.search className="size-4 text-brand" />
				<span className="max-w-[160px] truncate">{label}</span>
				<Icons.chevronRight className="size-4 rotate-90 text-ink-dim" />
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="w-[280px] border border-line-2 bg-panel p-1 text-ink-2"
			>
				<DropdownMenuItem
					onClick={() => onFilter({ kind: "all", value: "all" })}
					className={cn("justify-between", filter.kind === "all" && "bg-fill text-white")}
				>
					<span className="flex items-center gap-2">
						<Icons.square className="size-4 text-brand" />
						All tasks
					</span>
					<CountBadge count={tasks.length} />
				</DropdownMenuItem>
				<DropdownMenuSeparator className="my-1 bg-line" />
				<DropdownLabel>Groups</DropdownLabel>
				{spaces.map((space) => (
					<DropdownMenuItem
						key={space.id}
						onClick={() => onFilter({ kind: "group", value: space.id })}
						className={cn(
							"justify-between",
							filter.kind === "group" && filter.value === space.id && "bg-fill text-white",
						)}
					>
						<span className="truncate">{space.name}</span>
						<CountBadge count={tasks.filter((task) => task.spaceId === space.id).length} />
					</DropdownMenuItem>
				))}
				<DropdownMenuSeparator className="my-1 bg-line" />
				<DropdownLabel>Tags</DropdownLabel>
				{tags.length === 0 ? (
					<div className="px-2 py-2 text-ink-ghost text-xs">No task tags yet</div>
				) : (
					tags.map((tag) => (
						<DropdownMenuItem
							key={tag}
							onClick={() => onFilter({ kind: "tag", value: tag })}
							className={cn(
								"justify-between",
								filter.kind === "tag" && filter.value === tag && "bg-fill text-white",
							)}
						>
							<span className="truncate">#{tag}</span>
							<CountBadge count={tasks.filter((task) => task.tags?.includes(tag)).length} />
						</DropdownMenuItem>
					))
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function TaskSection({
	section,
	tasks,
	spaces,
	layoutMode,
	collapsed,
	onToggleCollapse,
	onToggleDone,
	onQueue,
	onOpen,
	onFocus,
	focusedTaskId,
	onOpenBlitz,
}: {
	section: { id: SectionId; label: string; hint: string };
	tasks: Item[];
	spaces: Space[];
	layoutMode: LayoutMode;
	collapsed: boolean;
	onToggleCollapse: () => void;
	onToggleDone: (id: string) => void;
	onQueue: (id: string, queue: TaskQueue) => void;
	onOpen: (id: string) => void;
	onFocus: (task: Item) => void;
	focusedTaskId?: string;
	onOpenBlitz?: () => void;
}) {
	const { setNodeRef, isOver } = useDroppable({ id: columnId(section.id) });

	return (
		<section
			ref={setNodeRef}
			className={cn(
				"flex flex-col overflow-hidden rounded-[12px] border bg-base",
				collapsed ? "max-h-none" : "max-h-[calc(100vh-330px)] min-h-[300px]",
				isOver ? "border-brand bg-brand-surface" : "border-fill",
			)}
		>
			<header className="shrink-0 border-fill border-b px-4 py-3">
				<div className="flex items-center justify-between gap-3">
					<button
						type="button"
						onClick={onToggleCollapse}
						aria-expanded={!collapsed}
						className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
					>
						<Icons.chevronRight
							className={cn(
								"size-4 shrink-0 text-ink-faint transition-transform",
								!collapsed && "rotate-90",
							)}
						/>
						<span className="min-w-0">
							<span className="block truncate font-bold text-ink text-lg">{section.label}</span>
							{!collapsed ? (
								<span className="mt-0.5 block truncate text-ink-faint text-xs">{section.hint}</span>
							) : null}
						</span>
					</button>
					<div className="flex shrink-0 items-center gap-2">
						{onOpenBlitz && !collapsed ? (
							<Button
								type="button"
								size="sm"
								onClick={onOpenBlitz}
								className="h-8 gap-2 rounded-[8px] bg-brand px-3 font-semibold text-brand-ink hover:bg-brand-bright"
							>
								<Icons.target className="size-4" />
								Blitz
							</Button>
						) : null}
						<CountBadge count={tasks.length} />
					</div>
				</div>
			</header>
			{collapsed ? null : (
				<SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
					<div
						className={cn(
							"min-h-0 flex-1 space-y-2 overflow-y-auto p-3",
							layoutMode === "stacked" && "max-h-[60vh]",
						)}
					>
						{tasks.length === 0 ? (
							<div className="rounded-[7px] border border-dashed border-line-2 px-3 py-8 text-center text-ink-ghost text-sm">
								Drop tasks here
							</div>
						) : (
							tasks.map((task) => (
								<SortableTaskCard
									key={task.id}
									task={task}
									groupName={spaceName(spaces, task.spaceId)}
									onToggleDone={onToggleDone}
									onQueue={onQueue}
									onOpen={() => onOpen(task.id)}
									onFocus={() => onFocus(task)}
									focused={focusedTaskId === task.id}
								/>
							))
						)}
					</div>
				</SortableContext>
			)}
		</section>
	);
}

function DoneArchive({
	tasks,
	spaces,
	onToggleDone,
	onOpen,
	open,
	onOpenChange,
}: {
	tasks: Item[];
	spaces: Space[];
	onToggleDone: (id: string) => void;
	onOpen: (id: string) => void;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<section className="mt-6 rounded-[12px] border border-surface bg-void opacity-75">
			<header className="flex items-center justify-between border-surface border-b px-4 py-2.5">
				<div>
					<h3 className="font-bold text-ink-dim">Done</h3>
					<p className="text-ink-ghost text-xs">Completed tasks stay out of the planning lanes.</p>
				</div>
				<button
					type="button"
					onClick={() => onOpenChange(!open)}
					className="flex items-center gap-2 rounded-[7px] bg-surface px-2.5 py-1.5 font-semibold text-ink-dim text-xs hover:text-ink-2"
				>
					{open ? "Close" : "Open"}
					<CountBadge count={tasks.length} />
				</button>
			</header>
			<div className={cn("grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-3", !open && "hidden")}>
				{sortTasks(tasks).map((task) => (
					<div
						key={task.id}
						className="flex items-start gap-2.5 rounded-[7px] border border-fill bg-surface px-3 py-2"
					>
						<Checkbox
							checked={task.done}
							onCheckedChange={() => onToggleDone(task.id)}
							className="mt-0.5 rounded-full opacity-70"
						/>
						<div className="min-w-0 flex-1">
							<button
								type="button"
								onClick={() => onOpen(task.id)}
								className="block max-w-full truncate text-left font-semibold text-ink-faint text-sm line-through hover:text-ink-muted"
							>
								{taskTitle(task)}
							</button>
							<p className="mt-1 truncate text-ink-ghost text-[10px]">
								{spaceName(spaces, task.spaceId)}
							</p>
						</div>
					</div>
				))}
			</div>
		</section>
	);
}

function CountBadge({ count }: { count: number }) {
	return (
		<span className="rounded-[5px] bg-fill px-1.5 py-0.5 font-mono text-ink-dim text-[11px]">
			{count}
		</span>
	);
}

function DropdownLabel({ children }: { children: React.ReactNode }) {
	return <div className="px-2 py-2 text-ink-dim text-xs">{children}</div>;
}

const WORK_PRESETS = [15, 25, 45, 60, 90];
const BREAK_PRESETS = [5, 10, 15, 20];

export function BlitzDialog({
	open,
	onMinimize,
	onEnd,
	tasks,
	secondsLeft,
	running,
	activeIndex,
	phase,
	phaseDuration,
	prefs,
	onToggleRun,
	onReset,
	onComplete,
	onSkipPhase,
	onSetWorkMinutes,
	onSetBreakMinutes,
	onSetPrefs,
}: {
	open: boolean;
	onMinimize: () => void;
	onEnd: () => void;
	tasks: Item[];
	secondsLeft: number;
	running: boolean;
	activeIndex: number;
	phase: BlitzPhase;
	phaseDuration: number;
	prefs: BlitzPrefs;
	onToggleRun: () => void;
	onReset: () => void;
	onComplete: (id: string) => void;
	onSkipPhase: () => void;
	onSetWorkMinutes: (minutes: number) => void;
	onSetBreakMinutes: (minutes: number) => void;
	onSetPrefs: (patch: Partial<BlitzPrefs>) => void;
}) {
	const isBreak = phase === "break";
	const safeIndex = Math.min(activeIndex, Math.max(tasks.length - 1, 0));
	const activeTask = tasks[safeIndex];
	const elapsed = Math.max(phaseDuration - secondsLeft, 0);
	const progress = phaseDuration > 0 ? elapsed / phaseDuration : 0;
	const accent = isBreak ? "text-teal" : "text-blue";
	const accentBar = isBreak ? "bg-teal" : "bg-brand";
	const accentDot = isBreak ? "bg-teal" : "bg-blue";

	const complete = () => {
		if (!activeTask) return;
		onComplete(activeTask.id);
	};

	return (
		<Dialog open={open} onOpenChange={(value) => (value ? undefined : onMinimize())}>
			<DialogContent
				showCloseButton={false}
				className="inset-0 top-0 left-0 max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-none border-0 bg-void p-0 text-white ring-0 sm:max-w-none"
			>
				<DialogTitle className="sr-only">Blitz focus</DialogTitle>
				<div className="relative flex min-h-screen flex-col px-7 py-6">
					<div className="pointer-events-none absolute inset-0 opacity-45 [background:radial-gradient(circle_at_22%_10%,rgba(144,124,232,0.12),transparent_24%),radial-gradient(circle_at_78%_20%,rgba(74,165,200,0.08),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_42%)]" />
					<header className="relative z-10 flex items-center justify-between">
						<div className="font-mono text-xs uppercase tracking-[0.28em] text-brand">
							Blitz{" "}
							<span className="ml-2 text-ink-dim">
								{Math.min(safeIndex + 1, tasks.length || 1)} of {tasks.length || 1}
							</span>
						</div>
						<div className="flex items-center gap-2">
							<BlitzSettings
								prefs={prefs}
								onSetWorkMinutes={onSetWorkMinutes}
								onSetBreakMinutes={onSetBreakMinutes}
								onSetPrefs={onSetPrefs}
							/>
							<Button
								type="button"
								variant="ghost"
								onClick={onMinimize}
								className="h-9 rounded-[8px] border border-white/10 bg-white/[0.03] px-3 text-ink-3 hover:text-white"
							>
								<Icons.minimize className="size-4" />
								Minimize
								<span className="rounded-[5px] border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-ink-dim">
									ESC
								</span>
							</Button>
							<Button
								type="button"
								variant="ghost"
								onClick={onEnd}
								className="h-9 rounded-[8px] border border-coral/30 bg-coral/10 px-3 text-coral hover:bg-coral/20 hover:text-coral"
							>
								End
							</Button>
						</div>
					</header>
					<main className="relative z-10 mx-auto flex w-full max-w-[760px] flex-1 flex-col items-center justify-center py-10 text-center">
						<button
							type="button"
							onClick={onSkipPhase}
							title={isBreak ? "Switch to focus" : "Switch to break"}
							className={cn(
								"mb-8 flex items-center gap-2 rounded-[999px] px-4 py-1.5 font-semibold text-sm transition-colors",
								isBreak ? "bg-teal/15 text-teal hover:bg-teal/25" : "bg-brand-surface text-blue hover:bg-brand-surface/70",
							)}
						>
							<span className={cn("inline-block size-2 rounded-full", accentDot)} />
							{isBreak ? "Break" : "Focus"}
						</button>
						<h2 className="max-w-[780px] text-balance font-bold text-4xl text-ink-bright tracking-normal">
							{isBreak
								? "Breathe — back in a moment"
								: activeTask
									? taskTitle(activeTask)
									: "Pick a task for today"}
						</h2>
						<div className="mt-12 font-mono text-7xl text-ink-bright tracking-normal">
							{formatBlitzSeconds(secondsLeft)}
						</div>
						<div className="mt-10 w-full max-w-[380px]">
							<div className="h-1 overflow-hidden rounded-full bg-white/10">
								<div className={cn("h-full", accentBar)} style={{ width: `${progress * 100}%` }} />
							</div>
							<div className="mt-2 flex justify-between font-mono text-ink-dim text-xs">
								<span>{formatBlitzSeconds(elapsed)} elapsed</span>
								<span>{formatBlitzSeconds(phaseDuration)} planned</span>
							</div>
						</div>
						<div className="mt-9 flex items-center gap-3">
							<button
								type="button"
								onClick={onReset}
								title="Reset timer"
								className="grid size-12 place-items-center rounded-full border border-white/15 bg-white/[0.04] text-ink-3 transition-colors hover:text-white"
							>
								<Icons.rotate className="size-5" />
							</button>
							<button
								type="button"
								onClick={onToggleRun}
								className={cn(
									"grid size-[72px] place-items-center rounded-full text-white shadow-[0_0_32px_rgba(136,117,238,0.45)] transition-transform active:scale-[0.96]",
									isBreak ? "bg-teal" : "bg-brand",
								)}
							>
								{running ? <PauseGlyph /> : <PlayGlyph />}
							</button>
							<button
								type="button"
								onClick={complete}
								disabled={isBreak || !activeTask}
								title="Complete task"
								className="grid size-12 place-items-center rounded-full border border-p3 bg-brand-ink text-teal transition-opacity disabled:opacity-30"
							>
								<Icons.check className="size-5" />
							</button>
						</div>
						{!isBreak ? (
							<div className="mt-20 w-full max-w-[700px] text-left">
								<p className="mb-3 font-bold text-ink-dim text-xs uppercase tracking-[0.14em]">Up next</p>
								<div className="space-y-2">
									{tasks.slice(safeIndex + 1, safeIndex + 4).map((task, index) => (
										<div
											key={task.id}
											className="flex items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.03] px-4 py-3 text-ink-3"
										>
											<span className="font-mono text-ink-dim text-xs">{safeIndex + index + 2}</span>
											<span className={cn("size-2 rounded-full", accentDot)} />
											<span className="min-w-0 flex-1 truncate text-sm">{taskTitle(task)}</span>
										</div>
									))}
								</div>
							</div>
						) : null}
					</main>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export function BlitzBanner({
	phase,
	secondsLeft,
	running,
	label,
	onToggleRun,
	onExpand,
	onEnd,
}: {
	phase: BlitzPhase;
	secondsLeft: number;
	running: boolean;
	label: string;
	onToggleRun: () => void;
	onExpand: () => void;
	onEnd: () => void;
}) {
	const isBreak = phase === "break";
	return (
		<div className="flex items-center gap-3 border-line border-b bg-surface px-4 py-2">
			<span className={cn("size-2 shrink-0 rounded-full", isBreak ? "bg-teal" : "bg-brand", running && "animate-pulse")} />
			<button
				type="button"
				onClick={onExpand}
				className="flex min-w-0 flex-1 items-center gap-3 text-left"
			>
				<span className="font-mono text-ink-bright text-sm tabular-nums">
					{formatBlitzSeconds(secondsLeft)}
				</span>
				<span className="text-ink-faint">·</span>
				<span className="min-w-0 flex-1 truncate text-ink-2 text-sm">
					{isBreak ? "Break" : label}
				</span>
			</button>
			<div className="flex shrink-0 items-center gap-1">
				<button
					type="button"
					onClick={onToggleRun}
					title={running ? "Pause" : "Resume"}
					className="grid size-7 place-items-center rounded-[7px] text-ink-muted transition-colors hover:bg-fill hover:text-ink"
				>
					{running ? <Icons.pause className="size-4" /> : <Icons.play className="size-4" />}
				</button>
				<button
					type="button"
					onClick={onExpand}
					title="Expand"
					className="grid size-7 place-items-center rounded-[7px] text-ink-muted transition-colors hover:bg-fill hover:text-ink"
				>
					<Icons.maximize className="size-4" />
				</button>
				<button
					type="button"
					onClick={onEnd}
					title="End session"
					className="grid size-7 place-items-center rounded-[7px] text-ink-muted transition-colors hover:bg-fill hover:text-coral"
				>
					<Icons.x className="size-4" />
				</button>
			</div>
		</div>
	);
}

function BlitzChip({
	label,
	active,
	onClick,
}: {
	label: string;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"h-8 min-w-9 rounded-[7px] px-2.5 font-mono text-xs transition-colors",
				active
					? "bg-brand text-white"
					: "border border-white/10 bg-white/[0.03] text-ink-3 hover:bg-white/[0.07] hover:text-white",
			)}
		>
			{label}
		</button>
	);
}

function BlitzSwitch({
	label,
	checked,
	onChange,
}: {
	label: string;
	checked: boolean;
	onChange: (value: boolean) => void;
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			onClick={() => onChange(!checked)}
			className="flex w-full items-center justify-between py-1 text-left"
		>
			<span className="text-ink-2 text-sm">{label}</span>
			<span
				className={cn(
					"relative h-5 w-9 rounded-full transition-colors",
					checked ? "bg-brand" : "bg-white/10",
				)}
			>
				<span
					className={cn(
						"absolute top-0.5 size-4 rounded-full bg-white transition-transform",
						checked ? "translate-x-[18px]" : "translate-x-0.5",
					)}
				/>
			</span>
		</button>
	);
}

function BlitzSettings({
	prefs,
	onSetWorkMinutes,
	onSetBreakMinutes,
	onSetPrefs,
}: {
	prefs: BlitzPrefs;
	onSetWorkMinutes: (minutes: number) => void;
	onSetBreakMinutes: (minutes: number) => void;
	onSetPrefs: (patch: Partial<BlitzPrefs>) => void;
}) {
	return (
		<PopoverRoot>
			<PopoverTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						className="size-9 rounded-[8px] border border-white/10 bg-white/[0.03] p-0 text-ink-3 hover:text-white"
					/>
				}
			>
				<Icons.settings className="size-4" />
				<span className="sr-only">Customize Blitz</span>
			</PopoverTrigger>
			<PopoverContent
				side="bottom"
				className="w-72 rounded-[12px] border-line-2 bg-panel p-4 text-white shadow-[0_8px_24px_-6px_rgba(0,0,0,0.5)]"
			>
				<div className="space-y-4">
					<div>
						<p className="mb-2 font-semibold text-ink-dim text-[11px] uppercase tracking-[0.08em]">
							Focus length
						</p>
						<div className="flex flex-wrap gap-1.5">
							{WORK_PRESETS.map((minutes) => (
								<BlitzChip
									key={minutes}
									label={`${minutes}m`}
									active={prefs.workMinutes === minutes}
									onClick={() => onSetWorkMinutes(minutes)}
								/>
							))}
						</div>
					</div>

					<div className="h-px bg-line" />

					<BlitzSwitch
						label="Breaks between sessions"
						checked={prefs.breakEnabled}
						onChange={(value) => onSetPrefs({ breakEnabled: value })}
					/>
					{prefs.breakEnabled ? (
						<div className="flex flex-wrap gap-1.5">
							{BREAK_PRESETS.map((minutes) => (
								<BlitzChip
									key={minutes}
									label={`${minutes}m`}
									active={prefs.breakMinutes === minutes}
									onClick={() => onSetBreakMinutes(minutes)}
								/>
							))}
						</div>
					) : null}

					<div className="h-px bg-line" />

					<BlitzSwitch
						label="Auto-start next task"
						checked={prefs.autoStartNext}
						onChange={(value) => onSetPrefs({ autoStartNext: value })}
					/>
					<BlitzSwitch
						label="Chime when timer ends"
						checked={prefs.chime}
						onChange={(value) => onSetPrefs({ chime: value })}
					/>
				</div>
			</PopoverContent>
		</PopoverRoot>
	);
}

function PauseGlyph() {
	return (
		<span className="flex items-center gap-1">
			<span className="h-5 w-1.5 rounded-full bg-current" />
			<span className="h-5 w-1.5 rounded-full bg-current" />
		</span>
	);
}

function PlayGlyph() {
	return <span className="ml-1 h-0 w-0 border-y-[11px] border-y-transparent border-l-[16px] border-l-current" />;
}

function SortableTaskCard({
	task,
	groupName,
	onToggleDone,
	onQueue,
	onOpen,
	onFocus,
	focused,
}: {
	task: Item;
	groupName: string;
	onToggleDone: (id: string) => void;
	onQueue: (id: string, queue: TaskQueue) => void;
	onOpen: () => void;
	onFocus: () => void;
	focused: boolean;
}) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: task.id,
		disabled: task.done,
	});
	const section = sectionOf(task);

	return (
		<article
			ref={setNodeRef}
			style={{ transform: CSS.Transform.toString(transform), transition }}
			{...attributes}
			{...listeners}
			className={cn(
				"cursor-grab rounded-[7px] border border-line bg-surface px-3 py-2.5 text-left shadow-sm",
				"transition-colors hover:border-line-strong hover:bg-fill active:cursor-grabbing",
				focused && "border-brand bg-brand-surface",
				isDragging && "opacity-60",
				task.done && "cursor-default opacity-70",
			)}
		>
			<div className="flex items-start gap-2.5">
				<span onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
					<Checkbox
						checked={task.done}
						onCheckedChange={() => onToggleDone(task.id)}
						className="mt-0.5 rounded-full"
					/>
				</span>
				<div className="min-w-0 flex-1">
					<button
						type="button"
						onPointerDown={(event) => event.stopPropagation()}
						onClick={(event) => {
							event.stopPropagation();
							onOpen();
						}}
						className={cn(
							"block max-w-full truncate text-left font-semibold text-ink-bright text-sm hover:text-white",
							task.done && "text-done line-through",
						)}
					>
						{taskTitle(task)}
					</button>
					<div className="mt-1.5 flex flex-wrap items-center gap-1.5">
						<span className="rounded-[5px] bg-line px-1.5 py-0.5 text-ink-dim text-[10px]">
							{groupName}
						</span>
						<PriorityChip priority={task.priority} />
						<DueChip dueAt={task.dueAt} />
						{task.tags?.slice(0, 2).map((tag) => (
							<span key={tag} className="rounded-[5px] bg-brand-surface px-1.5 py-0.5 text-brand-soft text-[10px]">
								#{tag}
							</span>
						))}
					</div>
				</div>
			</div>
			{!task.done ? (
				<div
					onPointerDown={(event) => event.stopPropagation()}
					onClick={(event) => event.stopPropagation()}
					className="mt-2.5 flex items-center gap-2"
				>
					<div className="inline-flex items-center gap-0.5 rounded-[8px] border border-line-2 bg-sunken p-0.5">
						{ACTIVE_SECTIONS.map((queue) => (
							<button
								key={queue}
								type="button"
								onClick={() => onQueue(task.id, queue)}
								className={cn(
									"rounded-[6px] px-2.5 py-1 font-medium text-[11px] transition-colors",
									section === queue
										? "bg-brand text-brand-ink"
										: "text-ink-muted hover:bg-fill hover:text-ink-2",
								)}
							>
								{sectionLabel(queue)}
							</button>
						))}
					</div>
					<button
						type="button"
						onClick={onFocus}
						className={cn(
							"ml-auto inline-flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1 font-medium text-[11px] transition-colors",
							focused
								? "border-brand bg-brand text-brand-ink"
								: "border-line-2 text-brand-soft hover:bg-fill",
						)}
					>
						<Icons.target className="size-3" />
						Focus
					</button>
				</div>
			) : null}
		</article>
	);
}
