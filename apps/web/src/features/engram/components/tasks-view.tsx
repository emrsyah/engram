"use client";

import { Button } from "@alphonse/ui/components/button";
import { Calendar } from "@alphonse/ui/components/calendar";
import { Checkbox } from "@alphonse/ui/components/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@alphonse/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuCheckboxItem,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@alphonse/ui/components/dropdown-menu";
import { Input } from "@alphonse/ui/components/input";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "@alphonse/ui/components/popover";
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
import { useEffect, useReducer, useRef, useState } from "react";

import { parseCapture } from "../capture-grammar";
import { haptic } from "../haptics";
import { SPACE_ICONS, type SpaceIconKey } from "../nav";
import { useEngramStore } from "../store";
import type { Accent, Item, Priority, Space, TaskQueue } from "../types";
import { type BlitzPhase, type BlitzPrefs, useUIStore } from "../ui-store";
import { usePersistentState } from "../use-persistent-state";
import { CaptureInput, type MentionItem } from "./capture-input";
import { Icons } from "./icons";

type TaskFilter =
	| { kind: "all"; value: "all" }
	| { kind: "group"; value: string }
	| { kind: "tag"; value: string };

type LayoutMode = "columns" | "stacked";
type SortMode = "manual" | "due" | "priority" | "recent";
type PlanningSectionId = "later" | "next" | "now";
type SectionId = PlanningSectionId | "done";

/** Payload emitted by the capture bar once a line has been parsed. */
type CaptureSubmit = {
	title: string;
	priority?: Priority;
	dueAt?: string;
	someday?: boolean;
	tags?: string[];
	spaceId: string;
	connections: MentionItem[];
};

/** Durable view preferences — persisted across navigation and reload. */
type TasksPrefs = {
	filter: TaskFilter;
	sort: SortMode;
	layoutMode: LayoutMode;
	collapsed: Record<PlanningSectionId, boolean>;
	doneOpen: boolean;
};

const SORT_OPTIONS: { id: SortMode; label: string; hint: string }[] = [
	{ id: "manual", label: "Manual order", hint: "Your drag-and-drop order" },
	{ id: "due", label: "Due date", hint: "Soonest due first" },
	{ id: "priority", label: "Priority", hint: "P1 → P3" },
	{ id: "recent", label: "Recently added", hint: "Newest first" },
];

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

const SPACE_ACCENT_CLASSES: Record<Accent, string> = {
	violet: "bg-brand text-ink-bright",
	gold: "bg-amber text-base",
	teal: "bg-teal text-brand-ink",
	red: "bg-coral text-base",
	blue: "bg-blue text-brand-ink",
};

const PRIORITY_META_CLASSES: Record<Priority, string> = {
	1: "border-p1/40 bg-p1 text-p1-ink",
	2: "border-p2/40 bg-p2 text-p2-ink",
	3: "border-p3/40 bg-p3 text-p3-ink",
};

