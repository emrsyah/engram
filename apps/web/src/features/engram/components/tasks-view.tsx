"use client";

import { Button } from "@alphonse/ui/components/button";
import { Checkbox } from "@alphonse/ui/components/checkbox";
import { Input } from "@alphonse/ui/components/input";
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
import { useMemo, useState } from "react";

import { taskQueueOf } from "../projections";
import { useEngramStore } from "../store";
import type { Item, Space, TaskQueue } from "../types";
import { useUIStore } from "../ui-store";
import { DueChip, PriorityChip } from "./chips";
import { Icons } from "./icons";

type TaskFilter =
	| { kind: "all"; value: "all" }
	| { kind: "group"; value: string }
	| { kind: "tag"; value: string };

type LayoutMode = "columns" | "stacked";
type PlanningSectionId = "later" | "next" | "now";
type SectionId = PlanningSectionId | "done";

const SECTIONS: { id: SectionId; label: string; hint: string }[] = [
	{ id: "later", label: "Backlog", hint: "Captured, not planned yet" },
	{ id: "next", label: "This week", hint: "Worth doing soon" },
	{ id: "now", label: "Today", hint: "Ordered focus list" },
];

const DONE_SECTION = { id: "done" as const, label: "Done", hint: "Completed tasks" };
const ACTIVE_SECTIONS: PlanningSectionId[] = ["later", "next", "now"];

function taskTitle(task: Item) {
	return task.title ?? task.text ?? "Untitled task";
}

function sortTasks(tasks: Item[]) {
	return [...tasks].sort((a, b) => {
		if (a.done !== b.done) return a.done ? 1 : -1;
		const orderA = a.taskSortOrder ?? Number.MAX_SAFE_INTEGER;
		const orderB = b.taskSortOrder ?? Number.MAX_SAFE_INTEGER;
		if (orderA !== orderB) return orderA - orderB;
		return a.createdAt.localeCompare(b.createdAt);
	});
}

