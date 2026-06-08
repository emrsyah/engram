import { Badge } from "@alphonse/ui/components/badge";
import { cn } from "@alphonse/ui/lib/utils";
import { CancelIcon as X } from "./icons";

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
    <Badge variant="secondary" className={cn("h-6 gap-1 rounded-[5px] px-2 font-bold", color)}>
      <span className="size-1.5 rounded-full bg-current" />
      {priorityLabels[priority]}
    </Badge>
  );
}

export function DueChip({ dueAt }: { dueAt?: string }) {
  if (!dueAt) {
    return null;
  }

  const due = new Date(dueAt);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const isToday = due.toDateString() === today.toDateString();
  const isTomorrow = due.toDateString() === tomorrow.toDateString();
  const label = isToday
    ? `Today ${formatTime(due)}`
    : isTomorrow
      ? `Tmrw ${formatTime(due)}`
      : `${due.toLocaleDateString("en-US", { weekday: "short" })} ${formatTime(due)}`;

  return (
    <Badge
      variant="secondary"
      className="h-6 rounded-[5px] bg-[#3a3327] px-2 font-mono font-bold text-[#d6a93a]"
    >
      {label}
    </Badge>
  );
}

export function SomedayChip() {
  return (
    <Badge
      variant="secondary"
      className="h-6 rounded-[5px] bg-[#2a2433] px-2 font-mono font-bold text-[#b3a4ff]"
    >
      Someday
    </Badge>
  );
}

export function TagChip({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  return (
    <Badge
      variant="secondary"
      className="h-5 gap-0.5 rounded-[4px] bg-[#1e2a30] px-1.5 font-mono text-[10px] text-[#4aa5c8]"
    >
      <span className="opacity-60">#</span>{tag}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-0.5 opacity-50 hover:opacity-100"
        >
          <X className="size-2.5" />
        </button>
      )}
    </Badge>
  );
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
