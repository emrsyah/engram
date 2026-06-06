"use client";

import { Checkbox } from "@alphonse/ui/components/checkbox";
import { cn } from "@alphonse/ui/lib/utils";

import { DueChip, PriorityChip } from "./chips";
import { useEngramStore } from "../store";
import type { Item } from "../types";

const days = [
  { key: "today", eyebrow: "Today", number: "6", label: "Jun" },
  { key: "sun", eyebrow: "Sun", number: "7", label: "Jun" },
  { key: "mon", eyebrow: "Mon", number: "8", label: "Jun" },
  { key: "tue", eyebrow: "Tue", number: "9", label: "Jun" },
  { key: "wed", eyebrow: "Wed", number: "10", label: "Jun" },
  { key: "thu", eyebrow: "Thu", number: "11", label: "Jun" },
  { key: "fri", eyebrow: "Fri", number: "12", label: "Jun" },
  { key: "someday", eyebrow: "Someday", number: "-", label: "" },
];

export function TimelineView() {
  const { scheduledTasks } = useEngramStore();

  return (
    <section className="h-full overflow-y-auto bg-[#151310] px-8 py-10 text-white md:px-16 lg:px-28">
      <div className="mx-auto max-w-[1160px]">
        <h2 className="font-bold text-3xl">Timeline</h2>
        <p className="mt-3 text-[#b0a69a]">
          Every scheduled task, flowing across the week. Check things off here or jump back to the canvas.
        </p>

        <div className="mt-9">
          {days.map((day) => {
            const tasks = tasksForDay(scheduledTasks, day.key);
            return <TimelineDay key={day.key} day={day} tasks={tasks} />;
          })}
        </div>
      </div>
    </section>
  );
}

function TimelineDay({
  day,
  tasks,
}: {
  day: (typeof days)[number];
  tasks: Item[];
}) {
  return (
    <div className="grid grid-cols-[92px_1fr] gap-6">
      <div className="relative pb-8 text-right">
        <div className="absolute top-2 right-[-15px] size-2 rounded-full bg-[#403b35]" />
        <div className="absolute top-5 right-[-12px] h-full w-px bg-[#302c27]" />
        <p className="font-mono text-[#82786e] text-xs uppercase">{day.eyebrow}</p>
        <p className="font-bold text-3xl text-white">{day.number}</p>
        <p className="font-mono text-[#82786e] text-xs">{day.label}</p>
      </div>
      <div className="space-y-3 pb-8">
        {tasks.length ? (
          tasks.map((task) => <TimelineTask key={task.id} task={task} />)
        ) : (
          <p className="py-3 text-[#82786e] text-sm">Nothing scheduled</p>
        )}
      </div>
    </div>
  );
}

function TimelineTask({ task }: { task: Item }) {
  const { toggleDone, jumpToItem } = useEngramStore();

  return (
    <button
      type="button"
      onClick={() => jumpToItem(task.id)}
      className="flex min-h-14 w-full items-center gap-4 rounded-[8px] border border-[#302c27] bg-[#211e1a] px-4 text-left hover:border-[#4c463e]"
    >
      <span className="h-6 w-1 rounded-full bg-[#d9a82f]" />
      <span className="w-20 font-mono text-[#9f9588] text-sm">
        {task.dueAt ? new Date(task.dueAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "-"}
      </span>
      <span onClick={(event) => event.stopPropagation()}>
        <Checkbox checked={task.done} onCheckedChange={() => toggleDone(task.id)} className="rounded-full" />
      </span>
      <span className={cn("flex-1 font-semibold", task.done && "text-[#655e56] line-through")}>
        {task.title}
      </span>
      <PriorityChip priority={task.priority} />
    </button>
  );
}

function tasksForDay(tasks: Item[], key: string) {
  if (key === "someday") {
    return tasks.filter((task) => !task.dueAt);
  }

  const targetDate =
    key === "today"
      ? "2026-06-06"
      : key === "sun"
        ? "2026-06-07"
        : key === "mon"
          ? "2026-06-08"
          : key === "tue"
            ? "2026-06-09"
            : key === "wed"
              ? "2026-06-10"
              : key === "thu"
                ? "2026-06-11"
                : "2026-06-12";

  return tasks.filter((task) => task.dueAt?.startsWith(targetDate));
}