function sectionOf(task: Item): SectionId {
	const queue = taskQueueOf(task);
	if (task.done) return "done";
	return queue === "waiting" ? "later" : (queue as PlanningSectionId);
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

export function TasksView() {
	const { allTaskItems, allTags, createItem, spaces, setTaskQueue, toggleDone, updateItem } =
		useEngramStore();
	const { openDetail } = useUIStore();
	const [filter, setFilter] = useState<TaskFilter>({ kind: "all", value: "all" });
	const [layoutMode, setLayoutMode] = useState<LayoutMode>("columns");
	const [newTask, setNewTask] = useState("");
	const [focusedTaskId, setFocusedTaskId] = useState<string>();

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	const defaultSpaceId = spaces[0]?.id;
	const taskTags = allTags.filter((tag) => allTaskItems.some((task) => task.tags?.includes(tag)));

	const visibleTasks = useMemo(() => {
		const tasks =
			filter.kind === "group"
				? allTaskItems.filter((task) => task.spaceId === filter.value)
				: filter.kind === "tag"
					? allTaskItems.filter((task) => task.tags?.includes(filter.value))
					: allTaskItems;
		return sortTasks(tasks);
	}, [allTaskItems, filter]);

	const tasksBySection = useMemo(() => {
		const map = new Map<SectionId, Item[]>(SECTIONS.map((section) => [section.id, []]));
		map.set("done", []);
		for (const task of visibleTasks) {
			const key = sectionOf(task);
			map.set(key, [...(map.get(key) ?? []), task]);
		}
		for (const [key, tasks] of map) map.set(key, sortTasks(tasks));
		return map;
	}, [visibleTasks]);

	const addTask = () => {
		const title = newTask.trim();
		if (!title || !defaultSpaceId) return;
		createItem({
			type: "task",
			title,
			taskQueue: "later",
			spaceId: defaultSpaceId,
			stayOnCurrentView: true,
		});
		setNewTask("");
	};

	const focusedTask = focusedTaskId
		? allTaskItems.find((task) => task.id === focusedTaskId && !task.done)
		: undefined;

	const focusTask = (task: Item) => {
		if (task.done) return;
		const todayTasks = sortTasks(
			allTaskItems.filter((item) => item.id !== task.id && !item.done && sectionOf(item) === "now"),
		);
		for (const [index, item] of todayTasks.entries()) {
			updateItem(item.id, { taskSortOrder: index + 1 });
		}
		setTaskQueue(task.id, "now", 0);
		setFocusedTaskId(task.id);
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
		<section className="flex h-full bg-[#151310] text-white">
			<TaskSecondSidebar
				filter={filter}
				onFilter={setFilter}
				spaces={spaces}
				tasks={allTaskItems}
				tags={taskTags}
			/>

			<div className="min-w-0 flex-1 overflow-y-auto px-5 py-7 lg:px-8">
				<div className="mx-auto max-w-[1280px]">
					<div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
						<div>
							<h2 className="flex items-center gap-3 font-bold text-3xl">
								<Icons.square className="size-7 text-[#9b88ff]" />
								Tasks
							</h2>
							<p className="mt-2 max-w-2xl text-[#a99f93] text-sm">
								Capture to Backlog, plan into This week, and keep Today small and ordered.
							</p>
						</div>

						<div className="flex flex-wrap items-center gap-2">
							<div className="rounded-[8px] bg-[#23201d] p-1">
								{(["columns", "stacked"] as LayoutMode[]).map((mode) => (
									<button
										key={mode}
										type="button"
										onClick={() => setLayoutMode(mode)}
										className={cn(
											"h-8 rounded-[6px] px-3 font-semibold text-sm capitalize",
											layoutMode === mode
												? "bg-[#312d28] text-white"
												: "text-[#948c82] hover:text-white",
										)}
									>
										{mode}
									</button>
								))}
							</div>
						</div>
					</div>

					<div className="mt-6 flex gap-2 rounded-[9px] border border-[#2a2621] bg-[#1b1815] p-2">
						<Input
							value={newTask}
							onChange={(event) => setNewTask(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") addTask();
							}}
							placeholder="Add to Backlog..."
							className="h-10 border-0 bg-transparent text-[#f0ebe3] placeholder:text-[#6b6460] focus-visible:ring-0"
						/>
						<Button
							type="button"
							onClick={addTask}
							className="h-10 rounded-[7px] bg-[#907ce8] px-4 font-bold text-[#17131f] hover:bg-[#a08ef2]"
						>
							<Icons.plus className="size-4" />
							Add
						</Button>
					</div>

					{focusedTask ? (
						<div className="mt-4 flex items-center gap-3 rounded-[9px] border border-[#4b4168] bg-[#201b2d] px-4 py-3">
							<Icons.target className="size-5 shrink-0 text-[#c7bcff]" />
							<div className="min-w-0 flex-1">
								<p className="text-[#8f84b8] text-xs font-bold uppercase tracking-[0.14em]">Focused task</p>
								<p className="truncate font-bold text-[#f0ebe3]">{taskTitle(focusedTask)}</p>
							</div>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => setFocusedTaskId(undefined)}
								className="h-8 rounded-[6px] px-3 text-[#a69acb] hover:text-white"
							>
								Clear
							</Button>
						</div>
					) : null}

					<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
						<div
							className={cn(
								"mt-6 gap-4",
								layoutMode === "columns"
									? "grid min-w-[780px] grid-cols-3"
									: "grid grid-cols-1",
							)}
						>
							{SECTIONS.map((section) => (
								<TaskSection
									key={section.id}
									section={section}
									tasks={tasksBySection.get(section.id) ?? []}
									spaces={spaces}
									onToggleDone={toggleDone}
									onQueue={setTaskQueue}
									onOpen={openDetail}
									onFocus={focusTask}
									focusedTaskId={focusedTaskId}
								/>
							))}
						</div>
					</DndContext>

					<DoneArchive
						tasks={tasksBySection.get("done") ?? []}
						spaces={spaces}
						onToggleDone={toggleDone}
						onOpen={openDetail}
					/>
				</div>
			</div>
		</section>
	);
}

