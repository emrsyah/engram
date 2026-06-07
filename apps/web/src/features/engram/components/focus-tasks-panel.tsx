"use client";

import { Button } from "@alphonse/ui/components/button";
import { Checkbox } from "@alphonse/ui/components/checkbox";
import { cn } from "@alphonse/ui/lib/utils";
import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	Check,
	ChevronDown,
	ChevronRight,
	GripVertical,
	Pin,
	PinOff,
	Plus,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TODAY_FOCUS_SPACE_ID } from "../config";
import { useEngramStore } from "../store";
import type { Item } from "../types";
import { DueChip, PriorityChip } from "./chips";

// ─── Celebration burst ────────────────────────────────────────────────────────

type Particle = {
	id: number;
	x: number;
	y: number;
	color: string;
	angle: number;
	dist: number;
};

function CelebrationBurst({
	origin,
}: {
	origin: { x: number; y: number } | null;
}) {
	const [particles, setParticles] = useState<Particle[]>([]);
	const countRef = useRef(0);

	useEffect(() => {
		if (!origin) return;
		const colors = ["#907ce8", "#d9a82f", "#43b6a6", "#e46f50", "#4aa5c8"];
		const next: Particle[] = Array.from({ length: 16 }, (_, i) => ({
			id: ++countRef.current,
			x: origin.x,
			y: origin.y,
			color: colors[i % colors.length],
			angle: (360 / 16) * i,
			dist: 36 + Math.random() * 30,
		}));
		setParticles(next);
		const t = setTimeout(() => setParticles([]), 700);
		return () => clearTimeout(t);
	}, [origin]);

	return (
		<div className="pointer-events-none fixed inset-0 z-[300]">
			{particles.map((p) => {
				const rad = (p.angle * Math.PI) / 180;
				const tx = Math.cos(rad) * p.dist;
				const ty = Math.sin(rad) * p.dist;
				return (
					<div
						key={p.id}
						className="absolute size-2 rounded-full"
						style={{
							left: p.x,
							top: p.y,
							backgroundColor: p.color,
							animation: "focus-burst 0.65s ease-out forwards",
							["--tx" as string]: `${tx}px`,
							["--ty" as string]: `${ty}px`,
						}}
					/>
				);
			})}
		</div>
	);
}

// ─── Sortable task row ────────────────────────────────────────────────────────

function SortableTaskRow({
	task,
	onToggle,
	onUnpin,
}: {
	task: Item;
	onToggle: (id: string, origin: { x: number; y: number }) => void;
	onUnpin: (id: string) => void;
}) {
	const { toggleChecklistItem } = useEngramStore();
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: task.id });

	const style = { transform: CSS.Transform.toString(transform), transition };
	const checkRef = useRef<HTMLButtonElement>(null);

	const handleCheck = () => {
		if (!checkRef.current) return;
		const rect = checkRef.current.getBoundingClientRect();
		onToggle(task.id, {
			x: rect.left + rect.width / 2,
			y: rect.top + rect.height / 2,
		});
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(
				"group flex items-start gap-2 rounded-[7px] px-2 py-2 transition-colors hover:bg-[#211e1a]",
				isDragging && "opacity-40",
				task.done && "opacity-55",
			)}
		>
			<button
				type="button"
				{...attributes}
				{...listeners}
				tabIndex={-1}
				className="mt-0.5 cursor-grab touch-none text-[#3e3a35] opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-100"
			>
				<GripVertical className="size-3.5" />
			</button>
			<Checkbox
				ref={checkRef}
				checked={task.done}
				onCheckedChange={handleCheck}
				className={cn(
					"mt-0.5 shrink-0 rounded-[4px] border-[#4a4540]",
					task.done && "border-[#907ce8] bg-[#907ce8]",
				)}
			/>
			<div className="min-w-0 flex-1">
				<p
					className={cn(
						"text-[#e0d8cf] text-sm leading-snug",
						task.done && "text-[#6b6560] line-through",
					)}
				>
					{task.title ?? task.text ?? "Untitled task"}
				</p>
				{(task.priority || task.dueAt) && (
					<div className="mt-1 flex flex-wrap gap-1">
						{task.priority && <PriorityChip priority={task.priority} />}
						{task.dueAt && <DueChip dueAt={task.dueAt} />}
					</div>
				)}
				{task.checklistItems && task.checklistItems.length > 0 && (
					<div className="mt-2 space-y-1">
						{task.checklistItems.map((ci) => (
							<button
								key={ci.id}
								type="button"
								onClick={() => toggleChecklistItem(task.id, ci.id)}
								className="nodrag flex w-full items-center gap-2 text-left"
							>
								<span
									className={cn(
										"flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border border-[#4a4540] transition-colors",
										ci.done && "border-[#907ce8] bg-[#907ce8]",
									)}
								>
									{ci.done && <Check className="size-2.5 text-white" />}
								</span>
								<span
									className={cn(
										"text-[#b0a99f] text-xs leading-snug",
										ci.done && "text-[#5a5450] line-through",
									)}
								>
									{ci.text}
								</span>
							</button>
						))}
					</div>
				)}
			</div>
			<button
				type="button"
				onClick={() => onUnpin(task.id)}
				title="Remove from focus"
				className="mt-0.5 shrink-0 text-[#3e3a35] opacity-0 transition-opacity hover:text-[#e46f50] group-hover:opacity-100"
			>
				<PinOff className="size-3.5" />
			</button>
		</div>
	);
}

