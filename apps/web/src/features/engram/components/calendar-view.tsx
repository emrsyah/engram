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
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@alphonse/ui/components/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

import { useEngramStore } from "../store";
import type { Item, Priority, Space } from "../types";
import { useUIStore } from "../ui-store";
import { usePersistentState } from "../use-persistent-state";
import { Icons } from "./icons";
import { taskTitle } from "./tasks-view";

// Read-only calendar access, requested incrementally when the user connects.
// Kept in sync with GOOGLE_CALENDAR_SCOPE in packages/api/src/routers/calendar.ts.
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

type GoogleEvent = {
	id: string;
	calendarId: string;
	title: string;
	start: string | null;
	end: string | null;
	allDay: boolean;
	htmlLink: string | null;
};

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

	// ── Google Calendar ──────────────────────────────────────────────────────
	// null = never chosen yet (so we can default to Google's own visibility once
	// the list loads); [] = explicitly showing none.
	const [googleCalendarIds, setGoogleCalendarIds] = usePersistentState<string[] | null>(
		"engram.calendar.google.v1",
		null,
	);

	const statusQuery = useQuery(trpc.calendar.status.queryOptions());
	const connected = statusQuery.data?.connected ?? false;
	const calendarsQuery = useQuery(
		trpc.calendar.calendars.queryOptions(undefined, { enabled: connected }),
	);
	const googleCalendars = calendarsQuery.data ?? [];

	useEffect(() => {
		if (googleCalendarIds === null && googleCalendars.length > 0) {
			setGoogleCalendarIds(googleCalendars.filter((c) => c.selectedByDefault).map((c) => c.id));
		}
	}, [googleCalendars, googleCalendarIds, setGoogleCalendarIds]);

	const selectedGoogleIds = googleCalendarIds ?? [];

	const range = useMemo(() => {
		const first = weeks[0][0];
		const last = weeks[5][6];
		const end = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
		return { timeMin: first.toISOString(), timeMax: end.toISOString() };
	}, [weeks]);

	const eventsQuery = useQuery(
		trpc.calendar.events.queryOptions(
			{ timeMin: range.timeMin, timeMax: range.timeMax, calendarIds: selectedGoogleIds },
			{ enabled: connected && selectedGoogleIds.length > 0 },
		),
	);

	const calendarColor = useMemo(() => {
		const map = new Map<string, string>();
		for (const calendar of googleCalendars) if (calendar.color) map.set(calendar.id, calendar.color);
		return map;
	}, [googleCalendars]);

	const googleByDay = useMemo(() => {
		const map = new Map<string, GoogleEvent[]>();
		for (const event of (eventsQuery.data as GoogleEvent[] | undefined) ?? []) {
			if (!event.start) continue;
			const key = event.allDay ? event.start.slice(0, 10) : dateKey(new Date(event.start));
			const list = map.get(key);
			if (list) list.push(event);
			else map.set(key, [event]);
		}
		return map;
	}, [eventsQuery.data]);

	const connectGoogle = () =>
		authClient.linkSocial({
			provider: "google",
			scopes: [GOOGLE_CALENDAR_SCOPE],
			callbackURL: "/calendar",
		});

	const toggleCalendar = (id: string, checked: boolean) =>
		setGoogleCalendarIds((current) => {
			const base = current ?? [];
			return checked ? [...new Set([...base, id])] : base.filter((value) => value !== id);
		});

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
							{connected ? (
								<GoogleCalendarMenu
									calendars={googleCalendars}
									selectedIds={selectedGoogleIds}
									onToggle={toggleCalendar}
									onReconnect={connectGoogle}
								/>
							) : (
								<button
									type="button"
									onClick={connectGoogle}
									disabled={statusQuery.isLoading}
									className="flex h-9 items-center gap-2 rounded-[8px] border border-line-2 bg-sunken px-3 text-ink-2 text-sm hover:text-white disabled:opacity-50"
								>
									<Icons.calendar className="size-4 text-brand" />
									Connect Google
								</button>
							)}
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
										googleEvents={googleByDay.get(dateKey(day)) ?? []}
										calendarColor={calendarColor}
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
	googleEvents,
	calendarColor,
	onAdd,
	onOpenEvent,
}: {
	day: Date;
	inMonth: boolean;
	isToday: boolean;
	events: Item[];
	googleEvents: GoogleEvent[];
	calendarColor: Map<string, string>;
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
				{googleEvents.map((event) => (
					<GoogleEventChip
						key={event.id}
						event={event}
						color={calendarColor.get(event.calendarId) ?? null}
					/>
				))}
			</div>
		</div>
	);
}

/** Read-only event sourced from Google Calendar — opens the event in Google on click. */
function GoogleEventChip({ event, color }: { event: GoogleEvent; color: string | null }) {
	const timed = !event.allDay && event.start ? formatTime(new Date(event.start)) : null;
	const accent = color ?? "var(--color-line-strong)";

	return (
		<a
			href={event.htmlLink ?? undefined}
			target="_blank"
			rel="noreferrer"
			title={event.title}
			style={{ borderLeftColor: accent, background: `color-mix(in srgb, ${accent} 12%, transparent)` }}
			className="flex w-full items-center gap-1 truncate rounded-[5px] border border-line border-l-2 px-1.5 py-0.5 text-left text-[11px] text-ink-2 hover:text-white"
		>
			<span className="size-1.5 shrink-0 rounded-full" style={{ background: accent }} />
			{timed ? <span className="shrink-0 font-mono tabular-nums opacity-80">{timed}</span> : null}
			<span className="min-w-0 flex-1 truncate">{event.title}</span>
		</a>
	);
}

function GoogleCalendarMenu({
	calendars,
	selectedIds,
	onToggle,
	onReconnect,
}: {
	calendars: { id: string; summary: string; primary: boolean; color: string | null }[];
	selectedIds: string[];
	onToggle: (id: string, checked: boolean) => void;
	onReconnect: () => void;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger className="flex h-9 items-center gap-2 rounded-[8px] border border-brand/40 bg-brand-surface px-3 text-brand-soft text-sm hover:text-white">
				<Icons.calendar className="size-4" />
				Google
				<span className="rounded-[5px] bg-fill px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
					{selectedIds.length}
				</span>
				<Icons.chevronRight className="size-4 rotate-90 opacity-60" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-[260px] border border-line-2 bg-panel p-1 text-ink-2">
				<div className="px-2 py-2 text-ink-dim text-xs">Calendars to show</div>
				{calendars.length === 0 ? (
					<div className="px-2 py-3 text-ink-ghost text-xs">No calendars found</div>
				) : (
					calendars.map((calendar) => (
						<DropdownMenuCheckboxItem
							key={calendar.id}
							checked={selectedIds.includes(calendar.id)}
							onCheckedChange={(checked) => onToggle(calendar.id, checked === true)}
							onSelect={(event) => event.preventDefault()}
						>
							<span className="flex min-w-0 items-center gap-2">
								<span
									className="size-2.5 shrink-0 rounded-full"
									style={{ background: calendar.color ?? "var(--color-line-strong)" }}
								/>
								<span className="truncate">{calendar.summary}</span>
							</span>
						</DropdownMenuCheckboxItem>
					))
				)}
				<DropdownMenuSeparator className="my-1 bg-line" />
				<DropdownMenuItem onClick={onReconnect} className="text-ink-dim">
					<Icons.rotate className="size-4" />
					Reconnect / fix permissions
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
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