function TaskSecondSidebar({
	filter,
	onFilter,
	spaces,
	tasks,
	tags,
}: {
	filter: TaskFilter;
	onFilter: (filter: TaskFilter) => void;
	spaces: Space[];
	tasks: Item[];
	tags: string[];
}) {
	return (
		<aside className="hidden w-[248px] shrink-0 overflow-y-auto border-[#292622] border-r bg-[#100f0d] px-3 py-5 lg:block">
			<SidebarButton
				active={filter.kind === "all"}
				label="All tasks"
				count={tasks.length}
				icon={<Icons.square className="size-4" />}
				onClick={() => onFilter({ kind: "all", value: "all" })}
			/>

			<SidebarSection title="Groups">
				{spaces.map((space) => (
					<SidebarButton
						key={space.id}
						active={filter.kind === "group" && filter.value === space.id}
						label={space.name}
						count={tasks.filter((task) => task.spaceId === space.id).length}
						icon={<Icons.book className="size-4" />}
						onClick={() => onFilter({ kind: "group", value: space.id })}
					/>
				))}
			</SidebarSection>

			<SidebarSection title="Tags">
				{tags.length === 0 ? (
					<p className="px-3 py-2 text-[#5f574f] text-xs">No task tags yet</p>
				) : (
					tags.map((tag) => (
						<SidebarButton
							key={tag}
							active={filter.kind === "tag" && filter.value === tag}
							label={`#${tag}`}
							count={tasks.filter((task) => task.tags?.includes(tag)).length}
							icon={<Icons.flag className="size-4" />}
							onClick={() => onFilter({ kind: "tag", value: tag })}
						/>
					))
				)}
			</SidebarSection>
		</aside>
	);
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="mt-6">
			<p className="mb-2 px-3 font-bold text-[#736c63] text-[11px] uppercase tracking-[0.14em]">
				{title}
			</p>
			<div className="space-y-1">{children}</div>
		</div>
	);
}

function SidebarButton({
	active,
	label,
	count,
	icon,
	onClick,
}: {
	active: boolean;
	label: string;
	count: number;
	icon: React.ReactNode;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"flex w-full items-center gap-3 rounded-[7px] px-3 py-2 text-left text-sm transition-colors",
				active ? "bg-[#22201f] text-white" : "text-[#b7afa5] hover:bg-[#171614] hover:text-white",
			)}
		>
			<span className="text-[#907ce8]">{icon}</span>
			<span className="min-w-0 flex-1 truncate font-semibold">{label}</span>
			<span className="rounded-[5px] bg-[#252220] px-1.5 py-0.5 font-mono text-[#82786e] text-[11px]">
				{count}
			</span>
		</button>
	);
}

