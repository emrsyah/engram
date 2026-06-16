import { Badge } from "@alphonse/ui/components/badge";
import { cn } from "@alphonse/ui/lib/utils";
import { CancelIcon as X } from "./icons";

import type { Accent, Item, Priority } from "../types";

const accentClasses: Record<Accent, string> = {
  violet: "bg-brand text-ink-bright",
  gold: "bg-amber text-base",
  teal: "bg-teal text-brand-ink",
  red: "bg-coral text-base",
  blue: "bg-blue text-brand-ink",
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
    <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.12em] text-ink-dim uppercase">
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
      ? "bg-p1 text-p1-ink"
      : priority === 2
        ? "bg-p2 text-p2-ink"
        : "bg-p3 text-p3-ink";

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
      className="h-6 rounded-[5px] bg-amber/12 px-2 font-mono font-bold text-honey"
    >
      {label}
    </Badge>
  );
}

export function SomedayChip() {
  return (
    <Badge
      variant="secondary"
      className="h-6 rounded-[5px] bg-brand-surface px-2 font-mono font-bold text-brand-soft"
    >
      Someday
    </Badge>
  );
}

export function TagChip({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  return (
    <Badge
      variant="secondary"
      className="h-5 gap-0.5 rounded-[4px] bg-brand-surface px-1.5 font-mono text-[10px] text-blue"
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
