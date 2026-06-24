"use client";

import { Button } from "@alphonse/ui/components/button";
import { Checkbox } from "@alphonse/ui/components/checkbox";
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
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";

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

type CalendarViewMode = "month" | "week" | "day" | "custom";

type CalendarPrefs = {
	spaceId: string | "all";
	showDone: boolean;
	view: CalendarViewMode;
	customDays: number;
};

// v2 adds `view` + `customDays`; bumped so older stored prefs don't yield an
// undefined view (usePersistentState replaces wholesale, it doesn't merge).
const CALENDAR_PREFS_KEY = "engram.calendar.prefs.v2";
const DEFAULT_CALENDAR_PREFS: CalendarPrefs = {
	spaceId: "all",
	showDone: false,
	view: "month",
	customDays: 3,
};

const VIEW_OPTIONS: { value: CalendarViewMode; label: string }[] = [
	{ value: "month", label: "Month" },
	{ value: "week", label: "Week" },
	{ value: "day", label: "Day" },
	{ value: "custom", label: "Custom" },
];

const HOUR_HEIGHT = 48;
const CUSTOM_DAY_CHOICES = [2, 3, 4, 5];

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

function addDays(date: Date, days: number) {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** A `YYYY-MM-DD` string as a local midnight Date. */
function parseYMD(value: string) {
	const [year, month, day] = value.slice(0, 10).split("-").map(Number);
	return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

/** Inclusive [start, end] day range a Google event covers (all-day end is exclusive). */
function eventSpan(event: GoogleEvent): { start: Date; end: Date } {
	if (event.allDay) {
		const start = parseYMD(event.start ?? "");
		const endExclusive = event.end ? parseYMD(event.end) : addDays(start, 1);
		const end = addDays(endExclusive, -1);
		return { start, end: end < start ? start : end };
	}
	const start = startOfDay(new Date(event.start ?? ""));
	// Subtract 1ms so an event ending exactly at midnight doesn't bleed into the next day.
	const end = event.end ? startOfDay(new Date(new Date(event.end).getTime() - 1)) : start;
	return { start, end: end < start ? start : end };
}

type GoogleEventSpan = { event: GoogleEvent; isStart: boolean; isEnd: boolean };

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

/** Monday-started week containing `date`. */
function weekDays(date: Date): Date[] {
	const lead = (date.getDay() + 6) % 7;
	const start = addDays(startOfDay(date), -lead);
	return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** The visible days for a time-grid view (week / day / custom). */
function timeGridDays(anchor: Date, view: CalendarViewMode, customDays: number): Date[] {
	if (view === "week") return weekDays(anchor);
	if (view === "day") return [startOfDay(anchor)];
	return Array.from({ length: customDays }, (_, i) => addDays(startOfDay(anchor), i));
}

/** Minutes since local midnight for a timed event/task start. */
function minutesOfDay(date: Date) {
	return date.getHours() * 60 + date.getMinutes();
}

/** Compact local-time label from a minute-of-day (matches grid positioning, which is local). */
function formatMin(minutes: number) {
	const hour = Math.floor(minutes / 60);
	const minute = minutes % 60;
	const ampm = hour < 12 ? "am" : "pm";
	const hour12 = hour % 12 === 0 ? 12 : hour % 12;
	return minute === 0 ? `${hour12}${ampm}` : `${hour12}:${pad2(minute)}${ampm}`;
}

export function CalendarView() {
	const { allTaskItems, spaces, updateItem, createItem, toggleDone } = useEngramStore();
	const { openDetail } = useUIStore();
	const [prefs, setPrefs] = usePersistentState<CalendarPrefs>(
		CALENDAR_PREFS_KEY,
		DEFAULT_CALENDAR_PREFS,
	);

	const today = startOfDay(new Date());
	const [cursor, setCursor] = useState(() => ({ year: today.getFullYear(), month: today.getMonth() }));
	// Anchor day for the time-grid views (week / day / custom).
	const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
	const view = prefs.view;
	const isTimeGrid = view !== "month";
	// Live "now" for the current-time line, refreshed each minute.
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		if (!isTimeGrid) return;
		const id = setInterval(() => setNow(new Date()), 60_000);
		return () => clearInterval(id);
	}, [isTimeGrid]);
	const [activeId, setActiveId] = useState<string | null>(null);
	const activeEvent = activeId ? allTaskItems.find((task) => task.id === activeId) : undefined;
	// Mobile: the day whose agenda is shown below the compact grid.
	const [selectedKey, setSelectedKey] = useState(() => dateKey(today));

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
	);

	const weeks = useMemo(() => monthMatrix(cursor.year, cursor.month), [cursor]);
	const visibleDays = useMemo(
		() => timeGridDays(anchor, view, prefs.customDays),
		[anchor, view, prefs.customDays],
	);

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

	// Local opt-out. Google is our only auth provider, so we can't server-side
	// revoke just the calendar scope without breaking sign-in — "Disconnect"
	// hides the integration here; a full revoke is done via Google's settings.
	const [googleHidden, setGoogleHidden] = usePersistentState<boolean>(
		"engram.calendar.google.hidden",
		false,
	);

	// Cache tuning so navigating away and back doesn't blank/reload the calendar:
	// the shared queryClient keeps these cached, staleTime suppresses redundant
	// refetches, and gcTime retains data while the page is unmounted.
	const statusQuery = useQuery(
		trpc.calendar.status.queryOptions(undefined, {
			staleTime: 5 * 60_000,
			gcTime: 30 * 60_000,
		}),
	);
	const grantedOnGoogle = statusQuery.data?.connected ?? false;
	const connected = grantedOnGoogle && !googleHidden;
	const calendarsQuery = useQuery(
		trpc.calendar.calendars.queryOptions(undefined, {
			enabled: connected,
			staleTime: 10 * 60_000,
			gcTime: 30 * 60_000,
		}),
	);
	const googleCalendars = calendarsQuery.data ?? [];

	useEffect(() => {
		if (googleCalendarIds === null && googleCalendars.length > 0) {
			setGoogleCalendarIds(googleCalendars.filter((c) => c.selectedByDefault).map((c) => c.id));
		}
	}, [googleCalendars, googleCalendarIds, setGoogleCalendarIds]);

	const selectedGoogleIds = googleCalendarIds ?? [];

	const range = useMemo(() => {
		const first = isTimeGrid ? visibleDays[0] : weeks[0][0];
		const last = isTimeGrid ? visibleDays[visibleDays.length - 1] : weeks[5][6];
		const end = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
		return { timeMin: first.toISOString(), timeMax: end.toISOString() };
	}, [weeks, isTimeGrid, visibleDays]);

	const eventsQuery = useQuery(
		trpc.calendar.events.queryOptions(
			{ timeMin: range.timeMin, timeMax: range.timeMax, calendarIds: selectedGoogleIds },
			{
				enabled: connected && selectedGoogleIds.length > 0,
				staleTime: 5 * 60_000,
				gcTime: 30 * 60_000,
				// Keep showing the previous month's/visit's events while the next
				// fetch resolves, so switching months or revisiting never flashes empty.
				placeholderData: keepPreviousData,
			},
		),
	);

	const calendarColor = useMemo(() => {
		const map = new Map<string, string>();
		for (const calendar of googleCalendars) if (calendar.color) map.set(calendar.id, calendar.color);
		return map;
	}, [googleCalendars]);

	// Spread each event across every day it covers (clamped to the visible grid)
	// so multi-day events read as a continuous run, with start/middle/end styling.
	const googleByDay = useMemo(() => {
		const map = new Map<string, GoogleEventSpan[]>();
		const gridStart = startOfDay(weeks[0][0]);
		const gridEnd = startOfDay(weeks[5][6]);
		for (const event of (eventsQuery.data as GoogleEvent[] | undefined) ?? []) {
			if (!event.start) continue;
			const span = eventSpan(event);
			const firstDay = span.start < gridStart ? gridStart : span.start;
			const lastDay = span.end > gridEnd ? gridEnd : span.end;
			for (let day = firstDay; day <= lastDay; day = addDays(day, 1)) {
				const isStart = isSameDay(day, span.start);
				const isEnd = isSameDay(day, span.end);
				const key = dateKey(day);
				const list = map.get(key);
				const entry = { event, isStart, isEnd };
				if (list) list.push(entry);
				else map.set(key, [entry]);
			}
		}
		// Stable global ordering (earliest start, then id) so a multi-day run keeps
		// the same lane across every cell it touches — making the bar look connected.
		for (const [, list] of map) {
			list.sort((a, b) => {
				const startCmp = (a.event.start ?? "").localeCompare(b.event.start ?? "");
				return startCmp !== 0 ? startCmp : a.event.id.localeCompare(b.event.id);
			});
		}
		return map;
	}, [eventsQuery.data, weeks]);

	const connectGoogle = () => {
		setGoogleHidden(false);
		// Already granted on Google's side (just hidden locally) → no need to re-consent.
		if (grantedOnGoogle) return;
		authClient.linkSocial({
			provider: "google",
			scopes: [GOOGLE_CALENDAR_SCOPE],
			callbackURL: "/calendar",
		});
	};

	const disconnectGoogle = () => {
		setGoogleHidden(true);
		setGoogleCalendarIds([]);
	};

	const toggleCalendar = (id: string, checked: boolean) =>
		setGoogleCalendarIds((current) => {
			const base = current ?? [];
			return checked ? [...new Set([...base, id])] : base.filter((value) => value !== id);
		});

	const goToday = () => {
		setCursor({ year: today.getFullYear(), month: today.getMonth() });
		setAnchor(today);
		setSelectedKey(dateKey(today));
	};
	const step = (delta: number) => {
		if (isTimeGrid) {
			const stride = view === "week" ? 7 : view === "day" ? 1 : prefs.customDays;
			setAnchor((current) => addDays(current, delta * stride));
			return;
		}
		setCursor((current) => {
			const next = new Date(current.year, current.month + delta, 1);
			setSelectedKey(dateKey(next));
			return { year: next.getFullYear(), month: next.getMonth() };
		});
	};

	// Title reflects the active view's visible window.
	const rangeTitle = (() => {
		if (!isTimeGrid) return `${MONTHS[cursor.month]} ${cursor.year}`;
		const first = visibleDays[0];
		const last = visibleDays[visibleDays.length - 1];
		if (view === "day") {
			return first.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
		}
		const sameMonth = first.getMonth() === last.getMonth();
		const left = first.toLocaleDateString("en-US", { month: "short", day: "numeric" });
		const right = last.toLocaleDateString("en-US", sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" });
		return `${left} – ${right}`;
	})();

	const setView = (next: CalendarViewMode) => {
		// Entering a time-grid view from month → anchor on the selected/today day.
		if (next !== "month" && view === "month") setAnchor(parseYMD(selectedKey));
		setPrefs((p) => ({ ...p, view: next }));
	};

	// Mobile: tap a day → show its agenda; follow spillover days into their month.
	const selectDay = (day: Date) => {
		setSelectedKey(dateKey(day));
		if (day.getMonth() !== cursor.month) setCursor({ year: day.getFullYear(), month: day.getMonth() });
	};

	const selectedDay = parseYMD(selectedKey);

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

	// Time-grid: click an empty slot → new task at that minute-of-day.
	const addEventAt = (day: Date, minutes: number) => {
		const space = prefs.spaceId !== "all" ? prefs.spaceId : spaces[0]?.id;
		if (!space) return;
		const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60, 0, 0);
		const item = createItem({
			type: "task",
			title: "New task",
			dueAt: at.toISOString(),
			taskQueue: "later",
			spaceId: space,
			stayOnCurrentView: true,
		});
		openDetail(item.id);
	};

	const handleResizeEnd = (id: string, startMin: number, _endMin: number) => {
		const task = allTaskItems.find((item) => item.id === id);
		if (!task?.dueAt) return;
		const orig = parseDue(task.dueAt);
		const next = new Date(orig.getFullYear(), orig.getMonth(), orig.getDate(), Math.floor(startMin / 60), startMin % 60, 0, 0);
		updateItem(id, { dueAt: next.toISOString() });
	};

	const handleDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id));

	const handleDragEnd = ({ active, over, delta }: DragEndEvent) => {
		setActiveId(null);
		if (!over) return;
		const taskId = String(active.id);
		const overId = String(over.id);

		// Strip prefix to get raw date key
		let dayKey: string;
		let isAllDayDrop = false;
		if (overId.startsWith("allday-")) {
			dayKey = overId.replace("allday-", "");
			isAllDayDrop = true;
		} else {
			dayKey = overId.replace("day-", "");
		}

		const task = allTaskItems.find((item) => item.id === taskId);
		if (!task) return;

		const [year, month, day] = dayKey.split("-").map(Number);

		// Time-grid drop onto a timed day column: shift time by drag delta.
		if (isTimeGrid && !isAllDayDrop && hasTime(task.dueAt)) {
			const prev = parseDue(task.dueAt!);
			const deltaMin = Math.round((delta.y / HOUR_HEIGHT) * 60 / 15) * 15;
			const origMin = minutesOfDay(prev);
			const newMin = Math.max(0, Math.min(23 * 60 + 45, origMin + deltaMin));
			const next = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, Math.floor(newMin / 60), newMin % 60, 0, 0);
			updateItem(taskId, { dueAt: next.toISOString() });
			return;
		}

		// All other drops: just change the date, preserve time if any.
		if (task.dueAt && dateKey(parseDue(task.dueAt)) === dayKey) return;
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
			<div className="min-w-0 flex-1 overflow-y-auto px-5 pt-7 pb-28 lg:px-8">
				<div className="mx-auto flex max-w-[1280px] flex-col">
					<div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
						<div>
							<h2 className="flex items-center gap-3 font-serif font-medium text-2xl tracking-tight sm:text-3xl">
								<Icons.calendar className="size-6 text-brand-glow sm:size-7" />
								Calendar
							</h2>
							<p className="mt-2 max-w-2xl text-ink-muted text-sm">
								Your scheduled tasks. <span className="hidden sm:inline">Click a day to add one, or drag an event to reschedule it.</span>
								<span className="sm:hidden">Tap a day to see and add events.</span>
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
									syncing={calendarsQuery.isFetching || eventsQuery.isFetching}
									onToggle={toggleCalendar}
									onReconnect={connectGoogle}
									onDisconnect={disconnectGoogle}
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

					<div className="mt-6 flex flex-wrap items-center justify-between gap-3">
						<h3 className="font-semibold text-ink-bright text-xl">{rangeTitle}</h3>
						<div className="flex flex-wrap items-center gap-1.5">
							<ViewSwitcher value={view} onChange={setView} />
							{view === "custom" ? (
								<CustomDaysPicker
									value={prefs.customDays}
									onChange={(customDays) => setPrefs((p) => ({ ...p, customDays }))}
								/>
							) : null}
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
								aria-label="Previous"
								className="grid size-9 place-items-center rounded-[8px] border border-line-2 bg-sunken text-ink-muted hover:text-white"
							>
								<Icons.chevronLeft className="size-4" />
							</button>
							<button
								type="button"
								onClick={() => step(1)}
								aria-label="Next"
								className="grid size-9 place-items-center rounded-[8px] border border-line-2 bg-sunken text-ink-muted hover:text-white"
							>
								<Icons.chevronRight className="size-4" />
							</button>
						</div>
					</div>

					{isTimeGrid ? (
						<TimeGridView
							days={visibleDays}
							view={view}
							now={now}
							eventsByDay={eventsByDay}
							googleEvents={(eventsQuery.data as GoogleEvent[] | undefined) ?? []}
							calendarColor={calendarColor}
							sensors={sensors}
							activeEvent={activeEvent}
							isDraggingEvent={!!activeEvent}
							onDragStart={handleDragStart}
							onDragEnd={handleDragEnd}
							onDragCancel={() => setActiveId(null)}
							onAdd={addEventOn}
							onAddAt={addEventAt}
							onOpenEvent={openDetail}
							onResizeEnd={handleResizeEnd}
						/>
					) : (
					<>
					{/* Desktop: full month grid with drag-to-reschedule. */}
					<div className="hidden md:block">
						<DndContext
							sensors={sensors}
							onDragStart={handleDragStart}
							onDragEnd={handleDragEnd}
							onDragCancel={() => setActiveId(null)}
						>
							<div className="mt-4 flex flex-col overflow-hidden rounded-[12px] border border-line">
								<div className="sticky top-0 z-10 grid grid-cols-7 border-line border-b bg-surface">
									{WEEKDAYS.map((weekday) => (
										<div
											key={weekday}
											className="px-3 py-2.5 font-medium text-ink-muted text-xs"
										>
											{weekday}
										</div>
									))}
								</div>
								<div className="grid grid-cols-7 [grid-auto-rows:minmax(116px,auto)]">
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

					{/* Mobile: compact tappable grid + selected-day agenda. */}
					<div className="md:hidden">
						<div className="mt-4 overflow-hidden rounded-[12px] border border-line">
							<div className="grid grid-cols-7 border-line border-b bg-surface">
								{WEEKDAYS.map((weekday) => (
									<div key={weekday} className="py-2 text-center font-medium text-ink-muted text-[11px]">
										{weekday.slice(0, 1)}
									</div>
								))}
							</div>
							<div className="grid grid-cols-7">
								{weeks.flat().map((day) => {
									const key = dateKey(day);
									return (
										<MiniDay
											key={key}
											day={day}
											inMonth={day.getMonth() === cursor.month}
											isToday={isSameDay(day, today)}
											isSelected={key === selectedKey}
											tasks={eventsByDay.get(key) ?? []}
											googleSpans={googleByDay.get(key) ?? []}
											calendarColor={calendarColor}
											onSelect={() => selectDay(day)}
										/>
									);
								})}
							</div>
						</div>

						<MobileAgenda
							day={selectedDay}
							isToday={isSameDay(selectedDay, today)}
							tasks={eventsByDay.get(selectedKey) ?? []}
							googleSpans={googleByDay.get(selectedKey) ?? []}
							calendarColor={calendarColor}
							onAdd={() => addEventOn(selectedDay)}
							onOpenTask={openDetail}
							onToggleDone={toggleDone}
						/>
					</div>
					</>
					)}
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
	googleEvents: GoogleEventSpan[];
	calendarColor: Map<string, string>;
	onAdd: () => void;
	onOpenEvent: (id: string) => void;
}) {
	const { setNodeRef, isOver } = useDroppable({ id: `day-${dateKey(day)}` });

	return (
		<div
			ref={setNodeRef}
			className={cn(
				"group/cell relative flex flex-col gap-1 border-line border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0",
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
			{/* Multi-day Google events first, consistently ordered, so runs line up across cells. */}
			<div className="flex flex-col gap-1">
				{googleEvents.map(({ event, isStart, isEnd }) => (
					<GoogleEventChip
						key={event.id}
						event={event}
						color={calendarColor.get(event.calendarId) ?? null}
						isStart={isStart}
						isEnd={isEnd}
					/>
				))}
				{events.map((event) => (
					<EventChip key={event.id} event={event} onOpen={() => onOpenEvent(event.id)} />
				))}
			</div>
		</div>
	);
}

/** Read-only event sourced from Google Calendar — opens the event in Google on click. */
function GoogleEventChip({
	event,
	color,
	isStart,
	isEnd,
}: {
	event: GoogleEvent;
	color: string | null;
	isStart: boolean;
	isEnd: boolean;
}) {
	const timed = isStart && !event.allDay && event.start ? formatTime(new Date(event.start)) : null;
	const accent = color ?? "var(--color-line-strong)";
	const continues = !isStart || !isEnd;

	return (
		<a
			href={event.htmlLink ?? undefined}
			target="_blank"
			rel="noreferrer"
			title={event.title}
			style={{
				// Left accent + left rounding only where the run begins; right rounding only where it ends.
				borderLeftColor: isStart ? accent : "transparent",
				background: `color-mix(in srgb, ${accent} 12%, transparent)`,
				borderTopLeftRadius: isStart ? 5 : 0,
				borderBottomLeftRadius: isStart ? 5 : 0,
				borderTopRightRadius: isEnd ? 5 : 0,
				borderBottomRightRadius: isEnd ? 5 : 0,
			}}
			className={cn(
				"flex w-full items-center gap-1 truncate border border-line border-l-2 px-1.5 py-0.5 text-left text-[11px] text-ink-2 hover:text-white",
				continues && "border-dashed",
			)}
		>
			{isStart ? (
				<span className="size-1.5 shrink-0 rounded-full" style={{ background: accent }} />
			) : (
				<Icons.chevronRight className="size-3 shrink-0 opacity-40" />
			)}
			{timed ? <span className="shrink-0 font-mono tabular-nums opacity-80">{timed}</span> : null}
			<span className="min-w-0 flex-1 truncate">{event.title}</span>
		</a>
	);
}

function GoogleCalendarMenu({
	calendars,
	selectedIds,
	syncing,
	onToggle,
	onReconnect,
	onDisconnect,
}: {
	calendars: { id: string; summary: string; primary: boolean; color: string | null }[];
	selectedIds: string[];
	syncing: boolean;
	onToggle: (id: string, checked: boolean) => void;
	onReconnect: () => void;
	onDisconnect: () => void;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger className="flex h-9 items-center gap-2 rounded-[8px] border border-brand/40 bg-brand-surface px-3 text-brand-soft text-sm hover:text-white">
				<Icons.calendar className="size-4" />
				Google
				{syncing ? (
					<Icons.rotate className="size-3.5 animate-spin text-ink-muted" />
				) : (
					<span className="rounded-[5px] bg-fill px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
						{selectedIds.length}
					</span>
				)}
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
				<DropdownMenuItem onClick={onDisconnect} className="text-ink-dim">
					<Icons.x className="size-4" />
					Disconnect calendar
				</DropdownMenuItem>
				<a
					href="https://myaccount.google.com/connections"
					target="_blank"
					rel="noreferrer"
					className="flex items-center gap-2 rounded-[6px] px-2 py-1.5 text-ink-faint text-xs hover:bg-fill hover:text-ink-2"
				>
					<Icons.arrowUpRight className="size-3.5" />
					Revoke access in Google
				</a>
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

/** Draggable all-day task chip for the time-grid all-day strip. */
function AllDayTaskChip({ task, onOpen }: { task: Item; onOpen: () => void }) {
	const draggable = useDraggable({ id: task.id });
	return (
		<button
			ref={draggable.setNodeRef}
			type="button"
			{...draggable.attributes}
			{...draggable.listeners}
			onClick={onOpen}
			title={taskTitle(task)}
			className={cn(
				"truncate rounded-[5px] border px-1.5 py-0.5 text-left text-[11px] cursor-grab",
				EVENT_CLASSES[task.priority ?? "none"],
				task.done && "opacity-50 line-through",
				draggable.isDragging && "opacity-40",
			)}
		>
			{taskTitle(task)}
		</button>
	);
}

/** Dot color for a task in the compact mobile grid. */
function taskDotColor(task: Item) {
	if (task.done) return "var(--color-done)";
	if (task.priority === 1) return "var(--color-coral)";
	if (task.priority === 2) return "var(--color-amber)";
	if (task.priority === 3) return "var(--color-blue)";
	return "var(--color-ink-muted)";
}

/** Compact, tappable day cell for the mobile month grid (number + event dots). */
function MiniDay({
	day,
	inMonth,
	isToday,
	isSelected,
	tasks,
	googleSpans,
	calendarColor,
	onSelect,
}: {
	day: Date;
	inMonth: boolean;
	isToday: boolean;
	isSelected: boolean;
	tasks: Item[];
	googleSpans: GoogleEventSpan[];
	calendarColor: Map<string, string>;
	onSelect: () => void;
}) {
	const dots = [
		...tasks.map((task) => taskDotColor(task)),
		...googleSpans.map(({ event }) => calendarColor.get(event.calendarId) ?? "var(--color-line-strong)"),
	];
	const shown = dots.slice(0, 4);
	const extra = dots.length - shown.length;

	return (
		<button
			type="button"
			onClick={onSelect}
			className={cn(
				"flex min-h-[54px] flex-col items-center gap-1 border-line border-r border-b py-1.5 active:bg-fill [&:nth-child(7n)]:border-r-0",
				isSelected && "bg-brand-surface",
			)}
		>
			<span
				className={cn(
					"grid size-7 place-items-center rounded-full text-[13px]",
					isToday
						? "bg-brand font-semibold text-brand-ink"
						: isSelected
							? "font-semibold text-white"
							: inMonth
								? "text-ink-2"
								: "text-ink-ghost",
				)}
			>
				{day.getDate()}
			</span>
			<span className="flex h-1.5 items-center gap-0.5">
				{shown.map((color, index) => (
					<span key={index} className="size-1.5 rounded-full" style={{ background: color }} />
				))}
				{extra > 0 ? <span className="ml-0.5 text-[8px] text-ink-faint leading-none">+</span> : null}
			</span>
		</button>
	);
}

function MobileAgenda({
	day,
	isToday,
	tasks,
	googleSpans,
	calendarColor,
	onAdd,
	onOpenTask,
	onToggleDone,
}: {
	day: Date;
	isToday: boolean;
	tasks: Item[];
	googleSpans: GoogleEventSpan[];
	calendarColor: Map<string, string>;
	onAdd: () => void;
	onOpenTask: (id: string) => void;
	onToggleDone: (id: string) => void;
}) {
	const heading = isToday
		? "Today"
		: day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
	const empty = tasks.length === 0 && googleSpans.length === 0;

	return (
		<div className="mt-5">
			<div className="flex items-center justify-between">
				<h4 className="font-semibold text-ink-bright">{heading}</h4>
				<Button
					type="button"
					size="sm"
					onClick={onAdd}
					className="h-9 gap-1.5 rounded-[8px] bg-brand px-3 font-semibold text-brand-ink hover:bg-brand-bright"
				>
					<Icons.plus className="size-4" />
					Add
				</Button>
			</div>
			<div className="mt-3 space-y-2">
				{googleSpans.map(({ event }) => (
					<a
						key={event.id}
						href={event.htmlLink ?? undefined}
						target="_blank"
						rel="noreferrer"
						className="flex items-center gap-2.5 rounded-[8px] border border-line bg-surface px-3 py-2.5"
					>
						<span
							className="size-2.5 shrink-0 rounded-full"
							style={{ background: calendarColor.get(event.calendarId) ?? "var(--color-line-strong)" }}
						/>
						{!event.allDay && event.start ? (
							<span className="shrink-0 font-mono text-ink-muted text-[11px] tabular-nums">
								{formatTime(new Date(event.start))}
							</span>
						) : null}
						<span className="min-w-0 flex-1 truncate text-ink-2 text-sm">{event.title}</span>
						<Icons.arrowUpRight className="size-3.5 shrink-0 text-ink-faint" />
					</a>
				))}
				{tasks.map((task) => (
					<MobileTaskRow
						key={task.id}
						task={task}
						onOpen={() => onOpenTask(task.id)}
						onToggleDone={() => onToggleDone(task.id)}
					/>
				))}
				{empty ? (
					<div className="rounded-[8px] border border-line border-dashed px-3 py-8 text-center text-ink-ghost text-sm">
						Nothing scheduled. Tap Add to create a task.
					</div>
				) : null}
			</div>
		</div>
	);
}

function MobileTaskRow({
	task,
	onOpen,
	onToggleDone,
}: {
	task: Item;
	onOpen: () => void;
	onToggleDone: () => void;
}) {
	const timed = hasTime(task.dueAt) ? formatTime(parseDue(task.dueAt!)) : null;

	return (
		<div className="flex items-center gap-3 rounded-[8px] border border-line bg-surface px-3 py-2.5">
			<span onClick={(event) => event.stopPropagation()}>
				<Checkbox checked={task.done} onCheckedChange={onToggleDone} className="rounded-full" />
			</span>
			<button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
				<span
					className={cn(
						"block truncate font-medium text-ink-bright text-sm",
						task.done && "text-done line-through",
					)}
				>
					{taskTitle(task)}
				</span>
				{timed || task.priority ? (
					<span className="mt-0.5 flex items-center gap-2">
						{timed ? <span className="font-mono text-ink-muted text-[11px]">{timed}</span> : null}
						{task.priority ? (
							<span className={cn("rounded-[4px] border px-1.5 font-bold text-[10px]", EVENT_CLASSES[task.priority])}>
								P{task.priority}
							</span>
						) : null}
					</span>
				) : null}
			</button>
		</div>
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

function ViewSwitcher({
	value,
	onChange,
}: {
	value: CalendarViewMode;
	onChange: (value: CalendarViewMode) => void;
}) {
	return (
		<div className="flex items-center rounded-[8px] border border-line-2 bg-sunken p-0.5">
			{VIEW_OPTIONS.map((option) => (
				<button
					key={option.value}
					type="button"
					onClick={() => onChange(option.value)}
					className={cn(
						"h-8 rounded-[6px] px-3 font-medium text-sm",
						value === option.value
							? "bg-brand text-brand-ink"
							: "text-ink-2 hover:text-white",
					)}
				>
					{option.label}
				</button>
			))}
		</div>
	);
}

function CustomDaysPicker({
	value,
	onChange,
}: {
	value: number;
	onChange: (value: number) => void;
}) {
	return (
		<div className="flex items-center rounded-[8px] border border-line-2 bg-sunken p-0.5">
			{CUSTOM_DAY_CHOICES.map((choice) => (
				<button
					key={choice}
					type="button"
					onClick={() => onChange(choice)}
					aria-label={`${choice} days`}
					className={cn(
						"grid size-8 place-items-center rounded-[6px] font-mono text-sm tabular-nums",
						value === choice ? "bg-fill text-white" : "text-ink-muted hover:text-white",
					)}
				>
					{choice}
				</button>
			))}
		</div>
	);
}

// ── Time-grid views (week / day / custom) ────────────────────────────────────

type TimedEntry = {
	key: string;
	id: string;
	title: string;
	startMin: number;
	endMin: number;
	lane: number;
	cols: number;
} & (
	| { kind: "task"; task: Item }
	| { kind: "google"; href: string | null; color: string }
);

type AllDayEntry =
	| { kind: "task"; key: string; task: Item }
	| { kind: "google"; key: string; event: GoogleEvent; color: string };

const HOURS = Array.from({ length: 24 }, (_, i) => i);

/** Greedy lane assignment so overlapping timed entries sit side-by-side. */
function layoutDay(entries: TimedEntry[]): TimedEntry[] {
	const sorted = [...entries].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
	const out: TimedEntry[] = [];
	let cluster: TimedEntry[] = [];
	let clusterEnd = Number.NEGATIVE_INFINITY;
	const flush = () => {
		const laneEnds: number[] = [];
		for (const entry of cluster) {
			let lane = laneEnds.findIndex((end) => end <= entry.startMin);
			if (lane === -1) {
				lane = laneEnds.length;
				laneEnds.push(entry.endMin);
			} else {
				laneEnds[lane] = entry.endMin;
			}
			entry.lane = lane;
		}
		for (const entry of cluster) entry.cols = laneEnds.length;
		out.push(...cluster);
		cluster = [];
		clusterEnd = Number.NEGATIVE_INFINITY;
	};
	for (const entry of sorted) {
		if (cluster.length && entry.startMin >= clusterEnd) flush();
		cluster.push(entry);
		clusterEnd = Math.max(clusterEnd, entry.endMin);
	}
	if (cluster.length) flush();
	return out;
}

/** Droppable all-day cell wrapper so tasks can be dragged into the all-day strip. */
function AllDayDropCell({ dayKey, children }: { dayKey: string; children: React.ReactNode }) {
	const { setNodeRef, isOver } = useDroppable({ id: `allday-${dayKey}` });
	return (
		<div
			ref={setNodeRef}
			className={cn(
				"flex flex-col gap-1 border-line border-r p-1 last:border-r-0",
				isOver && "bg-brand-surface/30",
			)}
		>
			{children}
		</div>
	);
}

function TimeGridView({
	days,
	view,
	now,
	eventsByDay,
	googleEvents,
	calendarColor,
	sensors,
	activeEvent,
	isDraggingEvent,
	onDragStart,
	onDragEnd,
	onDragCancel,
	onAdd,
	onAddAt,
	onOpenEvent,
	onResizeEnd,
}: {
	days: Date[];
	view: CalendarViewMode;
	now: Date;
	eventsByDay: Map<string, Item[]>;
	googleEvents: GoogleEvent[];
	calendarColor: Map<string, string>;
	sensors: ReturnType<typeof useSensors>;
	activeEvent: Item | undefined;
	isDraggingEvent: boolean;
	onDragStart: (event: DragStartEvent) => void;
	onDragEnd: (event: DragEndEvent) => void;
	onDragCancel: () => void;
	onAdd: (day: Date) => void;
	onAddAt: (day: Date, minutes: number) => void;
	onOpenEvent: (id: string) => void;
	onResizeEnd: (id: string, startMin: number, endMin: number) => void;
}) {
	const today = startOfDay(now);
	const dayKeys = useMemo(() => days.map(dateKey), [days]);
	const scrollRef = useRef<HTMLDivElement>(null);

	// Open centered on "now" (or 8am if today isn't visible) instead of dead midnight.
	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		const showsToday = dayKeys.includes(dateKey(today));
		const target = showsToday ? minutesOfDay(now) : 8 * 60;
		el.scrollTop = Math.max(0, (target / 60) * HOUR_HEIGHT - 96);
		// Intentionally not depending on `now` — we scroll on view/day change, not every minute.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [view, dayKeys]);

	const { timedByKey, allDayByKey } = useMemo(() => {
		const visible = new Set(dayKeys);
		const timed = new Map<string, TimedEntry[]>();
		const allDay = new Map<string, AllDayEntry[]>();
		const pushTimed = (key: string, entry: TimedEntry) => {
			const list = timed.get(key);
			if (list) list.push(entry);
			else timed.set(key, [entry]);
		};
		const pushAllDay = (key: string, entry: AllDayEntry) => {
			const list = allDay.get(key);
			if (list) list.push(entry);
			else allDay.set(key, [entry]);
		};

		for (const key of dayKeys) {
			for (const task of eventsByDay.get(key) ?? []) {
				if (hasTime(task.dueAt)) {
					const start = parseDue(task.dueAt!);
					const startMin = minutesOfDay(start);
					pushTimed(key, {
						kind: "task",
						key,
						id: task.id,
						title: taskTitle(task),
						startMin,
						endMin: Math.min(startMin + 45, 24 * 60),
						lane: 0,
						cols: 1,
						task,
					});
				} else {
					pushAllDay(key, { kind: "task", key, task });
				}
			}
		}

		for (const event of googleEvents) {
			if (!event.start) continue;
			const color = calendarColor.get(event.calendarId) ?? "var(--color-line-strong)";
			if (event.allDay) {
				const span = eventSpan(event);
				for (const key of dayKeys) {
					const day = parseYMD(key);
					if (day >= span.start && day <= span.end) pushAllDay(key, { kind: "google", key, event, color });
				}
				continue;
			}
			const start = new Date(event.start);
			const key = dateKey(start);
			if (!visible.has(key)) continue;
			const startMin = minutesOfDay(start);
			const endMin = event.end
				? Math.max(startMin + 15, Math.min(minutesOfDay(new Date(event.end)), 24 * 60))
				: Math.min(startMin + 45, 24 * 60);
			pushTimed(key, {
				kind: "google",
				key,
				id: event.id,
				title: event.title,
				startMin,
				endMin,
				lane: 0,
				cols: 1,
				href: event.htmlLink,
				color,
			});
		}

		for (const [key, list] of timed) timed.set(key, layoutDay(list));
		return { timedByKey: timed, allDayByKey: allDay };
	}, [dayKeys, eventsByDay, googleEvents, calendarColor]);

	const hasAnyAllDay = useMemo(
		() => dayKeys.some((key) => (allDayByKey.get(key)?.length ?? 0) > 0),
		[dayKeys, allDayByKey],
	);

	const colsClass = view === "day" ? "grid-cols-1" : undefined;
	const gridStyle = view === "day" ? undefined : { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` };

	return (
		<DndContext
			sensors={sensors}
			onDragStart={onDragStart}
			onDragEnd={onDragEnd}
			onDragCancel={onDragCancel}
		>
			<div className="mt-4 overflow-hidden rounded-[12px] border border-line">
				{/* Day headers, aligned with the time gutter below. */}
				<div className="flex border-line border-b bg-surface">
					<div className="w-14 shrink-0 border-line border-r" />
					<div className={cn("grid flex-1", colsClass)} style={gridStyle}>
						{days.map((day) => {
							const isToday = isSameDay(day, today);
							return (
								<button
									key={dateKey(day)}
									type="button"
									onClick={() => onAdd(day)}
									className="flex items-center justify-center gap-2 border-line border-r py-2 last:border-r-0 hover:bg-fill"
									title="Add task this day"
								>
									<span className="font-medium text-ink-muted text-xs uppercase">
										{day.toLocaleDateString("en-US", { weekday: "short" })}
									</span>
									<span
										className={cn(
											"grid size-6 place-items-center rounded-full text-sm",
											isToday ? "bg-brand font-semibold text-brand-ink" : "text-ink-2",
										)}
									>
										{day.getDate()}
									</span>
								</button>
							);
						})}
					</div>
				</div>

				{/* All-day strip — only when something lands here. */}
				{hasAnyAllDay ? (
					<div className="flex border-line border-b bg-sunken/50">
						<div className="grid w-14 shrink-0 place-items-center border-line border-r py-1 text-ink-faint text-[10px] uppercase">
							All day
						</div>
						<div className={cn("grid flex-1", colsClass)} style={gridStyle}>
							{dayKeys.map((key) => (
								<AllDayDropCell key={key} dayKey={key}>
									{(allDayByKey.get(key) ?? []).map((entry) =>
										entry.kind === "task" ? (
											<AllDayTaskChip
												key={`t-${entry.task.id}`}
												task={entry.task}
												onOpen={() => onOpenEvent(entry.task.id)}
											/>
										) : (
											<a
												key={`g-${entry.event.id}`}
												href={entry.event.htmlLink ?? undefined}
												target="_blank"
												rel="noreferrer"
												title={entry.event.title}
												style={{ background: `color-mix(in srgb, ${entry.color} 12%, transparent)`, borderLeftColor: entry.color }}
												className="truncate rounded-[5px] border border-line border-l-2 px-1.5 py-0.5 text-left text-[11px] text-ink-2 hover:text-white"
											>
												{entry.event.title}
											</a>
										),
									)}
								</AllDayDropCell>
							))}
						</div>
					</div>
				) : null}

				{/* Scrollable hour grid. */}
				<div ref={scrollRef} className="max-h-[calc(100vh-320px)] overflow-y-auto">
					<div className="flex">
						{/* Hour gutter. */}
						<div className="w-14 shrink-0">
							{HOURS.map((hour) => (
								<div key={hour} className="relative border-line border-r" style={{ height: HOUR_HEIGHT }}>
									{hour > 0 ? (
										<span className="-top-2 absolute right-1.5 text-ink-faint text-[10px] tabular-nums">
											{hour % 12 === 0 ? 12 : hour % 12}
											{hour < 12 ? "am" : "pm"}
										</span>
									) : null}
								</div>
							))}
						</div>
						{/* Day columns. */}
						<div className={cn("grid flex-1", colsClass)} style={gridStyle}>
							{days.map((day) => (
								<DayColumn
									key={dateKey(day)}
									day={day}
									isToday={isSameDay(day, today)}
									nowMin={minutesOfDay(now)}
									timed={timedByKey.get(dateKey(day)) ?? []}
									isDraggingEvent={isDraggingEvent}
									onAddAt={onAddAt}
									onOpenEvent={onOpenEvent}
									onResizeEnd={onResizeEnd}
								/>
							))}
						</div>
					</div>
				</div>
			</div>
			<DragOverlay dropAnimation={null}>
				{activeEvent ? <EventChip event={activeEvent} overlay /> : null}
			</DragOverlay>
		</DndContext>
	);
}

function DayColumn({
	day,
	isToday,
	nowMin,
	timed,
	isDraggingEvent,
	onAddAt,
	onOpenEvent,
	onResizeEnd,
}: {
	day: Date;
	isToday: boolean;
	nowMin: number;
	timed: TimedEntry[];
	isDraggingEvent: boolean;
	onAddAt: (day: Date, minutes: number) => void;
	onOpenEvent: (id: string) => void;
	onResizeEnd: (id: string, startMin: number, endMin: number) => void;
}) {
	const { setNodeRef, isOver } = useDroppable({ id: `day-${dateKey(day)}` });
	const columnRef = useRef<HTMLDivElement | null>(null);
	const [hoverMin, setHoverMin] = useState<number | null>(null);
	const [createGesture, setCreateGesture] = useState<{ startMin: number; endMin: number } | null>(null);
	const gestureRef = useRef<{ startMin: number; endMin: number } | null>(null);
	// Resize state lives here (not in TimedBlock) so parent-controlled props survive React
	// StrictMode double-invocation and any reconciliation that would discard child local state.
	const [resizeState, setResizeState] = useState<{ id: string; startMin: number; endMin: number } | null>(null);

	const getMin = (clientY: number) => {
		const el = columnRef.current;
		if (!el) return 0;
		const y = clientY - el.getBoundingClientRect().top;
		const raw = (y / HOUR_HEIGHT) * 60;
		return Math.max(0, Math.min(23 * 60 + 45, Math.round(raw / 15) * 15));
	};

	const handleResizeStart = (id: string, edge: "top" | "bottom", anchorY: number, origStart: number, origEnd: number) => {
		let curStart = origStart;
		let curEnd = origEnd;
		setResizeState({ id, startMin: curStart, endMin: curEnd });

		const onMove = (me: PointerEvent) => {
			const dy = me.clientY - anchorY;
			const dm = Math.round((dy / HOUR_HEIGHT) * 60 / 15) * 15;
			if (edge === "bottom") {
				curEnd = Math.max(origStart + 15, Math.min(24 * 60, origEnd + dm));
				curStart = origStart;
			} else {
				curStart = Math.max(0, Math.min(origEnd - 15, origStart + dm));
				curEnd = origEnd;
			}
			setResizeState({ id, startMin: curStart, endMin: curEnd });
		};
		const onUp = () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			setResizeState(null);
			onResizeEnd(id, curStart, curEnd);
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
	};

	const handleColumnMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
		if (isDraggingEvent || e.target !== e.currentTarget || e.button !== 0) return;
		const startMin = getMin(e.clientY);
		// Start at 0 duration — grows as the user drags.
		const gesture = { startMin, endMin: startMin };
		gestureRef.current = gesture;
		setCreateGesture({ ...gesture });
		setHoverMin(null);

		// Use window-level listeners so updates fire regardless of what element
		// the cursor is over while dragging (timed blocks, gridlines, etc.).
		const onMove = (me: MouseEvent) => {
			if (!gestureRef.current) return;
			const endMin = getMin(me.clientY);
			gestureRef.current = { startMin: gestureRef.current.startMin, endMin };
			setCreateGesture({ ...gestureRef.current });
		};
		const onUp = () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
			const g = gestureRef.current;
			gestureRef.current = null;
			setCreateGesture(null);
			if (g) onAddAt(day, Math.min(g.startMin, g.endMin));
		};
		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	};

	return (
		<div
			ref={(node) => {
				columnRef.current = node;
				setNodeRef(node);
			}}
			className={cn(
				"group/col relative border-line border-r last:border-r-0",
				isToday && "bg-brand-surface/15",
				isOver && "bg-brand-surface",
				createGesture ? "cursor-crosshair" : "cursor-pointer",
			)}
			style={{ height: HOUR_HEIGHT * 24 }}
			onMouseMove={(e) => {
				if (isDraggingEvent || gestureRef.current) return;
				if (e.target === e.currentTarget) {
					setHoverMin(getMin(e.clientY));
				} else {
					setHoverMin(null);
				}
			}}
			onMouseDown={handleColumnMouseDown}
			onMouseLeave={() => {
				if (!gestureRef.current) setHoverMin(null);
			}}
		>
			{/* Hour gridlines. */}
			{HOURS.map((hour) => (
				<div
					key={hour}
					className="pointer-events-none absolute right-0 left-0 border-line/60 border-t"
					style={{ top: hour * HOUR_HEIGHT }}
				/>
			))}
			{/* Current-time line. */}
			{isToday ? (
				<div className="pointer-events-none absolute right-0 left-0 z-20" style={{ top: (nowMin / 60) * HOUR_HEIGHT }}>
					<div className="-left-1 -top-1 absolute size-2 rounded-full bg-coral" />
					<div className="border-coral border-t" />
				</div>
			) : null}
			{/* Hover ghost — shown when hovering over empty space. */}
			{hoverMin !== null && !createGesture && !isDraggingEvent ? (
				<div
					className="pointer-events-none absolute left-0.5 right-0.5 z-[5] rounded-[5px] border border-brand/50 bg-brand-surface/40"
					style={{
						top: (hoverMin / 60) * HOUR_HEIGHT,
						height: 0.75 * HOUR_HEIGHT,
					}}
				>
					<span className="block px-1.5 py-0.5 font-mono text-[10px] text-brand-soft">
						{formatMin(hoverMin)}
					</span>
				</div>
			) : null}
			{/* Drag-to-create ghost. */}
			{createGesture ? (() => {
				const top = Math.min(createGesture.startMin, createGesture.endMin);
				const bottom = Math.max(createGesture.startMin, createGesture.endMin);
				return (
					<div
						className="pointer-events-none absolute left-0.5 right-0.5 z-[5] rounded-[5px] border border-brand/70 bg-brand-surface/60"
						style={{
							top: (top / 60) * HOUR_HEIGHT,
							height: Math.max(16, ((bottom - top) / 60) * HOUR_HEIGHT),
						}}
					>
						<span className="block px-1.5 py-0.5 font-mono text-[10px] text-brand-soft">
							{formatMin(top)} – {formatMin(bottom)}
						</span>
					</div>
				);
			})() : null}
			{/* Timed entries. */}
			{timed.map((entry) => (
				<TimedBlock
					key={`${entry.kind}-${entry.id}`}
					entry={entry}
					resizeOverride={resizeState?.id === entry.id ? resizeState : null}
					onResizeStart={handleResizeStart}
					onOpenEvent={onOpenEvent}
				/>
			))}
		</div>
	);
}

function TimedBlock({
	entry,
	resizeOverride,
	onResizeStart,
	onOpenEvent,
}: {
	entry: TimedEntry;
	resizeOverride: { startMin: number; endMin: number } | null;
	onResizeStart: (id: string, edge: "top" | "bottom", anchorY: number, origStart: number, origEnd: number) => void;
	onOpenEvent: (id: string) => void;
}) {
	const draggable = useDraggable({ id: entry.id, disabled: entry.kind !== "task" });
	// Use parent-controlled override for live resize; fall back to entry values.
	const startMin = resizeOverride?.startMin ?? entry.startMin;
	const endMin = resizeOverride?.endMin ?? entry.endMin;

	const top = (startMin / 60) * HOUR_HEIGHT;
	const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 16);
	const widthPct = 100 / entry.cols;
	const position = {
		top,
		height,
		left: `${entry.lane * widthPct}%`,
		width: `calc(${widthPct}% - 2px)`,
	} as const;
	const time = formatMin(startMin);
	// Tall enough to stack a time line above the title; otherwise inline-prefix it.
	const stacked = height >= 34;

	const makeResizeHandler = (edge: "top" | "bottom") => (e: React.PointerEvent<HTMLDivElement>) => {
		e.stopPropagation();
		e.preventDefault();
		onResizeStart(entry.id, edge, e.clientY, entry.startMin, entry.endMin);
	};

	if (entry.kind === "google") {
		return (
			<a
				href={entry.href ?? undefined}
				target="_blank"
				rel="noreferrer"
				title={`${time} · ${entry.title}`}
				style={{ ...position, background: `color-mix(in srgb, ${entry.color} 18%, var(--color-base))`, borderLeftColor: entry.color }}
				className="absolute z-10 flex flex-col overflow-hidden rounded-[5px] border border-line border-l-2 px-1.5 py-0.5 text-[11px] text-ink-2 leading-tight transition-colors hover:text-white"
			>
				{stacked ? <span className="font-mono text-[10px] opacity-70 tabular-nums">{time}</span> : null}
				<span className="truncate">
					{stacked ? null : <span className="mr-1 font-mono opacity-70 tabular-nums">{time}</span>}
					{entry.title}
				</span>
			</a>
		);
	}

	return (
		<button
			ref={draggable.setNodeRef}
			type="button"
			{...draggable.attributes}
			{...draggable.listeners}
			onClick={() => onOpenEvent(entry.id)}
			title={`${time} · ${entry.title}`}
			style={position}
			className={cn(
				"absolute z-10 flex cursor-grab flex-col overflow-hidden rounded-[5px] border px-1.5 py-0.5 text-left text-[11px] leading-tight transition-shadow hover:shadow-md",
				EVENT_CLASSES[entry.task.priority ?? "none"],
				entry.task.done && "opacity-50 line-through",
				draggable.isDragging && "opacity-40",
			)}
		>
			{/* Top resize handle */}
			<div
				onPointerDown={makeResizeHandler("top")}
				onClick={(e) => e.stopPropagation()}
				className="absolute top-0 left-0 right-0 z-20 h-1.5 cursor-n-resize rounded-t-[5px] hover:bg-white/20"
			/>
			{stacked ? <span className="font-mono text-[10px] opacity-70 tabular-nums">{time}</span> : null}
			<span className="truncate font-sans">
				{stacked ? null : <span className="mr-1 font-mono opacity-70 tabular-nums">{time}</span>}
				{entry.title}
			</span>
			{/* Bottom resize handle */}
			<div
				onPointerDown={makeResizeHandler("bottom")}
				onClick={(e) => e.stopPropagation()}
				className="absolute bottom-0 left-0 right-0 z-20 h-1.5 cursor-s-resize rounded-b-[5px] hover:bg-white/20"
			/>
		</button>
	);
}