function TaskSection({
	section,
	tasks,
	spaces,
	onToggleDone,
	onQueue,
	onOpen,
	onFocus,
	focusedTaskId,
}: {
	section: { id: SectionId; label: string; hint: string };
	tasks: Item[];
	spaces: Space[];
	onToggleDone: (id: string) => void;
	onQueue: (id: string, queue: TaskQueue) => void;
	onOpen: (id: string) => void;
	onFocus: (task: Item) => void;
	focusedTaskId?: string;
}) {
	const { setNodeRef, isOver } = useDroppable({ id: columnId(section.id) });

	return (
		<section
			ref={setNodeRef}
			className={cn(
				"min-h-[300px] rounded-[9px] border bg-[#151412]",
				isOver ? "border-[#907ce8] bg-[#191620]" : "border-[#26221e]",
			)}
		>
			<header className="border-[#26221e] border-b px-4 py-3">
				<div className="flex items-center justify-between gap-3">
					<div className="min-w-0">
						<h3 className="truncate font-bold text-[#efe9df] text-lg">{section.label}</h3>
						<p className="mt-0.5 truncate text-[#70685f] text-xs">{section.hint}</p>
					</div>
					<span className="rounded-[5px] bg-[#252220] px-1.5 py-0.5 font-mono text-[#82786e] text-[11px]">
						{tasks.length}
					</span>
				</div>
			</header>
			<SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
				<div className="space-y-2 p-3">
					{tasks.length === 0 ? (
						<div className="rounded-[7px] border border-dashed border-[#302c27] px-3 py-8 text-center text-[#5f574f] text-sm">
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
		</section>
	);
}

function DoneArchive({
	tasks,
	spaces,
	onToggleDone,
	onOpen,
}: {
	tasks: Item[];
	spaces: Space[];
	onToggleDone: (id: string) => void;
	onOpen: (id: string) => void;
}) {
	if (tasks.length === 0) return null;

	return (
		<section className="mt-6 rounded-[9px] border border-[#211e1b] bg-[#11100f] opacity-75">
			<header className="flex items-center justify-between border-[#211e1b] border-b px-4 py-2.5">
				<div>
					<h3 className="font-bold text-[#8f877d]">Done</h3>
					<p className="text-[#5f574f] text-xs">Completed tasks stay out of the planning lanes.</p>
				</div>
				<span className="rounded-[5px] bg-[#201d19] px-1.5 py-0.5 font-mono text-[#6d655c] text-[11px]">
					{tasks.length}
				</span>
			</header>
			<div className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-3">
				{sortTasks(tasks).map((task) => (
					<div
						key={task.id}
						className="flex items-start gap-2.5 rounded-[7px] border border-[#24211e] bg-[#191714] px-3 py-2"
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
								className="block max-w-full truncate text-left font-semibold text-[#746d66] text-sm line-through hover:text-[#9f968d]"
							>
								{taskTitle(task)}
							</button>
							<p className="mt-1 truncate text-[#5d554e] text-[10px]">
								{spaceName(spaces, task.spaceId)}
							</p>
						</div>
					</div>
				))}
			</div>
		</section>
	);
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

	return (
		<article
			ref={setNodeRef}
			style={{ transform: CSS.Transform.toString(transform), transition }}
			{...attributes}
			{...listeners}
			className={cn(
				"cursor-grab rounded-[7px] border border-[#2a2621] bg-[#201d19] px-3 py-2.5 text-left shadow-sm",
				"transition-colors hover:border-[#3a3530] hover:bg-[#25211d] active:cursor-grabbing",
				focused && "border-[#907ce8] bg-[#241f33]",
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
							"block max-w-full truncate text-left font-semibold text-[#f0ebe3] text-sm hover:text-white",
							task.done && "text-[#655e56] line-through",
						)}
					>
						{taskTitle(task)}
					</button>
					<div className="mt-1.5 flex flex-wrap items-center gap-1.5">
						<span className="rounded-[5px] bg-[#2a2621] px-1.5 py-0.5 text-[#82786e] text-[10px]">
							{groupName}
						</span>
						<PriorityChip priority={task.priority} />
						<DueChip dueAt={task.dueAt} />
						{task.tags?.slice(0, 2).map((tag) => (
							<span key={tag} className="rounded-[5px] bg-[#242036] px-1.5 py-0.5 text-[#c7bcff] text-[10px]">
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
					className="mt-2 flex flex-wrap gap-1"
				>
					{ACTIVE_SECTIONS.map((queue) => (
						<button
							key={queue}
							type="button"
							onClick={() => onQueue(task.id, queue)}
							className={cn(
								"rounded-[5px] px-2 py-0.5 font-semibold text-[10px]",
								taskQueueOf(task) === queue
									? "bg-[#907ce8] text-[#17131f]"
									: "bg-[#2a2621] text-[#82786e] hover:text-[#d8d0c5]",
							)}
						>
							{sectionLabel(queue)}
						</button>
					))}
					<button
						type="button"
						onClick={onFocus}
						className={cn(
							"ml-auto rounded-[5px] px-2 py-0.5 font-semibold text-[10px]",
							focused
								? "bg-[#c7bcff] text-[#17131f]"
								: "bg-[#2b2540] text-[#c7bcff] hover:text-white",
						)}
					>
						Focus
					</button>
				</div>
			) : null}
		</article>
	);
}
