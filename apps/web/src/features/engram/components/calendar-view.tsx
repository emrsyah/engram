"use client";

import { Button } from "@alphonse/ui/components/button";
import { cn } from "@alphonse/ui/lib/utils";
import {
	DndContext,
	DragOverlay,
	PointerSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
	type DragEndEvent,
	type DragStartEvent,
} from "@dnd-kit/core";
import { useMemo, useState } from "react";

import { useEngramStore } from "../store";
import type { Item, Priority, Space } from "../types";
import { useUIStore } from "../ui-store";
import { usePersistentState } from "../use-persistent-state";
import { Icons } from "./icons";
import { taskTitle } from "./tasks-view";

type CalendarPrefs = {
	spaceId: string | "all";
	showDone: boolean;
};

const CALENDAR_PREFS_KEY = "engram.calendar.prefs.v1";
const DEFAULT_CALENDAR_PREFS: CalendarPrefs = { spaceId: "all", showDone: false };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
	"January", "February", "March", "April", "May", "June",
	"July", "August", "September", "October", "November", "December",
];

/** Priority → chip classes; undated/no-priority falls back to a neutral fill. */
const EVENT_CLASSES: Record<Priority | "none", string> = {
	1: "border-p1/40 bg-p1 text-p1-ink",
	2: "border-p2/40 bg-p2 text-p2-ink",
	3: "border-p3/40 bg-p3 text-p3-ink",
	none: "border-line-strong bg-fill text-ink-2",
};

function pad2(value: number) {
	return String(value).padStart(2, "0");
}

function dateKey(date: Date) {
	return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function hasTime(dueAt?: string) {
	return !!dueAt && dueAt.includes("T");
}

/** A `YYYY-MM-DD` string is a local calendar day; an ISO string carries a time. */
function parseDue(dueAt: string) {
	if (hasTime(dueAt)) return new Date(dueAt);
	const [year, month, day] = dueAt.split("-").map(Number);
	return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

function startOfDay(date: Date) {
	const copy = new Date(date);
	copy.setHours(0, 0, 0, 0);
	return copy;
}

function isSameDay(a: Date, b: Date) {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

function formatTime(date: Date) {
	return date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		timeZone: "Asia/Jakarta",
	});
}

/** Six weeks of Monday-started days covering the given month (with spillover). */
function monthMatrix(year: number, month: number): Date[][] {
	const first = new Date(year, month, 1);
	// JS: 0=Sun … 6=Sat. Shift so Monday is column 0.
	const lead = (first.getDay() + 6) % 7;
	const start = new Date(year, month, 1 - lead);
	const weeks: Date[][] = [];
	for (let week = 0; week < 6; week++) {
		const days: Date[] = [];
		for (let day = 0; day < 7; day++) {
			days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + week * 7 + day));
		}
		weeks.push(days);
	}
	return weeks;
}

