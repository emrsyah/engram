import { cn } from "@alphonse/ui/lib/utils";

import type { Accent, Item, Priority } from "../types";

const accentClasses: Record<Accent, string> = {
  violet: "bg-[#8f7cf7] text-[#f5f2ff]",
  gold: "bg-[#d9a82f] text-[#1d1608]",
  teal: "bg-[#43b6a6] text-[#061f1c]",
  red: "bg-[#e46f50] text-[#210b05]",
  blue: "bg-[#4aa5c8] text-[#041820]",
};

const priorityLabels: Record<Priority, string> = {
  1: "P1",
  2: "P2",
  3: "P3",
};

export function Dot({ accent, className }: { accent: Accent; className?: string }) {
  return <span className={cn("size-2 rounded-[2px]", accentClasses[accent], className)} />;
}

export function TypeLabel({ item }: { item: Item }) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.12em] text-[#7a746d] uppercase">
      <Dot accent={item.accent} />
      {item.type === "task" ? "Task" : item.type}
    </div>
  );
}

export function PriorityChip({ priority }: { priority?: Priority }) {
  if (!priority) {
    return null;
  }

  const color =
    priority === 1
      ? "bg-[#5a2a20] text-[#f07d5e]"
      : priority === 2
        ? "bg-[#514017] text-[#e5b83d]"
        : "bg-[#183d4b] text-[#58b8d8]";

  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-[5px] px-2 text-xs font-bold", color)}>
      <span className="size-1.5 rounded-full bg-current" />
      {priorityLabels[priority]}
    </span>
  );
}

export function DueChip({ dueAt }: { dueAt?: string }) {
  if (!dueAt) {
    return null;
  }

  const due = new Date(dueAt);
  const today = new Date("2026-06-06T00:00:00.000Z");
  const tomorrow = new Date("2026-06-07T00:00:00.000Z");
  const isToday = due.toDateString() === today.toDateString();
  const isTomorrow = due.toDateString() === tomorrow.toDateString();
  const label = isToday
    ? `Today ${formatTime(due)}`
    : isTomorrow
      ? `Tmrw ${formatTime(due)}`
      : `${due.toLocaleDateString("en-US", { weekday: "short" })} ${formatTime(due)}`;

  return (
    <span className="inline-flex h-6 items-center rounded-[5px] bg-[#3a3327] px-2 font-mono text-xs font-bold text-[#d6a93a]">
      {label}
    </span>
  );
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
