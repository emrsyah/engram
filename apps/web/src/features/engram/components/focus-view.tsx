"use client";

import { Button } from "@alphonse/ui/components/button";
import { Card } from "@alphonse/ui/components/card";
import { Checkbox } from "@alphonse/ui/components/checkbox";
import { Input } from "@alphonse/ui/components/input";
import { ScrollArea } from "@alphonse/ui/components/scroll-area";
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
	Target,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TODAY_FOCUS_SPACE_ID } from "../config";
import { useEngramStore } from "../store";
import type { Item } from "../types";
import { DueChip, PriorityChip } from "./chips";
import { FocusScratchpadInline } from "./focus-scratchpad-inline";
import { FocusTimerInline } from "./focus-timer-inline";

const TOP_N = 3;

// ─── Custom easing tokens ─────────────────────────────────────────────────────
const _EASE_IN_OUT = "cubic-bezier(0.77, 0, 0.175, 1)";
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

// ─── Celebration burst (WAAPI, interruptible, respects reduced motion) ──────

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
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!origin) return;
		const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (reduced) return;

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

	useEffect(() => {
		if (!containerRef.current) return;
		const els = containerRef.current.querySelectorAll<HTMLElement>(".focus-particle");
		els.forEach((el) => {
			const tx = el.style.getPropertyValue("--tx");
			const ty = el.style.getPropertyValue("--ty");
			el.animate(
				[
					{ transform: "translate(0,0) scale(1)", opacity: 1 },
					{ transform: `translate(${tx}, ${ty}) scale(0)`, opacity: 0 },
				],
				{ duration: 650, fill: "forwards", easing: EASE_OUT },
			);
		});
	}, [particles]);

	return (
		<div ref={containerRef} className="pointer-events-none fixed inset-0 z-[300]">
			{particles.map((p) => {
				const rad = (p.angle * Math.PI) / 180;
				const tx = Math.cos(rad) * p.dist;
				const ty = Math.sin(rad) * p.dist;
				return (
					<div
						key={p.id}
						className="focus-particle absolute size-2 rounded-full"
						style={{
							left: p.x,
							top: p.y,
							backgroundColor: p.color,
							["--tx" as string]: `${tx}px`,
							["--ty" as string]: `${ty}px`,
						}}
					/>
				);
			})}
		</div>
	);
}

// ─── Sortable task row (top priority card) ─────────────────────────────────────