export function CalendarView() {
	const { allTaskItems, spaces, updateItem, createItem } = useEngramStore();
	const { openDetail } = useUIStore();
	const [prefs, setPrefs] = usePersistentState<CalendarPrefs>(
		CALENDAR_PREFS_KEY,
		DEFAULT_CALENDAR_PREFS,
	);

	const today = startOfDay(new Date());
	const [cursor, setCursor] = useState(() => ({ year: today.getFullYear(), month: today.getMonth() }));
	const [activeId, setActiveId] = useState<string | null>(null);
	const activeEvent = activeId ? allTaskItems.find((task) => task.id === activeId) : undefined;

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
	);

	const weeks = useMemo(() => monthMatrix(cursor.year, cursor.month), [cursor]);

	// Bucket scheduled tasks by their due day for O(1) cell lookups.
	const eventsByDay = useMemo(() => {
		const map = new Map<string, Item[]>();
		for (const task of allTaskItems) {
			if (!task.dueAt) continue;
			if (task.done && !prefs.showDone) continue;
			if (prefs.spaceId !== "all" && task.spaceId !== prefs.spaceId) continue;
			const key = dateKey(parseDue(task.dueAt));
			const list = map.get(key);
			if (list) list.push(task);
			else map.set(key, [task]);
		}
		for (const [, list] of map) {
			list.sort((a, b) => {
				const aTime = hasTime(a.dueAt) ? parseDue(a.dueAt!).getTime() : 0;
				const bTime = hasTime(b.dueAt) ? parseDue(b.dueAt!).getTime() : 0;
				if (aTime !== bTime) return aTime - bTime;
				return (a.priority ?? 9) - (b.priority ?? 9);
			});
		}
		return map;
	}, [allTaskItems, prefs.showDone, prefs.spaceId]);

	const goToday = () => setCursor({ year: today.getFullYear(), month: today.getMonth() });
	const step = (delta: number) =>
		setCursor((current) => {
			const next = new Date(current.year, current.month + delta, 1);
			return { year: next.getFullYear(), month: next.getMonth() };
		});

	const addEventOn = (day: Date) => {
		const space = prefs.spaceId !== "all" ? prefs.spaceId : spaces[0]?.id;
		if (!space) return;
		const item = createItem({
			type: "task",
			title: "New task",
			dueAt: dateKey(day),
			taskQueue: "later",
			spaceId: space,
			stayOnCurrentView: true,
		});
		openDetail(item.id);
	};

	const handleDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id));

	const handleDragEnd = ({ active, over }: DragEndEvent) => {
		setActiveId(null);
		if (!over) return;
		const taskId = String(active.id);
		const dayKey = String(over.id).replace("day-", "");
		const task = allTaskItems.find((item) => item.id === taskId);
		if (!task) return;
		if (task.dueAt && dateKey(parseDue(task.dueAt)) === dayKey) return;

		const [year, month, day] = dayKey.split("-").map(Number);
		if (hasTime(task.dueAt)) {
			const prev = parseDue(task.dueAt!);
			const next = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, prev.getHours(), prev.getMinutes(), 0, 0);
			updateItem(taskId, { dueAt: next.toISOString() });
		} else {
			updateItem(taskId, { dueAt: dayKey });
		}
	};

	return (
		<section className="flex h-full flex-col bg-base text-white">
			<div className="min-w-0 flex-1 overflow-y-auto px-5 py-7 lg:px-8">
				<div className="mx-auto flex h-full max-w-[1280px] flex-col">
					<div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
						<div>
							<h2 className="flex items-center gap-3 font-serif font-medium text-3xl tracking-tight">
								<Icons.calendar className="size-7 text-brand-glow" />
								Calendar
							</h2>
							<p className="mt-2 max-w-2xl text-ink-muted text-sm">
								Your scheduled tasks. Click a day to add one, or drag an event to reschedule it.
							</p>
						</div>

						<div className="flex flex-wrap items-center gap-2">
							<SpaceFilter
								spaces={spaces}
								value={prefs.spaceId}
								onChange={(spaceId) => setPrefs((p) => ({ ...p, spaceId }))}
							/>
							<button
								type="button"
								onClick={() => setPrefs((p) => ({ ...p, showDone: !p.showDone }))}
								className={cn(
									"flex h-9 items-center gap-2 rounded-[8px] border px-3 text-sm",
									prefs.showDone
										? "border-brand/40 bg-brand-surface text-brand-soft"
										: "border-line-2 bg-sunken text-ink-2 hover:text-white",
								)}
							>
								<Icons.check className="size-4" />
								Show done
							</button>
						</div>
					</div>

					<div className="mt-6 flex items-center justify-between">
						<h3 className="font-semibold text-ink-bright text-xl">
							{MONTHS[cursor.month]} {cursor.year}
						</h3>
						<div className="flex items-center gap-1.5">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={goToday}
								className="h-9 rounded-[8px] border border-line-2 bg-sunken px-3 text-ink-2 hover:text-white"
							>
								Today
							</Button>
							<button
								type="button"
								onClick={() => step(-1)}
								aria-label="Previous month"
								className="grid size-9 place-items-center rounded-[8px] border border-line-2 bg-sunken text-ink-muted hover:text-white"
							>
								<Icons.chevronLeft className="size-4" />
							</button>
							<button
								type="button"
								onClick={() => step(1)}
								aria-label="Next month"
								className="grid size-9 place-items-center rounded-[8px] border border-line-2 bg-sunken text-ink-muted hover:text-white"
							>
								<Icons.chevronRight className="size-4" />
							</button>
						</div>
					</div>

					<DndContext
						sensors={sensors}
						onDragStart={handleDragStart}
						onDragEnd={handleDragEnd}
						onDragCancel={() => setActiveId(null)}
					>
						<div className="mt-4 flex min-h-[560px] flex-1 flex-col overflow-hidden rounded-[12px] border border-line">
							<div className="grid grid-cols-7 border-line border-b bg-surface">
								{WEEKDAYS.map((weekday) => (
									<div
										key={weekday}
										className="px-3 py-2.5 font-medium text-ink-muted text-xs"
									>
										{weekday}
									</div>
								))}
							</div>
							<div className="grid flex-1 grid-cols-7 grid-rows-6">
								{weeks.flat().map((day) => (
									<DayCell
										key={dateKey(day)}
										day={day}
										inMonth={day.getMonth() === cursor.month}
										isToday={isSameDay(day, today)}
										events={eventsByDay.get(dateKey(day)) ?? []}
										onAdd={() => addEventOn(day)}
										onOpenEvent={openDetail}
									/>
								))}
							</div>
						</div>
						<DragOverlay dropAnimation={null}>
							{activeEvent ? <EventChip event={activeEvent} overlay /> : null}
						</DragOverlay>
					</DndContext>
				</div>
			</div>
		</section>
	);
}

