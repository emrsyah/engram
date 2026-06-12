"use client";

import { Button } from "@alphonse/ui/components/button";
import { Checkbox } from "@alphonse/ui/components/checkbox";
import { Input } from "@alphonse/ui/components/input";
import { Tabs, TabsList, TabsTrigger } from "@alphonse/ui/components/tabs";
import { cn } from "@alphonse/ui/lib/utils";
import { useRef, useState } from "react";

import { DueChip, PriorityChip } from "./chips";
import { ChevronDown, ChevronRight, Icons } from "./icons";
import { SPACE_ICONS, type SpaceIconKey } from "../nav";
import { todayPrefix } from "../projections";
import { useEngramStore } from "../store";
import type { Item, Priority } from "../types";
import type { DueBucket } from "../projections";

// ─── Priority group config ────────────────────────────────────────────────────

const PRIORITY_GROUPS: { priority: Priority | undefined; label: string }[] = [
	{ priority: 1, label: "Critical" },
	{ priority: 2, label: "Important" },
	{ priority: 3, label: "Eventually" },
	{ priority: undefined, label: "No priority" },
];

// ─── Due group config ─────────────────────────────────────────────────────────

const DUE_BUCKETS: { bucket: DueBucket; label: string; overdue?: boolean }[] = [
	{ bucket: "overdue", label: "Overdue", overdue: true },
	{ bucket: "today", label: "Today" },
	{ bucket: "upcoming", label: "Upcoming" },
	{ bucket: "someday", label: "Someday" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sortTasksWithDoneAtBottom(tasks: Item[]): Item[] {
	return [...tasks].sort((a, b) => {
		if (a.done !== b.done) return a.done ? 1 : -1;
		return a.createdAt.localeCompare(b.createdAt);
	});
}

// ─── Main view ────────────────────────────────────────────────────────────────

type GroupBy = "space" | "priority" | "due";

export function TasksView() {
	const {
		groupTasksBySpace,
		groupTasksByPriority,
		groupTasksByDue,
		spaces,
		jumpToItem,
		createItem,
		toggleDone,
	} = useEngramStore();

	const [groupBy, setGroupBy] = useState<GroupBy>("space");

	const tasksBySpace = groupTasksBySpace();
	const tasksByPriority = groupTasksByPriority();
	const tasksByDue = groupTasksByDue();

	const totalCount = [...tasksBySpace.values()].reduce((n, ts) => n + ts.length, 0);

	return (
		<section className="h-full overflow-y-auto bg-[#151310] px-8 py-10 text-white md:px-16 lg:px-28">
			<div className="mx-auto max-w-[860px]">
				{/* ── Header ── */}
				<div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
					<div>
						<h2
							className="stagger-item flex items-center gap-3 font-bold text-3xl"
							style={{ animationDelay: "0ms" }}
						>
							<Icons.square className="size-7 text-[#9b88ff]" />
							Tasks
						</h2>
						<p
							className="stagger-item mt-3 max-w-2xl text-[#b0a69a]"
							style={{ animationDelay: "40ms" }}
						>
							All tasks across every space. Group by space, priority, or due date.
						</p>
					</div>

					<div className="flex items-center gap-3">
						<span className="shrink-0 rounded-[6px] border border-[#302c27] bg-[#211e1a] px-2.5 py-1 font-mono text-[#9f9588] text-xs">
							{totalCount} task{totalCount === 1 ? "" : "s"}
						</span>

						<Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
							<TabsList className="rounded-[8px] bg-[#23201d] p-1">
								<TabsTrigger
									value="space"
									className="h-8 rounded-[6px] px-3 text-[#948c82] data-active:bg-[#312d28] data-active:text-white"
								>
									Space
								</TabsTrigger>
								<TabsTrigger
									value="priority"
									className="h-8 rounded-[6px] px-3 text-[#948c82] data-active:bg-[#312d28] data-active:text-white"
								>
									Priority
								</TabsTrigger>
								<TabsTrigger
									value="due"
									className="h-8 rounded-[6px] px-3 text-[#948c82] data-active:bg-[#312d28] data-active:text-white"
								>
									Due
								</TabsTrigger>
							</TabsList>
						</Tabs>
					</div>
				</div>

				{/* ── Groups ── */}
				<div className="mt-9 space-y-3">
					{totalCount === 0 ? (
						<EmptyState />
					) : groupBy === "space" ? (
						<SpaceGroups
							tasksBySpace={tasksBySpace}
							spaces={spaces}
							jumpToItem={jumpToItem}
							toggleDone={toggleDone}
							createItem={createItem}
						/>
					) : groupBy === "priority" ? (
						<PriorityGroups
							tasksByPriority={tasksByPriority}
							jumpToItem={jumpToItem}
							toggleDone={toggleDone}
							createItem={createItem}
							spaces={spaces}
						/>
					) : (
						<DueGroups
							tasksByDue={tasksByDue}
							jumpToItem={jumpToItem}
							toggleDone={toggleDone}
							createItem={createItem}
							spaces={spaces}
						/>
					)}
				</div>
			</div>
		</section>
	);
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState() {
	return (
		<div
			className="stagger-item flex flex-col items-center gap-3 rounded-[10px] border border-dashed border-[#34302b] px-6 py-16 text-center"
			style={{ animationDelay: "80ms" }}
		>
			<Icons.square className="size-8 text-[#4c463e]" />
			<p className="font-semibold text-[#c8bfb2]">No tasks yet</p>
			<p className="max-w-sm text-[#82786e] text-sm">
				Create a task in any space and it will appear here, grouped however you prefer.
			</p>
		</div>
	);
}

// ─── Space grouping ───────────────────────────────────────────────────────────

function SpaceGroups({
	tasksBySpace,
	spaces,
	jumpToItem,
	toggleDone,
	createItem,
}: {
	tasksBySpace: Map<string, Item[]>;
	spaces: { id: string; name: string; icon: string; sortOrder: number }[];
	jumpToItem: (id: string) => void;
	toggleDone: (id: string) => void;
	createItem: (input: Parameters<ReturnType<typeof useEngramStore>["createItem"]>[0]) => Item;
}) {
	const sortedSpaces = [...spaces].sort((a, b) => a.sortOrder - b.sortOrder);

	return (
		<>
			{sortedSpaces.map((space, i) => {
				const tasks = tasksBySpace.get(space.id) ?? [];
				const iconKey = (space.icon in SPACE_ICONS ? space.icon : "sparkles") as SpaceIconKey;
				const SpaceIcon = Icons[SPACE_ICONS[iconKey]];
				const label = (
					<span className="flex items-center gap-2">
						<SpaceIcon className="size-4 text-[#9b88ff]" />
						{space.name}
					</span>
				);
				return (
					<TaskGroup
						key={space.id}
						label={label}
						tasks={tasks}
						index={i}
						jumpToItem={jumpToItem}
						toggleDone={toggleDone}
						onAdd={(title) =>
							createItem({
								type: "task",
								title,
								spaceId: space.id,
								stayOnCurrentView: true,
							})
						}
					/>
				);
			})}
		</>
	);
}

// ─── Priority grouping ────────────────────────────────────────────────────────

function PriorityGroups({
	tasksByPriority,
	jumpToItem,
	toggleDone,
	createItem,
	spaces,
}: {
	tasksByPriority: Map<Priority | undefined, Item[]>;
	jumpToItem: (id: string) => void;
	toggleDone: (id: string) => void;
	createItem: (input: Parameters<ReturnType<typeof useEngramStore>["createItem"]>[0]) => Item;
	spaces: { id: string; name: string; icon: string; sortOrder: number }[];
}) {
	const defaultSpaceId = [...spaces].sort((a, b) => a.sortOrder - b.sortOrder)[0]?.id;

	return (
		<>
			{PRIORITY_GROUPS.map((group, i) => {
				const tasks = tasksByPriority.get(group.priority) ?? [];
				const label = (
					<span className="flex items-center gap-2">
						<PriorityChip priority={group.priority} />
						<span>{group.label}</span>
					</span>
				);
				return (
					<TaskGroup
						key={String(group.priority)}
						label={label}
						tasks={tasks}
						index={i}
						jumpToItem={jumpToItem}
						toggleDone={toggleDone}
						onAdd={(title) =>
							createItem({
								type: "task",
								title,
								priority: group.priority,
								spaceId: defaultSpaceId,
								stayOnCurrentView: true,
							})
						}
					/>
				);
			})}
		</>
	);
}

// ─── Due grouping ─────────────────────────────────────────────────────────────

function DueGroups({
	tasksByDue,
	jumpToItem,
	toggleDone,
	createItem,
	spaces,
}: {
	tasksByDue: Map<DueBucket, Item[]>;
	jumpToItem: (id: string) => void;
	toggleDone: (id: string) => void;
	createItem: (input: Parameters<ReturnType<typeof useEngramStore>["createItem"]>[0]) => Item;
	spaces: { id: string; name: string; icon: string; sortOrder: number }[];
}) {
	const defaultSpaceId = [...spaces].sort((a, b) => a.sortOrder - b.sortOrder)[0]?.id;

	return (
		<>
			{DUE_BUCKETS.map((cfg, i) => {
				const tasks = tasksByDue.get(cfg.bucket) ?? [];
				const label = (
					<span
						className={cn(
							"flex items-center gap-2",
							cfg.overdue && "text-[#e46f50]",
						)}
					>
						{cfg.overdue && (
							<span className="size-2 rounded-full bg-[#e46f50] inline-block" />
						)}
						{cfg.label}
					</span>
				);
				return (
					<TaskGroup
						key={cfg.bucket}
						label={label}
						tasks={tasks}
						index={i}
						jumpToItem={jumpToItem}
						toggleDone={toggleDone}
						overdue={cfg.overdue}
						onAdd={(title) => {
							const prefix = todayPrefix();
							let dueAt: string | undefined;
							if (cfg.bucket === "today") {
								dueAt = `${prefix}T10:00:00.000Z`;
							} else if (cfg.bucket === "upcoming") {
								const tomorrow = new Date();
								tomorrow.setDate(tomorrow.getDate() + 1);
								const tp = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
								dueAt = `${tp}T10:00:00.000Z`;
							}
							createItem({
								type: "task",
								title,
								dueAt,
								someday: cfg.bucket === "someday" ? true : undefined,
								spaceId: defaultSpaceId,
								stayOnCurrentView: true,
							});
						}}
					/>
				);
			})}
		</>
	);
}

// ─── Collapsible task group ───────────────────────────────────────────────────

function TaskGroup({
	label,
	tasks,
	index,
	jumpToItem,
	toggleDone,
	onAdd,
	overdue,
}: {
	label: React.ReactNode;
	tasks: Item[];
	index: number;
	jumpToItem: (id: string) => void;
	toggleDone: (id: string) => void;
	onAdd: (title: string) => void;
	overdue?: boolean;
}) {
	const [expanded, setExpanded] = useState(true);
	const [adding, setAdding] = useState(false);
	const [newTitle, setNewTitle] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);
	const sorted = sortTasksWithDoneAtBottom(tasks);
	const openCount = tasks.filter((t) => !t.done).length;

	const handleAdd = () => {
		const title = newTitle.trim();
		if (!title) {
			setAdding(false);
			setNewTitle("");
			return;
		}
		onAdd(title);
		setNewTitle("");
		inputRef.current?.focus();
	};

	return (
		<div
			className="stagger-item"
			style={{ animationDelay: `${80 + index * 50}ms` }}
		>
			{/* Group header */}
			<Button
				type="button"
				variant="ghost"
				onClick={() => setExpanded((v) => !v)}
				className="mb-1 flex w-full items-center gap-2 rounded-[7px] px-3 py-2 text-left font-semibold text-sm text-[#c8bfb2] hover:bg-[#1e1b17] active:scale-[0.99]"
			>
				{expanded ? (
					<ChevronDown className={cn("size-3.5 shrink-0", overdue ? "text-[#e46f50]" : "text-[#6b6560]")} />
				) : (
					<ChevronRight className={cn("size-3.5 shrink-0", overdue ? "text-[#e46f50]" : "text-[#6b6560]")} />
				)}
				<span className="flex-1">{label}</span>
				<span
					className={cn(
						"rounded-[5px] px-1.5 py-0.5 font-mono text-[11px]",
						overdue
							? "bg-[#2d1a14] text-[#e46f50]"
							: "bg-[#252220] text-[#82786e]",
					)}
				>
					{openCount}
				</span>
			</Button>

			{/* Tasks */}
			<div
				className={cn(
					"overflow-hidden transition-all duration-200",
					expanded ? "max-h-[9999px] opacity-100" : "max-h-0 opacity-0",
				)}
			>
				<div
					className={cn(
						"ml-2 rounded-[8px] border",
						overdue ? "border-[#3d1e16]" : "border-[#26221e]",
						"bg-[#1b1815]",
					)}
				>
					{sorted.length > 0 ? (
						<div className="divide-y divide-[#221e1b]">
							{sorted.map((task) => (
								<TaskRow
									key={task.id}
									task={task}
									jumpToItem={jumpToItem}
									toggleDone={toggleDone}
									overdue={overdue}
								/>
							))}
						</div>
					) : (
						<p className="px-4 py-4 text-[#4c463e] text-sm">Nothing here yet</p>
					)}

					{/* Quick-add row */}
					<div className={cn("border-t", overdue ? "border-[#3d1e16]" : "border-[#221e1b]")}>
						{adding ? (
							<div className="flex items-center gap-2 px-3 py-2">
								<span className="size-4 shrink-0" />
								<span className="size-4 shrink-0" />
								<Input
									ref={inputRef}
									autoFocus
									value={newTitle}
									onChange={(e) => setNewTitle(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") handleAdd();
										if (e.key === "Escape") {
											setAdding(false);
											setNewTitle("");
										}
									}}
									placeholder="Task title…"
									className="h-7 flex-1 border-0 bg-transparent text-[#e0d8cf] text-sm placeholder:text-[#4a4540] focus-visible:ring-0"
								/>
								<Button
									type="button"
									size="sm"
									onClick={handleAdd}
									className="h-7 gap-1 rounded-[6px] bg-[#907ce8] px-3 font-semibold text-[12px] text-[#17131f] transition-colors duration-150 hover:bg-[#a08ef2] active:scale-[0.96]"
								>
									Add
								</Button>
							</div>
						) : (
							<button
								type="button"
								onClick={() => setAdding(true)}
								className="flex w-full items-center gap-2 rounded-b-[8px] px-4 py-2.5 text-[#4c463e] text-sm transition-colors duration-150 hover:bg-[#201d19] hover:text-[#907ce8]"
							>
								<Icons.plus className="size-3.5" />
								Add task
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({
	task,
	jumpToItem,
	toggleDone,
	overdue,
}: {
	task: Item;
	jumpToItem: (id: string) => void;
	toggleDone: (id: string) => void;
	overdue?: boolean;
}) {
	return (
		<Button
			type="button"
			variant="ghost"
			onClick={() => jumpToItem(task.id)}
			className={cn(
				"h-auto w-full items-start justify-start gap-3 rounded-none px-4 py-3 text-left font-normal",
				"transition-[background-color,transform] duration-150",
				"hover:bg-[#201d19]",
				"active:scale-[0.99] active:bg-[#242019]",
				overdue && !task.done && "hover:bg-[#1e1410]",
			)}
		>
			<span
				onClick={(e) => e.stopPropagation()}
				className="mt-0.5 shrink-0"
			>
				<Checkbox
					checked={task.done}
					onCheckedChange={() => toggleDone(task.id)}
					className="rounded-full"
				/>
			</span>

			<span className="min-w-0 flex-1">
				<span
					className={cn(
						"block font-semibold text-[#f0ebe3]",
						task.done && "text-[#655e56] line-through",
						overdue && !task.done && "text-[#f0ebe3]",
					)}
				>
					{task.title ?? task.text ?? "Untitled"}
				</span>
				{(task.priority ?? task.dueAt) && (
					<span className="mt-1.5 flex flex-wrap gap-1.5">
						<PriorityChip priority={task.priority} />
						<DueChip dueAt={task.dueAt} />
					</span>
				)}
			</span>
		</Button>
	);
}