function SortablePriorityCard({
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

	const style = {
		transform: CSS.Transform.toString(transform),
		transition: transition ?? undefined,
	};
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
				"group rounded-[10px] border border-[#907ce8]/20 bg-[#1e1b25] p-4",
				"hover:border-[#907ce8]/40",
				isDragging && "opacity-40",
				task.done && "opacity-55 border-[#3a3530]/50",
			)}
		>
			<div className="flex items-start gap-3">
				<Button
					type="button"
					variant="ghost"
					size="icon-xs"
					{...attributes}
					{...listeners}
					tabIndex={-1}
					className="mt-0.5 cursor-grab touch-none text-[#5a546d] opacity-0 transition-opacity duration-150 active:scale-[0.96] active:cursor-grabbing group-hover:opacity-100"
				>
					<GripVertical className="size-4" />
				</Button>
				<Checkbox
					ref={checkRef}
					checked={task.done}
					onCheckedChange={handleCheck}
					className={cn(
						"mt-1 shrink-0 rounded-[4px] border-[#5a546d] transition-colors duration-200",
						task.done && "border-[#907ce8] bg-[#907ce8]",
					)}
				/>
				<div className="min-w-0 flex-1">
					<p
						className={cn(
							"font-semibold text-[#e0d8cf] text-base leading-snug",
							task.done && "text-[#6b6560] line-through font-normal",
						)}
					>
						{task.title ?? task.text ?? "Untitled task"}
					</p>
					{(task.priority || task.dueAt) && (
						<div className="mt-2 flex flex-wrap gap-1.5">
							{task.priority && <PriorityChip priority={task.priority} />}
							{task.dueAt && <DueChip dueAt={task.dueAt} />}
						</div>
					)}
					{task.checklistItems && task.checklistItems.length > 0 && (
						<div className="mt-3 space-y-1.5">
							{task.checklistItems.map((ci) => (
								<button
									key={ci.id}
									type="button"
									onClick={() => toggleChecklistItem(task.id, ci.id)}
									className="nodrag flex w-full items-center gap-2 text-left active:scale-[0.98]"
								>
									<span
										className={cn(
											"flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-[#5a546d] transition-colors duration-200",
											ci.done && "border-[#907ce8] bg-[#907ce8]",
										)}
									>
										{ci.done && <Check className="size-2.5 text-white" />}
									</span>
									<span
										className={cn(
											"text-[#b0a99f] text-sm leading-snug",
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
				<Button
					type="button"
					variant="ghost"
					size="icon-xs"
					onClick={() => onUnpin(task.id)}
					title="Remove from focus"
					className="mt-1 shrink-0 text-[#5a546d] opacity-0 transition-opacity duration-150 active:scale-[0.95] hover:text-[#e46f50] group-hover:opacity-100"
				>
					<PinOff className="size-4" />
				</Button>
			</div>
		</div>
	);
}

// ─── Sortable task row (backlog) ──────────────────────────────────────────────

function SortableBacklogRow({
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

	const style = {
		transform: CSS.Transform.toString(transform),
		transition: transition ?? undefined,
	};
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
				"group flex items-start gap-2 rounded-[7px] px-2 py-2",
				"transition-colors duration-150 hover:bg-[#211e1a]",
				isDragging && "opacity-40",
				task.done && "opacity-55",
			)}
		>
			<Button
				type="button"
				variant="ghost"
				size="icon-xs"
				{...attributes}
				{...listeners}
				tabIndex={-1}
				className="mt-0.5 cursor-grab touch-none text-[#3e3a35] opacity-0 transition-opacity duration-150 active:scale-[0.96] active:cursor-grabbing group-hover:opacity-100"
			>
				<GripVertical className="size-3.5" />
			</Button>
			<Checkbox
				ref={checkRef}
				checked={task.done}
				onCheckedChange={handleCheck}
				className={cn(
					"mt-0.5 shrink-0 rounded-[4px] border-[#4a4540] transition-colors duration-200",
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
			</div>
			<Button
				type="button"
				variant="ghost"
				size="icon-xs"
				onClick={() => onUnpin(task.id)}
				title="Remove from focus"
				className="mt-0.5 shrink-0 text-[#3e3a35] opacity-0 transition-opacity duration-150 active:scale-[0.95] hover:text-[#e46f50] group-hover:opacity-100"
			>
				<PinOff className="size-3.5" />
			</Button>
		</div>
	);
}

// ─── Overdue section ─────────────────────────────────────────────────────────

function OverdueSection() {
	const { overdueNotPinnedTasks, pinToFocus } = useEngramStore();
	const [expanded, setExpanded] = useState(true);

	if (overdueNotPinnedTasks.length === 0) return null;

	return (
		<div className="border-[#252220] border-t pt-4">
			<Button
				type="button"
				variant="ghost"
				onClick={() => setExpanded((v) => !v)}
				className="mb-2 flex w-full items-center gap-1.5 px-2 text-left active:scale-[0.98]"
			>
				{expanded ? (
					<ChevronDown className="size-3 text-[#c06b4a]" />
				) : (
					<ChevronRight className="size-3 text-[#c06b4a]" />
				)}
				<span className="font-bold text-[#c06b4a] text-[11px] uppercase tracking-widest">
					Overdue
				</span>
				<span className="ml-auto rounded-full bg-[#2d1a14] px-1.5 py-0.5 font-mono text-[#c06b4a] text-[10px]">
					{overdueNotPinnedTasks.length}
				</span>
			</Button>
			<div
				className={cn(
					"space-y-0.5 overflow-hidden transition-all",
					expanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0",
				)}
				style={{ transition: "max-height 300ms ease-out, opacity 200ms ease-out" }}
			>
				{overdueNotPinnedTasks.map((task, i) => (
					<div
						key={task.id}
						className="group flex items-start gap-2 rounded-[7px] px-2 py-2 transition-colors duration-150 hover:bg-[#1f1712]"
						style={{
							transitionDelay: expanded ? `${i * 30}ms` : "0ms",
							transitionProperty: "background-color, opacity, transform",
						}}
					>
						<div className="min-w-0 flex-1">
							<p className="text-[#b0a99f] text-sm leading-snug">
								{task.title ?? task.text ?? "Untitled task"}
							</p>
							<div className="mt-1 flex flex-wrap gap-1">
								{task.priority && <PriorityChip priority={task.priority} />}
								{task.dueAt && (
									<span className="rounded-[5px] border border-[#5a2518] bg-[#2d1a14] px-2 py-0.5 font-mono text-[10px] text-[#e46f50]">
										{new Date(task.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
									</span>
								)}
							</div>
						</div>
						<Button
							type="button"
							variant="ghost"
							onClick={() => pinToFocus(task.id)}
							title="Add to focus"
							className="mt-0.5 shrink-0 size-7 text-[#3e3a35] opacity-0 transition-opacity duration-150 active:scale-[0.95] hover:text-[#907ce8] group-hover:opacity-100"
						>
							<Pin className="size-3.5" />
						</Button>
					</div>
				))}
			</div>
		</div>
	);
}

// ─── Today's unpinned section ────────────────────────────────────────────────

function TodayUnpinnedSection() {
	const { todayUnpinnedTasks, pinToFocus } = useEngramStore();
	const [expanded, setExpanded] = useState(true);

	if (todayUnpinnedTasks.length === 0) return null;

	return (
		<div className="border-[#252220] border-t pt-4">
			<Button
				type="button"
				variant="ghost"
				onClick={() => setExpanded((v) => !v)}
				className="mb-2 flex w-full items-center gap-1.5 px-2 text-left active:scale-[0.98]"
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
			</Button>
			<div
				className={cn(
					"space-y-0.5 overflow-hidden transition-all",
					expanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0",
				)}
				style={{ transition: "max-height 300ms ease-out, opacity 200ms ease-out" }}
			>
				{todayUnpinnedTasks.map((task, i) => (
					<div
						key={task.id}
						className="group flex items-start gap-2 rounded-[7px] px-2 py-2 transition-colors duration-150 hover:bg-[#211e1a]"
						style={{
							transitionDelay: expanded ? `${i * 30}ms` : "0ms",
							transitionProperty: "background-color, opacity, transform",
						}}
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
						<Button
							type="button"
							variant="ghost"
							onClick={() => pinToFocus(task.id)}
							title="Add to focus"
							className="mt-0.5 shrink-0 size-7 text-[#3e3a35] opacity-0 transition-opacity duration-150 active:scale-[0.95] hover:text-[#907ce8] group-hover:opacity-100"
						>
							<Pin className="size-3.5" />
						</Button>
					</div>
				))}
			</div>
		</div>
	);
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function FocusView() {
	const {
		focusPinnedItems,
		toggleDone,
		unpinFromFocus,
		createItem,
		overdueNotPinnedTasks,
		todayUnpinnedTasks,
	} = useEngramStore();

	const [taskOrder, setTaskOrder] = useState<string[]>([]);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [burst, setBurst] = useState<{ x: number; y: number } | null>(null);
	const [addingTask, setAddingTask] = useState(false);
	const [newTaskText, setNewTaskText] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

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
	const topItems = pendingItems.slice(0, TOP_N);
	const backlogItems = pendingItems.slice(TOP_N);
	const doneCount = doneItems.length;
	const totalCount = orderedItems.length;
	const isEmpty = totalCount === 0;
	const allDone = totalCount > 0 && pendingItems.length === 0;
	const suggestionCount =
		overdueNotPinnedTasks.length + todayUnpinnedTasks.length;

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

	const today = new Date().toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
	});

	return (
		<>
			<style>{`
				@media (prefers-reduced-motion: reduce) {
					*, *::before, *::after {
						animation-duration: 0.01ms !important;
						animation-iteration-count: 1 !important;
						transition-duration: 0.01ms !important;
					}
				}
			`}</style>
			<CelebrationBurst origin={burst} />

			<section className="h-full bg-[#151310] text-white">
				<div className="mx-auto flex h-full max-w-[1400px] flex-col p-6 lg:flex-row lg:gap-6 lg:p-10">
					{/* ── Left column (70%) ── */}
					<ScrollArea className="min-h-0 h-full w-full lg:w-[70%] lg:shrink-0">
						<div className="p-1">
						<div className="mb-6">
							<h2
								className="stagger-item font-bold text-3xl"
								style={{ animationDelay: "0ms" }}
							>
								Focus
							</h2>
							<p
								className="stagger-item mt-3 text-[#b0a69a]"
								style={{ animationDelay: "40ms" }}
							>
								Your top {TOP_N} priorities for {today}, then the backlog. Drag to reorder.
							</p>
						</div>

						{totalCount > 0 && (
							<div className="mb-6 flex items-center gap-3">
								<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#252220]">
									<div
										className="h-full rounded-full bg-[#907ce8] transition-transform duration-500 ease-out"
										style={{
											transform: `scaleX(${doneCount / totalCount})`,
											transformOrigin: "left",
										}}
									/>
								</div>
								<span className="shrink-0 font-mono text-[#6b6560] text-xs">
									{doneCount}/{totalCount}
								</span>
							</div>
						)}

						<DndContext
							sensors={sensors}
							collisionDetection={closestCenter}
							onDragStart={handleDragStart}
							onDragEnd={handleDragEnd}
						>
							{/* ── Top 3 Priorities ── */}
							{topItems.length > 0 && (
								<div className="mb-6">
									<p className="mb-3 font-bold text-[#9b88ff] text-[11px] uppercase tracking-[0.14em]">
										Top {TOP_N} Priorities
									</p>
									<SortableContext
										items={taskOrder}
										strategy={verticalListSortingStrategy}
									>
										<div className="space-y-3">
											{topItems.map((task, i) => (
												<SortablePriorityCard
													key={task.id}
													task={task}
													onToggle={handleToggle}
													onUnpin={unpinFromFocus}
												/>
											))}
										</div>
									</SortableContext>
								</div>
							)}

							{/* ── Backlog ── */}
							{backlogItems.length > 0 && (
								<div className="mb-4">
									<p className="mb-2 px-2 font-bold text-[#6b6560] text-[11px] uppercase tracking-[0.14em]">
										Backlog
									</p>
									<SortableContext
										items={taskOrder}
										strategy={verticalListSortingStrategy}
									>
										<div className="space-y-0.5">
											{backlogItems.map((task) => (
												<SortableBacklogRow
													key={task.id}
													task={task}
													onToggle={handleToggle}
													onUnpin={unpinFromFocus}
												/>
											))}
										</div>
									</SortableContext>
								</div>
							)}

							{/* ── All done note ── */}
							{allDone && (
								<div className="mb-5 flex items-center gap-2.5 px-2">
									<Check className="size-4 shrink-0 text-[#756e65]" />
									<p className="text-[#8d857b] text-sm">
										Focus cleared — everything you pinned today is done.
									</p>
								</div>
							)}

							{/* ── Done items ── */}
							{doneItems.length > 0 && (
								<div className="mb-4">
									<div className="mb-2 flex items-center gap-2 px-2">
										<div className="h-px flex-1 bg-[#252220]" />
										<span className="text-[#4a4540] text-[10px]">
											completed
										</span>
										<div className="h-px flex-1 bg-[#252220]" />
									</div>
									<SortableContext
										items={taskOrder}
										strategy={verticalListSortingStrategy}
									>
										<div className="space-y-0.5">
											{doneItems.map((task) => (
												<SortableBacklogRow
													key={task.id}
													task={task}
													onToggle={handleToggle}
													onUnpin={unpinFromFocus}
												/>
											))}
										</div>
									</SortableContext>
								</div>
							)}

							{/* ── Empty state ── */}
							{isEmpty && (
								<div
									className="stagger-item flex flex-col items-center gap-3 rounded-[10px] border border-[#34302b] border-dashed px-6 py-16 text-center"
									style={{ animationDelay: "80ms" }}
								>
									<Target className="size-8 text-[#4c463e]" />
									<p className="font-semibold text-[#c8bfb2]">
										Nothing in focus yet
									</p>
									<p className="max-w-sm text-[#82786e] text-sm">
										Pick the few tasks that would make today count. Pin
										them here and start at the top.
									</p>
									{addingTask ? (
										<div className="mt-1 flex w-full max-w-xs items-center gap-2 rounded-[7px] border border-[#907ce8]/40 bg-[#211e1a] px-3 py-2 text-left">
											<Input
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
												className="h-7 border-0 bg-transparent text-[#e0d8cf] text-sm placeholder:text-[#4a4540] focus-visible:ring-0"
											/>
											<Button
												type="button"
												size="sm"
												onClick={handleAddTask}
												className="h-7 shrink-0 rounded-[6px] bg-[#907ce8] px-3 font-semibold text-[#17131f] hover:bg-[#a08ef2] active:scale-[0.96]"
											>
												Add
											</Button>
										</div>
									) : (
										<Button
											type="button"
											onClick={() => setAddingTask(true)}
											className="mt-1 h-8 gap-1.5 rounded-[7px] bg-[#907ce8] px-3 font-semibold text-[#17131f] hover:bg-[#a08ef2] active:scale-[0.96]"
										>
											<Plus className="size-3.5" />
											Add a task
										</Button>
									)}
									{suggestionCount > 0 && (
										<p className="mt-1 text-[#6b6560] text-xs">
											or pin one of the{" "}
											{suggestionCount === 1
												? "tasks"
												: `${suggestionCount} tasks`}{" "}
											waiting below
										</p>
									)}
								</div>
							)}

							{/* ── Add task ── */}
							{!isEmpty && (
								<div className="mt-2">
									{addingTask ? (
										<div className="flex items-center gap-2 rounded-[7px] border border-[#907ce8]/40 bg-[#211e1a] px-3 py-2.5">
											<Input
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
												className="h-7 border-0 bg-transparent text-[#e0d8cf] text-sm placeholder:text-[#4a4540] focus-visible:ring-0"
											/>
											<Button
												type="button"
												size="sm"
												onClick={handleAddTask}
												className="h-7 gap-1.5 rounded-[6px] bg-[#907ce8] px-3 font-semibold text-[#17131f] transition-colors duration-150 hover:bg-[#a08ef2] active:scale-[0.96]"
											>
												Add
											</Button>
										</div>
									) : (
										<Button
											type="button"
											variant="outline"
											onClick={() => setAddingTask(true)}
											className="flex w-full items-center gap-2 rounded-[7px] border-[#2e2b26] border-dashed bg-transparent px-3 py-2.5 text-[#4a4540] text-sm transition-colors duration-150 hover:border-[#907ce8]/40 hover:text-[#907ce8] active:scale-[0.98]"
										>
											<Plus className="size-4" />
											Add to focus
										</Button>
									)}
								</div>
							)}

							{/* ── Overdue ── */}
							<div className="mt-4">
								<OverdueSection />
							</div>

							{/* ── Today's unpinned ── */}
							<div className="mt-4">
								<TodayUnpinnedSection />
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
					</div>
					</ScrollArea>

					{/* ── Right column (30%) ── */}
					<ScrollArea className="min-h-0 h-full w-full lg:w-[30%]">
						<div className="flex flex-col gap-4 p-1">
						<Card className="gap-0 rounded-[10px] border-[#2e2b26] bg-[#1a1714] p-0 transition-colors duration-150 hover:border-[#3a3630]">
							<FocusTimerInline />
						</Card>

						<Card className="flex-1 gap-0 rounded-[10px] border-[#2e2b26] bg-[#1a1714] p-0 transition-colors duration-150 hover:border-[#3a3630]">
							<FocusScratchpadInline />
						</Card>
						</div>
					</ScrollArea>
				</div>
			</section>
		</>
	);
}