function DayCell({
	day,
	inMonth,
	isToday,
	events,
	onAdd,
	onOpenEvent,
}: {
	day: Date;
	inMonth: boolean;
	isToday: boolean;
	events: Item[];
	onAdd: () => void;
	onOpenEvent: (id: string) => void;
}) {
	const { setNodeRef, isOver } = useDroppable({ id: `day-${dateKey(day)}` });

	return (
		<div
			ref={setNodeRef}
			className={cn(
				"group/cell relative flex min-h-[112px] flex-col gap-1 border-line border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0",
				inMonth ? "bg-base" : "bg-sunken",
				isOver && "bg-brand-surface",
			)}
		>
			<div className="flex items-center justify-between">
				<span
					className={cn(
						"grid size-6 place-items-center rounded-full text-xs",
						isToday ? "bg-brand font-semibold text-brand-ink" : inMonth ? "text-ink-2" : "text-ink-ghost",
					)}
				>
					{day.getDate()}
				</span>
				<button
					type="button"
					onClick={onAdd}
					aria-label="Add task this day"
					className="grid size-5 place-items-center rounded-[5px] text-ink-faint opacity-0 transition-opacity hover:bg-fill hover:text-ink focus-visible:opacity-100 group-hover/cell:opacity-100"
				>
					<Icons.plus className="size-3.5" />
				</button>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
				{events.map((event) => (
					<EventChip key={event.id} event={event} onOpen={() => onOpenEvent(event.id)} />
				))}
			</div>
		</div>
	);
}

function EventChip({
	event,
	onOpen,
	overlay = false,
}: {
	event: Item;
	onOpen?: () => void;
	/** Rendered inside the DragOverlay — static, no drag wiring. */
	overlay?: boolean;
}) {
	const draggable = useDraggable({ id: event.id, disabled: overlay });
	const timed = hasTime(event.dueAt) ? formatTime(parseDue(event.dueAt!)) : null;

	return (
		<button
			ref={overlay ? undefined : draggable.setNodeRef}
			type="button"
			{...(overlay ? {} : draggable.attributes)}
			{...(overlay ? {} : draggable.listeners)}
			onClick={onOpen}
			title={taskTitle(event)}
			className={cn(
				"flex w-full items-center gap-1 truncate rounded-[5px] border px-1.5 py-0.5 text-left font-mono text-[11px]",
				EVENT_CLASSES[event.priority ?? "none"],
				event.done && "opacity-50 line-through",
				overlay ? "cursor-grabbing shadow-lg" : "cursor-grab",
				!overlay && draggable.isDragging && "opacity-40",
			)}
		>
			{timed ? <span className="shrink-0 tabular-nums opacity-80">{timed}</span> : null}
			<span className="min-w-0 flex-1 truncate font-sans">{taskTitle(event)}</span>
		</button>
	);
}

function SpaceFilter({
	spaces,
	value,
	onChange,
}: {
	spaces: Space[];
	value: string | "all";
	onChange: (value: string | "all") => void;
}) {
	return (
		<select
			value={value}
			onChange={(event) => onChange(event.target.value)}
			className="h-9 rounded-[8px] border border-line-2 bg-sunken px-3 text-ink-2 text-sm outline-none hover:text-white focus:border-brand"
		>
			<option value="all">All groups</option>
			{spaces.map((space) => (
				<option key={space.id} value={space.id}>
					{space.name}
				</option>
			))}
		</select>
	);
}