const TASKS_PREFS_KEY = "engram.tasks.prefs.v1";
const DEFAULT_TASKS_PREFS: TasksPrefs = {
	filter: { kind: "all", value: "all" },
	sort: "manual",
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

/**
 * Sort within a section. "manual" keeps the drag order (taskSortOrder); the
 * others sort by a single field, with done tasks always sinking to the bottom.
 */
export function sortTasksBy(tasks: Item[], mode: SortMode) {
	if (mode === "manual") return sortTasks(tasks);
	return tasks.toSorted((a, b) => {
		if (a.done !== b.done) return a.done ? 1 : -1;
		if (mode === "due") {
			const dueA = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
			const dueB = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
			if (dueA !== dueB) return dueA - dueB;
		} else if (mode === "priority") {
			const prioA = a.priority ?? Number.MAX_SAFE_INTEGER;
			const prioB = b.priority ?? Number.MAX_SAFE_INTEGER;
			if (prioA !== prioB) return prioA - prioB;
		} else if (mode === "recent") {
			const cmp = b.createdAt.localeCompare(a.createdAt);
			if (cmp !== 0) return cmp;
		}
		return a.createdAt.localeCompare(b.createdAt);
	});
}

function startOfDay(date: Date) {
	const copy = new Date(date);
	copy.setHours(0, 0, 0, 0);
	return copy;
}

/** True when a task's due date is on a past calendar day (compared at start-of-day). */
function isOverdue(dueAt?: string) {
	if (!dueAt) return false;
	const due = startOfDay(parseTaskDueDate(dueAt)).getTime();
	const today = startOfDay(new Date()).getTime();
	return due < today;
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
 *  1. An explicit queue (set by drag or the lane buttons) always wins — including
 *     "later". This keeps the board the user chose stable: a task dragged to Backlog
 *     stays there, and adding a due date never silently relocates a placed task.
 *  2. For an unplaced task (no explicit queue), the due date decides
 *     (today/overdue → Today, later → This week).
 *  3. Otherwise it falls to Backlog.
 */
export function sectionOf(task: Item): SectionId {
	if (task.done) return "done";
	if (task.taskQueue === "now") return "now";
	if (task.taskQueue === "next") return "next";
	if (task.taskQueue === "later") return "later";
	return dateBucket(task.dueAt) ?? "later";
}

function sectionLabel(id: SectionId) {
	return SECTIONS.find((section) => section.id === id)?.label ?? id;
}

function spaceName(spaces: Space[], id: string) {
	return spaces.find((space) => space.id === id)?.name ?? "Ungrouped";
}

function SpaceIcon({ icon, className }: { icon: string; className?: string }) {
	const iconKey = (icon in SPACE_ICONS ? icon : "sparkles") as SpaceIconKey;
	const Icon = Icons[SPACE_ICONS[iconKey]];
	return <Icon className={className} />;
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

function hasDueTime(dueAt?: string) {
	return !!dueAt && dueAt.includes("T");
}

function parseTaskDueDate(dueAt: string) {
	if (hasDueTime(dueAt)) return new Date(dueAt);
	const [year, month, day] = dueAt.split("-").map(Number);
	return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

function toDateInputValue(date: Date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function toTimeInputValue(date: Date) {
	return new Intl.DateTimeFormat("en-GB", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		timeZone: "Asia/Jakarta",
	}).format(date);
}

function quickDate(offsetDays: number) {
	const date = new Date();
	date.setDate(date.getDate() + offsetDays);
	return toDateInputValue(date);
}

function nextWeekDate() {
	const date = new Date();
	date.setDate(date.getDate() + 7);
	return toDateInputValue(date);
}

export function TasksView() {
	const { allTaskItems, allTags, connectItems, createItem, moveItemToSpace, removeItem, spaces, setTaskQueue, toggleDone, updateItem } =
		useEngramStore();
	const { openDetail, openBlitz } = useUIStore();
	const [ui, dispatchUi] = useReducer(tasksUiReducer, INITIAL_TASKS_UI);
	const [prefs, setPrefs] = usePersistentState<TasksPrefs>(TASKS_PREFS_KEY, DEFAULT_TASKS_PREFS);

	const setFilter = (filter: TaskFilter) => setPrefs((p) => ({ ...p, filter }));
	const setSort = (sort: SortMode) => setPrefs((p) => ({ ...p, sort }));
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
	for (const [key, tasks] of tasksBySection) tasksBySection.set(key, sortTasksBy(tasks, prefs.sort));

	const captureMentionItems: MentionItem[] = allTaskItems
		.filter((task) => !task.done)
		.map((task) => ({ id: task.id, label: taskTitle(task), type: task.type }));

	const createTaskFromCapture = (payload: CaptureSubmit) => {
		haptic("success");
		const item = createItem({
			type: "task",
			title: payload.title,
			priority: payload.priority,
			dueAt: payload.dueAt,
			someday: !payload.dueAt && payload.someday ? true : undefined,
			tags: payload.tags && payload.tags.length > 0 ? payload.tags : undefined,
			taskQueue: "later",
			spaceId: payload.spaceId,
			stayOnCurrentView: true,
		});
		for (const conn of payload.connections) connectItems(item.id, conn.id);
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

	const renameTask = (id: string, title: string) => {
		const nextTitle = title.trim();
		if (!nextTitle) return;
		updateItem(id, { title: nextTitle });
	};

	const patchTask = (id: string, patch: Partial<Item>) => {
		updateItem(id, patch);
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
							<TaskSortMenu sort={prefs.sort} onSort={setSort} />
							<TaskViewMenu
								layoutMode={prefs.layoutMode}
								onLayout={setLayout}
								doneOpen={prefs.doneOpen}
								onDoneOpen={setDoneOpen}
								doneCount={tasksBySection.get("done")?.length ?? 0}
							/>
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

					<TaskCaptureBar
						spaces={spaces}
						mentionItems={captureMentionItems}
						defaultSpaceId={defaultSpaceId}
						onCreate={createTaskFromCapture}
					/>

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
									tags={allTags}
									layoutMode={prefs.layoutMode}
									collapsed={prefs.collapsed[section.id as PlanningSectionId] ?? false}
									onToggleCollapse={() => toggleSection(section.id as PlanningSectionId)}
									onToggleDone={toggleDone}
									onQueue={setTaskQueue}
									onEdit={renameTask}
									onPatch={patchTask}
									onMoveToSpace={moveItemToSpace}
									onDelete={removeItem}
									onOpen={openDetail}
									onFocus={focusTask}
									onStartBlitz={openBlitz}
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

/**
 * The "Add to Backlog" bar, upgraded with the shared capture grammar:
 * `!p1` priority, `#tag`, natural-language dates (today/tomorrow/3pm…), `~space`
 * to file it, `/` for the command palette, and `@` to link to another task.
 */
function TaskCaptureBar({
	spaces,
	mentionItems,
	defaultSpaceId,
	onCreate,
}: {
	spaces: Space[];
	mentionItems: MentionItem[];
	defaultSpaceId?: string;
	onCreate: (payload: CaptureSubmit) => void;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [text, setText] = useState("");
	const [captureTarget, setCaptureTarget] = useState<string | undefined>(defaultSpaceId);
	const [connections, setConnections] = useState<MentionItem[]>([]);
	// A date chosen via the picker / `/date` command overrides any date parsed from text.
	const [manualDue, setManualDue] = useState<string | undefined>(undefined);
	const [dueOpen, setDueOpen] = useState(false);

	const targetSpaceId = captureTarget ?? defaultSpaceId;
	const parsed = parseCapture(text);
	const parsedDue = parsed.dueDate
		? parsed.dueHasTime
			? parsed.dueDate.toISOString()
			: toDateInputValue(parsed.dueDate)
		: undefined;
	const effectiveDueAt = manualDue ?? parsedDue;
	// Title is the text with all syntax tokens stripped — a line that is *only*
	// metadata (e.g. "tomorrow !p1") has no title and can't be committed.
	const title = parsed.cleanText;
	const canCommit = title.length > 0 && !!targetSpaceId;

	const availableMentions = mentionItems.filter(
		(item) => !connections.some((conn) => conn.id === item.id),
	);

	const reset = () => {
		setText("");
		setConnections([]);
		setManualDue(undefined);
		requestAnimationFrame(() => inputRef.current?.focus());
	};

	const submit = () => {
		if (!canCommit || !targetSpaceId) return;
		onCreate({
			title,
			priority: parsed.priority,
			dueAt: effectiveDueAt,
			someday: parsed.someday,
			tags: parsed.tags,
			spaceId: targetSpaceId,
			connections,
		});
		reset();
	};

	return (
		<div className="mt-6 rounded-[12px] border border-line-2 bg-sunken p-2 focus-within:border-line-strong">
			<div className="flex items-center gap-2">
				<Icons.plus className="ml-1 size-4 shrink-0 text-brand-glow" />
				<CaptureInput
					inputRef={inputRef}
					value={text}
					onValueChange={setText}
					highlight={["priority", "tag", "date", "mention"]}
					popupPlacement="bottom"
					mentionItems={availableMentions}
					onSelectMention={(item) =>
						setConnections((current) =>
							current.some((conn) => conn.id === item.id) ? current : [...current, item],
						)
					}
					spaces={spaces.map((space) => ({ id: space.id, name: space.name }))}
					onSelectSpace={(id) => setCaptureTarget(id)}
					onOpenDatePicker={() => setDueOpen(true)}
					onCommitKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							submit();
						}
					}}
					placeholder="Add to Backlog…  !p1 · #tag · tomorrow 3pm · ~space · @link"
				/>
				<Button
					type="button"
					onClick={submit}
					disabled={!canCommit}
					className="h-10 gap-2 rounded-[8px] bg-brand px-4 font-semibold text-brand-ink hover:bg-brand-bright disabled:opacity-40"
				>
					<Icons.plus className="size-4" />
					Add
				</Button>
			</div>

			{parsed.tokens.length > 0 || connections.length > 0 || effectiveDueAt ? (
				<div className="mt-2 flex flex-wrap items-center gap-1.5 pl-7">
					{parsed.tokens.map((token) => (
						<span
							key={`${token.kind}-${token.label}`}
							className={cn(
								"rounded-[5px] border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
								token.kind === "priority"
									? "border-amber/30 bg-amber/12 text-honey"
									: token.kind === "tag"
										? "border-p3 bg-brand-surface text-blue"
										: token.kind === "someday"
											? "border-brand/30 bg-brand-surface text-brand-soft"
											: "border-line-strong bg-fill text-ink-2",
							)}
						>
							{token.label}
						</span>
					))}
					{connections.map((conn) => (
						<span
							key={conn.id}
							className="flex items-center gap-1 rounded-[5px] border border-line-max bg-brand-surface py-0.5 pr-1 pl-2 text-[11px] text-brand-soft"
						>
							<Icons.link className="size-2.5 shrink-0 text-brand-glow" />
							<span className="max-w-[160px] truncate">{conn.label}</span>
							<button
								type="button"
								onClick={() =>
									setConnections((current) => current.filter((item) => item.id !== conn.id))
								}
								aria-label={`Remove link to ${conn.label}`}
								className="ml-0.5 grid size-4 place-items-center rounded-[3px] text-brand hover:bg-p3 hover:text-white"
							>
								<Icons.x className="size-2.5" />
							</button>
						</span>
					))}
				</div>
			) : null}

			<div className="mt-2 flex flex-wrap items-center gap-1.5 pl-7">
				{targetSpaceId ? (
					<InlineSpacePill
						spaces={spaces}
						spaceId={targetSpaceId}
						onChange={(spaceId) => setCaptureTarget(spaceId)}
					/>
				) : null}
				<InlineDuePill
					dueAt={effectiveDueAt}
					open={dueOpen}
					onOpenChange={setDueOpen}
					onChange={(dueAt) => setManualDue(dueAt ?? undefined)}
				/>
			</div>
		</div>
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
				<Icons.list className="size-4 text-brand" />
				<span className="text-ink-dim">Filter</span>
				{filter.kind !== "all" ? (
					<span className="max-w-[140px] truncate font-semibold text-ink">{label}</span>
				) : null}
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

function TaskSortMenu({ sort, onSort }: { sort: SortMode; onSort: (sort: SortMode) => void }) {
	const active = SORT_OPTIONS.find((option) => option.id === sort) ?? SORT_OPTIONS[0];
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
				<Icons.list className="size-4 text-brand" />
				<span className="text-ink-dim">Sort</span>
				{sort !== "manual" ? (
					<span className="max-w-[140px] truncate font-semibold text-ink">{active.label}</span>
				) : null}
				<Icons.chevronRight className="size-4 rotate-90 text-ink-dim" />
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="w-[240px] border border-line-2 bg-panel p-1 text-ink-2"
			>
				{SORT_OPTIONS.map((option) => (
					<DropdownMenuItem
						key={option.id}
						onClick={() => onSort(option.id)}
						className={cn("flex-col items-start gap-0.5", sort === option.id && "bg-fill text-white")}
					>
						<span className="font-semibold">{option.label}</span>
						<span className="text-ink-dim text-xs">{option.hint}</span>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function TaskViewMenu({
	layoutMode,
	onLayout,
	doneOpen,
	onDoneOpen,
	doneCount,
}: {
	layoutMode: LayoutMode;
	onLayout: (mode: LayoutMode) => void;
	doneOpen: boolean;
	onDoneOpen: (open: boolean) => void;
	doneCount: number;
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
				<Icons.settings className="size-4 text-brand" />
				<span className="text-ink-dim">View</span>
				<Icons.chevronRight className="size-4 rotate-90 text-ink-dim" />
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="w-[240px] border border-line-2 bg-panel p-1 text-ink-2"
			>
				<DropdownLabel>Layout</DropdownLabel>
				{(["stacked", "columns"] as LayoutMode[]).map((mode) => (
					<DropdownMenuItem
						key={mode}
						onClick={() => onLayout(mode)}
						className={cn(
							"justify-between capitalize",
							layoutMode === mode && "bg-fill text-white",
						)}
					>
						<span className="flex items-center gap-2">
							<Icons.layout className="size-4" />
							{mode}
						</span>
						{layoutMode === mode ? <Icons.check className="size-4 text-brand" /> : null}
					</DropdownMenuItem>
				))}
				<DropdownMenuSeparator className="my-1 bg-line" />
				<DropdownMenuItem
					onClick={(event) => {
						event.preventDefault();
						onDoneOpen(!doneOpen);
					}}
					className="justify-between"
				>
					<span className="flex items-center gap-2">
						<Icons.check className="size-4" />
						Show done
					</span>
					<CountBadge count={doneCount} />
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function TaskSection({
	section,
	tasks,
	spaces,
	tags,
	layoutMode,
	collapsed,
	onToggleCollapse,
	onToggleDone,
	onQueue,
	onEdit,
	onPatch,
	onMoveToSpace,
	onDelete,
	onOpen,
	onFocus,
	onStartBlitz,
	focusedTaskId,
	onOpenBlitz,
}: {
	section: { id: SectionId; label: string; hint: string };
	tasks: Item[];
	spaces: Space[];
	tags: string[];
	layoutMode: LayoutMode;
	collapsed: boolean;
	onToggleCollapse: () => void;
	onToggleDone: (id: string) => void;
	onQueue: (id: string, queue: TaskQueue) => void;
	onEdit: (id: string, title: string) => void;
	onPatch: (id: string, patch: Partial<Item>) => void;
	onMoveToSpace: (id: string, spaceId: string) => void;
	onDelete: (id: string) => void;
	onOpen: (id: string) => void;
	onFocus: (task: Item) => void;
	onStartBlitz: () => void;
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
									spaces={spaces}
									tags={tags}
									onToggleDone={onToggleDone}
									onQueue={onQueue}
									onEdit={onEdit}
									onPatch={onPatch}
									onMoveToSpace={onMoveToSpace}
									onDelete={onDelete}
									onOpen={() => onOpen(task.id)}
									onFocus={() => onFocus(task)}
									onStartBlitz={() => {
										onFocus(task);
										onStartBlitz();
									}}
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

function InlineSpacePill({
	spaces,
	spaceId,
	onChange,
}: {
	spaces: Space[];
	spaceId: string;
	onChange: (spaceId: string) => void;
}) {
	const active = spaces.find((space) => space.id === spaceId);
	const activeAccent = active ? SPACE_ACCENT_CLASSES[active.color] : "bg-line text-ink-dim";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<button
						type="button"
						className="flex h-6 max-w-[170px] items-center gap-1.5 rounded-[5px] border border-line-soft bg-base px-2 font-bold text-[10px] text-ink-muted transition-colors hover:border-line-strong hover:text-ink-2"
					/>
				}
			>
				<span className={cn("grid size-3.5 place-items-center rounded-[3px] text-[9px] leading-none", activeAccent)}>
					<SpaceIcon icon={active?.icon ?? "sparkles"} className="size-2.5" />
				</span>
				<span className="truncate">{active?.name ?? "Group"}</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				className="w-56 border border-line-2 bg-panel p-1 text-ink-2"
			>
				{spaces.map((space) => (
					<DropdownMenuItem
						key={space.id}
						onClick={() => onChange(space.id)}
						className="justify-between"
					>
						<span className="flex min-w-0 items-center gap-2">
							<span className={cn("grid size-4 place-items-center rounded-[4px] text-[10px] leading-none", SPACE_ACCENT_CLASSES[space.color])}>
								<SpaceIcon icon={space.icon} className="size-3" />
							</span>
							<span className="truncate">{space.name}</span>
						</span>
						{space.id === spaceId ? <Icons.check className="size-3.5 text-brand" /> : null}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function InlinePriorityPill({
	priority,
	onChange,
	onClear,
}: {
	priority?: Priority;
	onChange: (priority: Priority) => void;
	onClear: () => void;
}) {
	const label = priority ? `P${priority}` : "Priority";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<button
						type="button"
						className={cn(
							"flex h-6 items-center gap-1.5 rounded-[5px] border px-2 font-bold text-[10px] transition-colors",
							priority
								? PRIORITY_META_CLASSES[priority]
								: "border-line-soft bg-base text-done hover:border-line-strong hover:text-ink-2",
						)}
					/>
				}
			>
				<Icons.flag className="size-3" />
				{label}
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				className="w-40 border border-line-2 bg-panel p-1 text-ink-2"
			>
				{([1, 2, 3] as Priority[]).map((p) => (
					<DropdownMenuItem
						key={p}
						onClick={() => onChange(p)}
						className="justify-between"
					>
						<span className={cn("rounded-[4px] px-1.5 py-0.5 font-bold text-[10px]", PRIORITY_META_CLASSES[p])}>
							P{p}
						</span>
						{priority === p ? <Icons.check className="size-3.5 text-brand" /> : null}
					</DropdownMenuItem>
				))}
				<DropdownMenuSeparator className="my-1 bg-line" />
				<DropdownMenuItem onClick={onClear}>Clear priority</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function InlineDuePill({
	dueAt,
	overdue = false,
	onChange,
	open,
	onOpenChange,
}: {
	dueAt?: string;
	overdue?: boolean;
	onChange: (dueAt?: string) => void;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}) {
	const dueDate = dueAt ? parseTaskDueDate(dueAt) : undefined;
	const dueHasTime = hasDueTime(dueAt);
	const dueLabel = dueAt && dueDate ? formatDueShort(dueDate, dueHasTime) : "Schedule";

	return (
		<PopoverRoot open={open} onOpenChange={onOpenChange}>
			<PopoverTrigger
				render={
					<button
						type="button"
						title={overdue ? "Overdue" : undefined}
						className={cn(
							"flex h-6 items-center gap-1.5 rounded-[5px] border px-2 font-mono font-bold text-[10px] transition-colors",
							overdue
								? "border-coral/40 bg-coral/12 text-coral hover:border-coral/60"
								: dueAt
									? "border-honey/30 bg-amber/12 text-honey hover:border-honey/50"
									: "border-line-soft bg-base text-done hover:border-line-strong hover:text-ink-2",
						)}
					/>
				}
			>
				{dueHasTime ? <Icons.clock className="size-3" /> : <Icons.calendar className="size-3" />}
				{dueLabel}
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0">
				<Calendar
					mode="single"
					selected={dueDate}
					onSelect={(date) => {
						if (!date) {
							onChange(undefined);
							return;
						}
						const next = new Date(date);
						if (dueHasTime && dueDate) {
							next.setHours(dueDate.getHours(), dueDate.getMinutes(), 0, 0);
							onChange(next.toISOString());
							return;
						}
						onChange(toDateInputValue(next));
					}}
				/>
				<div className="border-surface border-t px-3 py-2">
					<div className="mb-2 flex gap-1.5">
						<button
							type="button"
							onClick={() => onChange(quickDate(0))}
							className="h-7 rounded-[5px] border border-line-2 px-2 text-ink-muted text-xs hover:text-ink-2"
						>
							Today
						</button>
						<button
							type="button"
							onClick={() => onChange(quickDate(1))}
							className="h-7 rounded-[5px] border border-line-2 px-2 text-ink-muted text-xs hover:text-ink-2"
						>
							Tomorrow
						</button>
					</div>
					<label className="flex items-center justify-between gap-3 text-ink-muted text-xs">
						<span>Time</span>
						<input
							type="time"
							value={dueDate && dueHasTime ? toTimeInputValue(dueDate) : ""}
							onChange={(event) => {
								if (!event.target.value) {
									if (dueDate) onChange(toDateInputValue(dueDate));
									return;
								}
								const [hours, minutes] = event.target.value.split(":").map(Number);
								const next = dueDate ? new Date(dueDate) : new Date();
								next.setHours(hours ?? 0, minutes ?? 0, 0, 0);
								onChange(next.toISOString());
							}}
							className="h-7 rounded-[5px] border border-line-2 bg-base px-2 font-mono text-ink text-xs outline-none focus:border-line-max"
						/>
					</label>
					<p className="mt-1.5 text-ink-ghost text-[10px]">Indonesia time (WIB)</p>
					<div className="mt-2 flex gap-2">
						<button
							type="button"
							disabled={!dueDate || !dueHasTime}
							onClick={() => dueDate && onChange(toDateInputValue(dueDate))}
							className="text-ink-muted text-xs hover:text-ink-2 disabled:text-line-strong"
						>
							Clear time
						</button>
						<button
							type="button"
							disabled={!dueAt}
							onClick={() => onChange(undefined)}
							className="text-ink-muted text-xs hover:text-ink-2 disabled:text-line-strong"
						>
							Clear due
						</button>
					</div>
				</div>
			</PopoverContent>
		</PopoverRoot>
	);
}

function formatDueShort(date: Date, hasTime: boolean) {
	const today = new Date();
	const tomorrow = new Date();
	tomorrow.setDate(today.getDate() + 1);
	const time = hasTime ? formatIndonesiaTime(date) : "";

	if (date.toDateString() === today.toDateString()) return hasTime ? `Today ${time}` : "Today";
	if (date.toDateString() === tomorrow.toDateString()) return hasTime ? `Tmrw ${time}` : "Tmrw";
	const day = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
	return hasTime ? `${day} ${time}` : day;
}

function formatIndonesiaTime(date: Date) {
	return date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		timeZone: "Asia/Jakarta",
	});
}

function TaskMoreMenu({
	task,
	spaces,
	tags,
	onPatch,
	onMoveToSpace,
	onQueue,
	onOpen,
	onFocus,
	onStartBlitz,
	onDelete,
}: {
	task: Item;
	spaces: Space[];
	tags: string[];
	onPatch: (patch: Partial<Item>) => void;
	onMoveToSpace: (spaceId: string) => void;
	onQueue: (queue: TaskQueue) => void;
	onOpen: () => void;
	onFocus: () => void;
	onStartBlitz: () => void;
	onDelete: () => void;
}) {
	const dueDate = task.dueAt ? parseTaskDueDate(task.dueAt) : undefined;
	const dueHasTime = hasDueTime(task.dueAt);

	const setDueTime = (value: string) => {
		if (!value) {
			if (dueDate) onPatch({ dueAt: toDateInputValue(dueDate) });
			return;
		}
		const [hours, minutes] = value.split(":").map(Number);
		const next = dueDate ? new Date(dueDate) : new Date();
		next.setHours(hours ?? 0, minutes ?? 0, 0, 0);
		onPatch({ dueAt: next.toISOString() });
	};

	const toggleTag = (tag: string, checked: boolean) => {
		const current = task.tags ?? [];
		onPatch({ tags: checked ? [...new Set([...current, tag])] : current.filter((item) => item !== tag) });
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<button
						type="button"
						title="Task actions"
						className="grid size-7 place-items-center rounded-[6px] text-ink-muted hover:bg-fill hover:text-ink"
					/>
				}
			>
				<Icons.moreHorizontal className="size-4" />
				<span className="sr-only">Task actions</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="w-64 border border-line-2 bg-panel p-1 text-ink-2"
			>
				<DropdownMenuItem onClick={onOpen} className="justify-between">
					<span className="flex items-center gap-2">
						<Icons.arrowUpRight className="size-4 text-ink-dim" />
						Open details
					</span>
				</DropdownMenuItem>
				<DropdownMenuItem onClick={onFocus}>
					<Icons.target className="size-4 text-brand" />
					Focus today
				</DropdownMenuItem>
				<DropdownMenuItem onClick={onStartBlitz}>
					<Icons.timer className="size-4 text-brand" />
					Start Blitz
				</DropdownMenuItem>

				<DropdownMenuSeparator className="my-1 bg-line" />

				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						<Icons.flag className="size-4 text-ink-dim" />
						Priority
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent className="w-36 border border-line-2 bg-panel p-1 text-ink-2">
						{([1, 2, 3] as Priority[]).map((priority) => (
							<DropdownMenuItem
								key={priority}
								onClick={() => onPatch({ priority })}
								className="justify-between"
							>
								P{priority}
								{task.priority === priority ? <Icons.check className="size-3.5 text-brand" /> : null}
							</DropdownMenuItem>
						))}
						<DropdownMenuSeparator className="my-1 bg-line" />
						<DropdownMenuItem onClick={() => onPatch({ priority: undefined })}>
							Clear priority
						</DropdownMenuItem>
					</DropdownMenuSubContent>
				</DropdownMenuSub>

				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						<Icons.calendar className="size-4 text-ink-dim" />
						Due date
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent className="w-48 border border-line-2 bg-panel p-1 text-ink-2">
						<DropdownMenuItem onClick={() => onPatch({ dueAt: quickDate(0) })}>
							Today
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => onPatch({ dueAt: quickDate(1) })}>
							Tomorrow
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => onPatch({ dueAt: nextWeekDate() })}>
							Next week
						</DropdownMenuItem>
						<div className="px-2 py-2">
							<label className="flex items-center justify-between gap-3 text-ink-muted text-xs">
								<span>Time</span>
								<input
									type="time"
									value={dueDate && dueHasTime ? toTimeInputValue(dueDate) : ""}
									onClick={(event) => event.stopPropagation()}
									onKeyDown={(event) => event.stopPropagation()}
									onChange={(event) => setDueTime(event.target.value)}
									className="h-7 rounded-[5px] border border-line-2 bg-base px-2 font-mono text-ink text-xs outline-none focus:border-line-max"
								/>
							</label>
						</div>
						<DropdownMenuSeparator className="my-1 bg-line" />
						<DropdownMenuItem onClick={() => onPatch({ dueAt: undefined })}>
							Clear due
						</DropdownMenuItem>
					</DropdownMenuSubContent>
				</DropdownMenuSub>

				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						<Icons.briefcase className="size-4 text-ink-dim" />
						Move
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent className="w-52 border border-line-2 bg-panel p-1 text-ink-2">
						<DropdownLabel>Group</DropdownLabel>
						{spaces.map((space) => (
							<DropdownMenuItem
								key={space.id}
								onClick={() => onMoveToSpace(space.id)}
								className="justify-between"
							>
								<span className="truncate">{space.name}</span>
								{task.spaceId === space.id ? <Icons.check className="size-3.5 text-brand" /> : null}
							</DropdownMenuItem>
						))}
						<DropdownMenuSeparator className="my-1 bg-line" />
						<DropdownLabel>Lane</DropdownLabel>
						{ACTIVE_SECTIONS.map((queue) => (
							<DropdownMenuItem
								key={queue}
								onClick={() => onQueue(queue)}
								className="justify-between"
							>
								{sectionLabel(queue)}
								{sectionOf(task) === queue ? <Icons.check className="size-3.5 text-brand" /> : null}
							</DropdownMenuItem>
						))}
					</DropdownMenuSubContent>
				</DropdownMenuSub>

				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						<Icons.hash className="size-4 text-ink-dim" />
						Tags
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent className="w-48 border border-line-2 bg-panel p-1 text-ink-2">
						{tags.length === 0 ? (
							<div className="px-2 py-2 text-ink-ghost text-xs">No tags yet</div>
						) : (
							tags.map((tag) => (
								<DropdownMenuCheckboxItem
									key={tag}
									checked={task.tags?.includes(tag) ?? false}
									onCheckedChange={(checked) => toggleTag(tag, checked)}
								>
									#{tag}
								</DropdownMenuCheckboxItem>
							))
						)}
					</DropdownMenuSubContent>
				</DropdownMenuSub>

				<DropdownMenuSeparator className="my-1 bg-line" />
				<DropdownMenuItem
					variant="destructive"
					onClick={onDelete}
					className="text-coral focus:bg-coral/10 focus:text-coral"
				>
					<Icons.trash className="size-4" />
					Delete
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
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
	const [open, setOpen] = useState(false);

	return (
		<div className="relative">
			<Button
				type="button"
				variant="ghost"
				onClick={() => setOpen((value) => !value)}
				className="size-9 rounded-[8px] border border-white/10 bg-white/[0.03] p-0 text-ink-3 hover:text-white"
			>
				<Icons.settings className="size-4" />
				<span className="sr-only">Customize Blitz</span>
			</Button>
			{open ? (
				<>
					{/* Outside-click catcher (kept within the dialog DOM so it isn't inert). */}
					<button
						type="button"
						aria-hidden
						tabIndex={-1}
						onClick={() => setOpen(false)}
						className="fixed inset-0 z-[60] cursor-default"
					/>
					<div className="absolute top-[calc(100%+8px)] right-0 z-[70] w-72 rounded-[12px] border border-line-2 bg-panel p-4 text-white shadow-[0_8px_24px_-6px_rgba(0,0,0,0.5)]">
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
					</div>
				</>
			) : null}
		</div>
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

function DragGripGlyph() {
	return (
		<span className="grid grid-cols-2 gap-[2px]" aria-hidden>
			{Array.from({ length: 6 }).map((_, index) => (
				<span key={index} className="size-[2.5px] rounded-full bg-current" />
			))}
		</span>
	);
}

function SortableTaskCard({
	task,
	spaces,
	tags,
	onToggleDone,
	onQueue,
	onEdit,
	onPatch,
	onMoveToSpace,
	onDelete,
	onOpen,
	onFocus,
	onStartBlitz,
	focused,
}: {
	task: Item;
	spaces: Space[];
	tags: string[];
	onToggleDone: (id: string) => void;
	onQueue: (id: string, queue: TaskQueue) => void;
	onEdit: (id: string, title: string) => void;
	onPatch: (id: string, patch: Partial<Item>) => void;
	onMoveToSpace: (id: string, spaceId: string) => void;
	onDelete: (id: string) => void;
	onOpen: () => void;
	onFocus: () => void;
	onStartBlitz: () => void;
	focused: boolean;
}) {
	const [editing, setEditing] = useState(false);
	const [draftTitle, setDraftTitle] = useState(taskTitle(task));
	const inputRef = useRef<HTMLInputElement>(null);
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: task.id,
		disabled: task.done || editing,
	});
	const currentTitle = taskTitle(task);
	const overdue = !task.done && isOverdue(task.dueAt);

	useEffect(() => {
		if (!editing) setDraftTitle(currentTitle);
	}, [currentTitle, editing]);

	useEffect(() => {
		if (editing) inputRef.current?.select();
	}, [editing]);

	const startEdit = () => {
		setDraftTitle(currentTitle);
		setEditing(true);
	};

	const cancelEdit = () => {
		setDraftTitle(currentTitle);
		setEditing(false);
	};

	const saveEdit = () => {
		const nextTitle = draftTitle.trim();
		if (nextTitle && nextTitle !== currentTitle) onEdit(task.id, nextTitle);
		setEditing(false);
	};

	useEffect(() => {
		if (!editing) return;
		const nextTitle = draftTitle.trim();
		if (!nextTitle || nextTitle === currentTitle) return;
		const timeout = window.setTimeout(() => onEdit(task.id, nextTitle), 650);
		return () => window.clearTimeout(timeout);
	}, [currentTitle, draftTitle, editing, onEdit, task.id]);

	return (
		<article
			ref={setNodeRef}
			style={{ transform: CSS.Transform.toString(transform), transition }}
			className={cn(
				"group/task rounded-[8px] border border-line bg-surface px-3.5 py-3 text-left shadow-sm",
				"transition-colors hover:border-line-strong hover:bg-fill",
				overdue && "border-l-[3px] border-l-coral",
				focused && "border-brand bg-brand-surface shadow-[0_0_0_1px_rgba(144,124,232,0.22)]",
				isDragging && "opacity-60",
				task.done && "opacity-70",
			)}
		>
			<div className="flex items-start gap-2">
				{!task.done ? (
					<button
						type="button"
						{...attributes}
						{...listeners}
						title="Drag to reorder or move"
						aria-label="Drag to reorder or move"
						className="mt-0.5 grid size-6 shrink-0 cursor-grab touch-none place-items-center rounded-[5px] text-ink-faint opacity-0 transition-opacity hover:bg-fill hover:text-ink-muted focus-visible:opacity-100 active:cursor-grabbing group-hover/task:opacity-100"
					>
						<DragGripGlyph />
					</button>
				) : null}
				<span onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
					<Checkbox
						checked={task.done}
						onCheckedChange={() => onToggleDone(task.id)}
						className="mt-0.5 rounded-full"
					/>
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex min-w-0 items-start gap-1.5">
						{editing ? (
							<Input
								ref={inputRef}
								value={draftTitle}
								onPointerDown={(event) => event.stopPropagation()}
								onClick={(event) => event.stopPropagation()}
								onChange={(event) => setDraftTitle(event.target.value)}
								onBlur={saveEdit}
								onKeyDown={(event) => {
									if (event.key === "Enter") {
										event.preventDefault();
										saveEdit();
									}
									if (event.key === "Escape") {
										event.preventDefault();
										cancelEdit();
									}
								}}
								aria-label="Task title"
								className="h-7 min-w-0 flex-1 rounded-[6px] border-line-strong bg-sunken px-2 py-1 font-semibold text-ink-bright text-sm focus-visible:ring-1 focus-visible:ring-brand"
							/>
						) : (
							<button
								type="button"
								onPointerDown={(event) => event.stopPropagation()}
								onClick={(event) => {
									event.stopPropagation();
									startEdit();
								}}
								className={cn(
									"block min-w-0 flex-1 truncate text-left font-semibold text-ink-bright text-sm hover:text-white",
									task.done && "text-done line-through",
								)}
							>
								{currentTitle}
							</button>
						)}
						<div
							onPointerDown={(event) => event.stopPropagation()}
							onClick={(event) => event.stopPropagation()}
							className="flex shrink-0 items-center gap-0.5"
						>
							{editing ? (
								<button
									type="button"
									onPointerDown={(event) => {
										event.preventDefault();
										event.stopPropagation();
									}}
									onClick={cancelEdit}
									title="Cancel edit"
									className="grid size-7 place-items-center rounded-[6px] text-ink-muted hover:bg-fill hover:text-ink"
								>
									<Icons.x className="size-3.5" />
								</button>
							) : (
								<TaskMoreMenu
									task={task}
									spaces={spaces}
									tags={tags}
									onPatch={(patch) => onPatch(task.id, patch)}
									onMoveToSpace={(spaceId) => onMoveToSpace(task.id, spaceId)}
									onQueue={(queue) => onQueue(task.id, queue)}
									onOpen={onOpen}
									onFocus={onFocus}
									onStartBlitz={onStartBlitz}
									onDelete={() => onDelete(task.id)}
								/>
							)}
						</div>
					</div>
					<div
						onPointerDown={(event) => event.stopPropagation()}
						onClick={(event) => event.stopPropagation()}
						className="mt-2 flex flex-wrap items-center gap-1.5"
					>
						{focused ? (
							<span className="flex h-6 items-center gap-1 rounded-[5px] border border-brand/35 bg-brand-surface px-2 font-bold text-[10px] text-brand-soft">
								<Icons.target className="size-3" />
								Focused
							</span>
						) : null}
						<InlineSpacePill
							spaces={spaces}
							spaceId={task.spaceId}
							onChange={(spaceId) => onMoveToSpace(task.id, spaceId)}
						/>
						<InlineDuePill
							dueAt={task.dueAt}
							overdue={overdue}
							onChange={(dueAt) => onPatch(task.id, { dueAt })}
						/>
						<InlinePriorityPill
							priority={task.priority}
							onChange={(priority) => onPatch(task.id, { priority })}
							onClear={() => onPatch(task.id, { priority: undefined })}
						/>
						{task.tags?.slice(0, 2).map((tag) => (
							<span key={tag} className="rounded-[5px] bg-brand-surface px-1.5 py-0.5 text-brand-soft text-[10px]">
								#{tag}
							</span>
						))}
					</div>
				</div>
			</div>
		</article>
	);
}
