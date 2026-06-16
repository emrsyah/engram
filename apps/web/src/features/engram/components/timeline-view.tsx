"use client";

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
import { Button } from "@alphonse/ui/components/button";
import { Calendar } from "@alphonse/ui/components/calendar";
import { Checkbox } from "@alphonse/ui/components/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@alphonse/ui/components/tabs";
import { cn } from "@alphonse/ui/lib/utils";
import { CalendarDays as CalendarDaysIcon, ListIcon, Icons } from "./icons";
import { useMemo, useState } from "react";

import { PriorityChip } from "./chips";
import { buildWeekDays, tasksForDay } from "../projections";
import { useEngramStore } from "../store";
import type { Item } from "../types";

export function TimelineView() {
  const { scheduledTasks, updateItem, jumpToItem } = useEngramStore();
  const weekDays = useMemo(() => buildWeekDays(), []);
  const [activeTask, setActiveTask] = useState<Item | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfLocalDay(new Date()));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveTask(scheduledTasks.find((t) => t.id === active.id) ?? null);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveTask(null);
    if (!over || active.id === over.id) return;

    const targetDatePrefix = over.id as string;
    const task = scheduledTasks.find((t) => t.id === active.id);
    if (!task) return;

    if (targetDatePrefix === "someday") {
      updateItem(task.id, { dueAt: undefined });
    } else {
      const existingTime = task.dueAt
        ? new Date(task.dueAt).toTimeString().slice(0, 5)
        : "10:00";
      updateItem(task.id, {
        dueAt: new Date(`${targetDatePrefix}T${existingTime}`).toISOString(),
      });
    }
  };

  const allBuckets = [...weekDays, { label: "Someday", datePrefix: "someday" }];
  const selectedDatePrefix = toDatePrefix(selectedDate);
  const selectedTasks = useMemo(
    () => tasksForDay(scheduledTasks, selectedDatePrefix),
    [scheduledTasks, selectedDatePrefix],
  );
  const scheduledDates = useMemo(
    () =>
      scheduledTasks
        .filter((task) => task.dueAt)
        .map((task) => startOfLocalDay(new Date(task.dueAt as string))),
    [scheduledTasks],
  );

  return (
    <DndContext id="timeline-dnd" sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <section className="h-full overflow-y-auto bg-[#151310] px-8 py-10 text-white md:px-16 lg:px-28">
        <div className="mx-auto max-w-[1160px]">
          <Tabs defaultValue="list" className="gap-0">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <h2
                  className="stagger-item flex items-center gap-3 font-bold text-3xl"
                  style={{ animationDelay: "0ms" }}
                >
                  <Icons.calendar className="size-7 text-[#9b88ff]" />
                  Timeline
                </h2>
                <p
                  className="stagger-item mt-3 max-w-2xl text-[#b0a69a]"
                  style={{ animationDelay: "40ms" }}
                >
                  Every scheduled task, flowing across the week. Drag to reschedule, or click to jump to
                  the canvas.
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <span className="rounded-[6px] border border-[#302c27] bg-[#211e1a] px-2.5 py-1 font-mono text-[#9f9588] text-xs">
                  {scheduledTasks.length} task{scheduledTasks.length === 1 ? "" : "s"}
                </span>
                <TabsList className="rounded-[8px] bg-[#23201d] p-1">
                <TabsTrigger
                  value="list"
                  className="h-8 rounded-[6px] px-3 text-[#948c82] data-active:bg-[#312d28] data-active:text-white"
                >
                  <ListIcon className="size-3.5" />
                  List
                </TabsTrigger>
                <TabsTrigger
                  value="calendar"
                  className="h-8 rounded-[6px] px-3 text-[#948c82] data-active:bg-[#312d28] data-active:text-white"
                >
                  <CalendarDaysIcon className="size-3.5" />
                  Calendar
                </TabsTrigger>
              </TabsList>
              </div>
            </div>

            <TabsContent value="list" className="mt-9">
              {allBuckets.map((day, i) => (
                <TimelineDay
                  key={day.datePrefix}
                  label={day.label}
                  datePrefix={day.datePrefix}
                  tasks={tasksForDay(scheduledTasks, day.datePrefix)}
                  onJump={jumpToItem}
                  index={i}
                />
              ))}
            </TabsContent>

            <TabsContent value="calendar" className="mt-9">
              <CalendarTimelineView
                selectedDate={selectedDate}
                selectedTasks={selectedTasks}
                scheduledDates={scheduledDates}
                onSelectDate={setSelectedDate}
                onJump={jumpToItem}
              />
            </TabsContent>
          </Tabs>
        </div>
      </section>

      <DragOverlay dropAnimation={null}>
        {activeTask ? <TaskDragPreview task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function CalendarTimelineView({
  selectedDate,
  selectedTasks,
  scheduledDates,
  onSelectDate,
  onJump,
}: {
  selectedDate: Date;
  selectedTasks: Item[];
  scheduledDates: Date[];
  onSelectDate: (date: Date) => void;
  onJump: (id: string) => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <div className="rounded-[8px] border border-[#302c27] bg-[#211e1a] p-3">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (date) onSelectDate(startOfLocalDay(date));
          }}
          modifiers={{ scheduled: scheduledDates }}
          modifiersClassNames={{
            scheduled: "[&>button]:after:absolute [&>button]:after:right-1 [&>button]:after:top-1 [&>button]:after:size-1.5 [&>button]:after:rounded-full [&>button]:after:bg-[#d7b238]",
          }}
          className="w-full p-1"
          classNames={{
            month_grid: "w-full border-collapse",
            weekdays: "grid grid-cols-7",
            week: "grid grid-cols-7 mt-1",
            weekday: "text-center text-[11px] font-medium text-[#5a5450] pb-1",
            day: "relative h-11 p-0 text-center",
            day_button: cn(
              "relative h-11 w-full rounded-[6px] text-sm text-[#c8bfb2] transition-colors",
              "hover:bg-[#2e2a24] hover:text-white",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#907ce8]",
            ),
          }}
        />
      </div>

      <div className="min-h-[360px] rounded-[8px] border border-[#302c27] bg-[#211e1a] p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[#82786e] text-xs uppercase tracking-widest">
              {isSameLocalDay(selectedDate, new Date()) ? "Today" : selectedDate.toLocaleDateString("en-US", { weekday: "long" })}
            </p>
            <h3 className="mt-1 font-bold text-2xl text-white">
              {selectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
            </h3>
          </div>
          <span className="rounded-[6px] border border-[#302c27] bg-[#181511] px-2 py-1 font-mono text-[#82786e] text-xs">
            {selectedTasks.length} tasks
          </span>
        </div>

        <div className="space-y-2">
          {selectedTasks.length ? (
            selectedTasks.map((task, index) => (
              <TimelineTask key={task.id} task={task} onJump={onJump} index={index} />
            ))
          ) : (
            <div className="rounded-[8px] border border-dashed border-[#34302b] px-4 py-8 text-center text-[#82786e] text-sm">
              Nothing scheduled for this day.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TimelineDay({
  label,
  datePrefix,
  tasks,
  onJump,
  index,
}: {
  label: string;
  datePrefix: string;
  tasks: Item[];
  onJump: (id: string) => void;
  index: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: datePrefix });
  const isToday = label === "Today";

  const [month, day] =
    datePrefix === "someday"
      ? ["-", ""]
      : [
          new Date(datePrefix).toLocaleDateString("en-US", { month: "short" }),
          String(new Date(datePrefix).getDate()),
        ];

  return (
    <div
      className="stagger-item grid grid-cols-[92px_1fr] gap-6"
      style={{ animationDelay: `${80 + index * 35}ms` }}
    >
      <div className="relative pb-8 text-right">
        <div className="absolute top-2 right-[-15px] size-2 rounded-full bg-[#403b35]" />
        <div className="absolute top-5 right-[-12px] h-full w-px bg-[#302c27]" />
        <p className="font-mono text-[#82786e] text-xs uppercase">{label}</p>
        {datePrefix !== "someday" && (
          <>
            <p className={cn("font-bold text-3xl", isToday ? "text-[#9b88ff]" : "text-white")}>
              {day}
            </p>
            <p className="font-mono text-[#82786e] text-xs">{month}</p>
          </>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[56px] space-y-3 rounded-[8px] pb-8 px-2 -mx-2",
          "transition-[background-color,box-shadow] duration-150",
          isOver
            ? "bg-[#1e1c18] shadow-[inset_0_0_0_1px_#4c463e]"
            : "bg-transparent shadow-none",
        )}
      >
        {tasks.length ? (
          tasks.map((task, ti) => (
            <TimelineTask key={task.id} task={task} onJump={onJump} index={ti} />
          ))
        ) : (
          <p className={cn("py-3 text-[#82786e] text-sm transition-opacity duration-150", isOver && "opacity-0")}>
            Nothing scheduled
          </p>
        )}
      </div>
    </div>
  );
}

function TimelineTask({
  task,
  onJump,
  index,
}: {
  task: Item;
  onJump: (id: string) => void;
  index: number;
}) {
  const { toggleDone } = useEngramStore();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      className="transition-opacity duration-150"
      style={{ opacity: isDragging ? 0.3 : 1 }}
    >
      <Button
        type="button"
        variant="outline"
        onClick={() => onJump(task.id)}
        className={cn(
          "h-auto min-h-14 w-full justify-start gap-4 rounded-[8px]",
          "border-[#302c27] bg-[#211e1a] px-4 text-left font-normal",
          "transition-[background-color,border-color,transform] duration-150",
          "hover:border-[#4c463e] hover:bg-[#272421]",
          "active:scale-[0.99] active:bg-[#2a2620]",
        )}
      >
        <span
          {...listeners}
          {...attributes}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "cursor-grab touch-none text-[#4c463e]",
            "transition-colors duration-150",
            "hover:text-[#7a7068]",
            "active:cursor-grabbing",
          )}
          aria-label="Drag to reschedule"
        >
          <GripIcon />
        </span>

        <span className="w-20 font-mono text-[#9f9588] text-sm">
          {task.dueAt
            ? new Date(task.dueAt).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })
            : "—"}
        </span>

        <span onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={task.done}
            onCheckedChange={() => toggleDone(task.id)}
            className="rounded-full"
          />
        </span>

        <span className={cn("flex-1 font-semibold", task.done && "text-[#655e56] line-through")}>
          {task.title}
        </span>
        <PriorityChip priority={task.priority} />
      </Button>
    </div>
  );
}

function TaskDragPreview({ task }: { task: Item }) {
  return (
    <div className="flex h-14 w-[560px] items-center gap-4 rounded-[8px] border border-[#9b88ff]/40 bg-[#211e1a] px-4 shadow-2xl ring-1 ring-[#9b88ff]/20 rotate-1 scale-[1.02]">
      <GripIcon className="text-[#9b88ff]" />
      <span className="w-20 font-mono text-[#9f9588] text-sm">
        {task.dueAt
          ? new Date(task.dueAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
          : "—"}
      </span>
      <span className="flex-1 font-semibold text-white">{task.title}</span>
      <PriorityChip priority={task.priority} />
    </div>
  );
}

function GripIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" className={className}>
      <circle cx="4" cy="3.5" r="1.2" />
      <circle cx="10" cy="3.5" r="1.2" />
      <circle cx="4" cy="7" r="1.2" />
      <circle cx="10" cy="7" r="1.2" />
      <circle cx="4" cy="10.5" r="1.2" />
      <circle cx="10" cy="10.5" r="1.2" />
    </svg>
  );
}

function startOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function toDatePrefix(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameLocalDay(a: Date, b: Date) {
  return toDatePrefix(a) === toDatePrefix(b);
}