// ─── Today's tasks section (unpinned) ────────────────────────────────────────

function TodayUnpinnedSection() {
	const { todayUnpinnedTasks, pinToFocus } = useEngramStore();
	const [expanded, setExpanded] = useState(true);

	if (todayUnpinnedTasks.length === 0) return null;

	return (
		<div className="border-[#252220] border-t pt-3">
			<button
				type="button"
				onClick={() => setExpanded((v) => !v)}
				className="mb-2 flex w-full items-center gap-1.5 px-2 text-left"
			>
				{expanded ? (
					<ChevronDown className="size-3 text-[#6b6560]" />
				) : (
					<ChevronRight className="size-3 text-[#6b6560]" />
				)}
				<span className="font-bold text-[#6b6560] text-[11px] uppercase tracking-widest">
					Due today
				</span>
				<span className="ml-auto rounded-full bg-[#252220] px-1.5 py-0.5 font-mono text-[#8a8378] text-[10px]">
					{todayUnpinnedTasks.length}
				</span>
			</button>
			{expanded && (
				<div className="space-y-0.5">
					{todayUnpinnedTasks.map((task) => (
						<div
							key={task.id}
							className="group flex items-start gap-2 rounded-[7px] px-2 py-2 hover:bg-[#211e1a]"
						>
							<div className="min-w-0 flex-1">
								<p className="text-[#b0a99f] text-sm leading-snug">
									{task.title ?? task.text ?? "Untitled task"}
								</p>
								{(task.priority || task.dueAt) && (
									<div className="mt-1 flex flex-wrap gap-1">
										{task.priority && <PriorityChip priority={task.priority} />}
										{task.dueAt && <DueChip dueAt={task.dueAt} />}
									</div>
								)}
							</div>
							<button
								type="button"
								onClick={() => pinToFocus(task.id)}
								title="Add to focus"
								className="mt-0.5 shrink-0 text-[#3e3a35] opacity-0 transition-opacity hover:text-[#907ce8] group-hover:opacity-100"
							>
								<Pin className="size-3.5" />
							</button>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

// ─── Main panel ──────────────────────────────────────────────────────────────

export function FocusTasksPanel({ onClose }: { onClose: () => void }) {
	const { focusPinnedItems, toggleDone, unpinFromFocus, createItem } =
		useEngramStore();

	const [taskOrder, setTaskOrder] = useState<string[]>([]);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [burst, setBurst] = useState<{ x: number; y: number } | null>(null);
	const [addingTask, setAddingTask] = useState(false);
	const [newTaskText, setNewTaskText] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	// Sync order when pinned items change
	useEffect(() => {
		setTaskOrder((prev) => {
			const existingIds = new Set(focusPinnedItems.map((t) => t.id));
			const filtered = prev.filter((id) => existingIds.has(id));
			const newIds = focusPinnedItems
				.map((t) => t.id)
				.filter((id) => !filtered.includes(id));
			return [...filtered, ...newIds];
		});
	}, [focusPinnedItems]);

	useEffect(() => {
		if (addingTask) inputRef.current?.focus();
	}, [addingTask]);

	const orderedItems = useMemo(() => {
		const map = new Map(focusPinnedItems.map((t) => [t.id, t]));
		return taskOrder.map((id) => map.get(id)).filter(Boolean) as Item[];
	}, [taskOrder, focusPinnedItems]);

	const pendingItems = orderedItems.filter((t) => !t.done);
	const doneItems = orderedItems.filter((t) => t.done);
	const doneCount = doneItems.length;
	const totalCount = orderedItems.length;

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const handleDragStart = ({ active }: DragStartEvent) =>
		setActiveId(active.id as string);
	const handleDragEnd = ({ active, over }: DragEndEvent) => {
		setActiveId(null);
		if (!over || active.id === over.id) return;
		setTaskOrder((order) => {
			const oldIndex = order.indexOf(active.id as string);
			const newIndex = order.indexOf(over.id as string);
			return arrayMove(order, oldIndex, newIndex);
		});
	};

	const handleToggle = useCallback(
		(id: string, origin: { x: number; y: number }) => {
			const task = focusPinnedItems.find((t) => t.id === id);
			if (task && !task.done) {
				setBurst(origin);
				setTimeout(() => setBurst(null), 700);
			}
			toggleDone(id);
		},
		[focusPinnedItems, toggleDone],
	);

	const handleAddTask = () => {
		const text = newTaskText.trim();
		if (!text) {
			setAddingTask(false);
			return;
		}
		createItem({
			type: "task",
			title: text,
			spaceId: TODAY_FOCUS_SPACE_ID,
			focusPinned: true,
			stayOnCurrentView: true,
		});
		setNewTaskText("");
		inputRef.current?.focus();
	};

	const activeTask = activeId
		? focusPinnedItems.find((t) => t.id === activeId)
		: null;

	return (
		<>
			<style>{`
        @keyframes focus-burst {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
        }
      `}</style>
			<CelebrationBurst origin={burst} />

			<div className="absolute top-[calc(100%+8px)] right-0 z-50 flex w-[360px] flex-col rounded-[12px] border border-[#2e2b26] bg-[#1a1714] shadow-2xl">
				{/* Header */}
				<div className="flex shrink-0 items-center justify-between border-[#2e2b26] border-b px-4 py-3">
					<div className="flex items-center gap-3">
						<span className="font-bold text-white text-xs uppercase tracking-widest">
							Focus Tasks
						</span>
						{totalCount > 0 && (
							<span className="font-mono text-[#6b6560] text-xs">
								{doneCount}/{totalCount}
							</span>
						)}
					</div>
					<Button
						variant="ghost"
						size="icon-xs"
						onClick={onClose}
						className="size-6 text-[#706a62] hover:text-white"
					>
						<X className="size-3.5" />
					</Button>
				</div>

				{/* Progress bar */}
				{totalCount > 0 && (
					<div className="shrink-0 px-4 pt-3">
						<div className="h-1 w-full overflow-hidden rounded-full bg-[#252220]">
							<div
								className="h-full rounded-full bg-[#907ce8] transition-all duration-500"
								style={{
									width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%`,
								}}
							/>
						</div>
					</div>
				)}

				{/* Task list */}
				<div className="max-h-[480px] overflow-y-auto px-2 py-3">
					<DndContext
						sensors={sensors}
						collisionDetection={closestCenter}
						onDragStart={handleDragStart}
						onDragEnd={handleDragEnd}
					>
						<div className="space-y-0.5">
							<SortableContext
								items={taskOrder}
								strategy={verticalListSortingStrategy}
							>
								{pendingItems.map((task) => (
									<SortableTaskRow
										key={task.id}
										task={task}
										onToggle={handleToggle}
										onUnpin={unpinFromFocus}
									/>
								))}
							</SortableContext>

							{doneItems.length > 0 && pendingItems.length > 0 && (
								<div className="my-2 flex items-center gap-2 px-2">
									<div className="h-px flex-1 bg-[#252220]" />
									<span className="text-[#4a4540] text-[10px]">done</span>
									<div className="h-px flex-1 bg-[#252220]" />
								</div>
							)}

							<SortableContext
								items={taskOrder}
								strategy={verticalListSortingStrategy}
							>
								{doneItems.map((task) => (
									<SortableTaskRow
										key={task.id}
										task={task}
										onToggle={handleToggle}
										onUnpin={unpinFromFocus}
									/>
								))}
							</SortableContext>

							{orderedItems.length === 0 && (
								<div className="py-6 text-center text-[#4a4540] text-sm">
									No tasks in focus yet.
									<br />
									Add one or pin tasks from the canvas.
								</div>
							)}
						</div>

						<DragOverlay>
							{activeTask && (
								<div className="rounded-[7px] border border-[#907ce8]/30 bg-[#1c1916] px-3 py-2 shadow-xl">
									<p className="text-[#e0d8cf] text-sm">
										{activeTask.title ?? activeTask.text ?? "Untitled task"}
									</p>
								</div>
							)}
						</DragOverlay>
					</DndContext>

					{/* Add task */}
					<div className="mt-2 px-2">
						{addingTask ? (
							<div className="flex items-center gap-2 rounded-[7px] border border-[#907ce8]/40 bg-[#211e1a] px-2.5 py-2">
								<input
									ref={inputRef}
									value={newTaskText}
									onChange={(e) => setNewTaskText(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") handleAddTask();
										if (e.key === "Escape") {
											setAddingTask(false);
											setNewTaskText("");
										}
									}}
									placeholder="Task title…"
									className="flex-1 bg-transparent text-[#e0d8cf] text-sm placeholder:text-[#4a4540] focus:outline-none"
								/>
								<button
									type="button"
									onClick={handleAddTask}
									className="shrink-0 font-semibold text-[#907ce8] text-xs hover:text-[#a08ef2]"
								>
									Add
								</button>
							</div>
						) : (
							<button
								type="button"
								onClick={() => setAddingTask(true)}
								className="flex w-full items-center gap-2 rounded-[7px] border border-[#2e2b26] border-dashed px-2.5 py-2 text-[#4a4540] text-sm transition-colors hover:border-[#907ce8]/40 hover:text-[#907ce8]"
							>
								<Plus className="size-4" />
								Add to focus
							</button>
						)}
					</div>

					{/* Today's unpinned tasks */}
					<div className="mt-3 px-2">
						<TodayUnpinnedSection />
					</div>
				</div>
			</div>
		</>
	);
}
