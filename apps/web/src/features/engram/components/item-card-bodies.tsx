"use client";

import { Calendar } from "@alphonse/ui/components/calendar";
import { Checkbox } from "@alphonse/ui/components/checkbox";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "@alphonse/ui/components/popover";
import { cn } from "@alphonse/ui/lib/utils";
import { CalendarIcon } from "lucide-react";

import { SomedayChip, TagChip, TypeLabel } from "./chips";
import { Icons } from "./icons";
import { LinkifiedText } from "./linkified-text";
import { useEngramStore } from "../store";
import type { Item, Priority } from "../types";

/**
 * The visual body of each Item type, rendered as plain HTML.
 *
 * These are shared by the React Flow node wrapper (`item-node.tsx`); they hold
 * no canvas/drag concerns — React Flow owns positioning and dragging now.
 */

export function ThoughtCard({ item }: { item: Item }) {
  const title = item.title?.trim();
  const body = item.text?.trim();

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <TypeLabel item={item} />
      {title && (
        <p className="line-clamp-2 font-semibold text-[#f0ebe3] text-[15px] leading-5">
          <LinkifiedText text={title} />
        </p>
      )}
      {body && (
        <p
          className={cn(
            "text-[#d8d2ca] text-sm leading-5",
            title ? "line-clamp-3" : "line-clamp-4 text-[15px] leading-6 text-[#e7e2da]",
          )}
        >
          <LinkifiedText text={body} />
        </p>
      )}
      {!title && !body && (
        <p className="text-[#5c554d] text-sm leading-5">Untitled thought</p>
      )}
      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.tags.map((tag) => <TagChip key={tag} tag={tag} />)}
        </div>
      )}
    </div>
  );
}

export function TaskCard({ item, onToggle }: { item: Item; onToggle: () => void }) {
  const { toggleChecklistItem, updateItem } = useEngramStore();
  const checklist = item.checklistItems ?? [];
  const doneCount = checklist.filter((ci) => ci.done).length;
  const complete = item.done && (checklist.length === 0 || doneCount === checklist.length);

  return (
    <div className="relative flex h-full gap-3 overflow-visible p-4">
      {complete && (
        <>
          <style>{`
            @keyframes task-complete-pop {
              0% { opacity: 0; transform: translateY(8px) scale(0.6); }
              25% { opacity: 1; }
              100% { opacity: 0; transform: translateY(-34px) scale(1); }
            }
          `}</style>
          <span className="pointer-events-none absolute top-5 right-8 size-1.5 rounded-full bg-[#a8e06b]" style={{ animation: "task-complete-pop 900ms ease-out forwards" }} />
          <span className="pointer-events-none absolute top-8 right-12 size-1 rounded-full bg-[#d7b238]" style={{ animation: "task-complete-pop 900ms 80ms ease-out forwards" }} />
          <span className="pointer-events-none absolute top-7 right-5 size-1 rounded-full bg-[#9b88ff]" style={{ animation: "task-complete-pop 900ms 140ms ease-out forwards" }} />
        </>
      )}
      <div className="nodrag nopan pt-7" onClick={(event) => event.stopPropagation()}>
        <Checkbox checked={item.done} onCheckedChange={onToggle} className="rounded-full" />
      </div>
      <div className="min-w-0 flex-1">
        <TypeLabel item={item} />
        <p
          className={cn(
            "mt-3 font-semibold text-[#f0ebe3]",
            item.done && "text-[#756e65] line-through",
          )}
        >
          <LinkifiedText text={item.title ?? ""} />
        </p>
        {checklist.length > 0 && (
          <div
            className="nodrag nopan mt-3 space-y-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-mono text-[#6b6258] text-[10px] uppercase tracking-wider">
              {doneCount}/{checklist.length} done
            </p>
            {checklist.map((ci) => (
              <div key={ci.id} className="flex items-start gap-2">
                <Checkbox
                  checked={ci.done}
                  onCheckedChange={() => toggleChecklistItem(item.id, ci.id)}
                  className="mt-0.5 size-3.5 rounded-[3px]"
                />
                <span
                  className={cn(
                    "text-[#c8bfb2] text-xs leading-relaxed",
                    ci.done && "text-[#655e56] line-through",
                  )}
                >
                  <LinkifiedText text={ci.text} />
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="nodrag nopan mt-3 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <TaskPriorityButtons
            priority={item.priority}
            onChange={(priority) => updateItem(item.id, { priority })}
          />
          <TaskDueButton
            dueAt={item.dueAt}
            onChange={(dueAt) => updateItem(item.id, { dueAt })}
          />
          {item.someday && !item.dueAt && <SomedayChip />}
        </div>
        {item.tags && item.tags.length > 0 && (
          <div className="nodrag nopan mt-2 flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
            {item.tags.map((tag) => <TagChip key={tag} tag={tag} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskPriorityButtons({
  priority,
  onChange,
}: {
  priority?: Priority;
  onChange: (priority: Priority) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {([1, 2, 3] as Priority[]).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={cn(
            "h-6 rounded-[5px] border px-1.5 font-bold text-[10px] transition-colors",
            priority === p
              ? "border-[#4c463e] bg-[#2a2621] text-[#f0ebe3]"
              : "border-[#2f2a25] bg-[#181511] text-[#6b6258] hover:text-[#c8bfb2]",
          )}
        >
          P{p}
        </button>
      ))}
    </div>
  );
}

function TaskDueButton({
  dueAt,
  onChange,
}: {
  dueAt?: string;
  onChange: (dueAt?: string) => void;
}) {
  const dueDate = dueAt ? parseDueDate(dueAt) : undefined;
  const dueHasTime = hasDueTime(dueAt);

  return (
    <PopoverRoot>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex h-6 items-center gap-1 rounded-[5px] border px-2 font-mono font-bold text-[10px] transition-colors",
              dueAt
                ? "border-[#3a3327] bg-[#3a3327] text-[#d6a93a]"
                : "border-[#2f2a25] bg-[#181511] text-[#6b6258] hover:text-[#c8bfb2]",
            )}
          />
        }
      >
        <CalendarIcon className="size-3" />
        {dueAt && dueDate ? formatDueShort(dueDate, dueHasTime) : "Due"}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={dueDate}
          onSelect={(date) => {
            if (!date) {
              onChange(undefined);
              return;
            }
            const next = new Date(date);
            if (dueHasTime && dueDate) {
              next.setHours(dueDate.getHours(), dueDate.getMinutes(), 0, 0);
              onChange(next.toISOString());
              return;
            }
            onChange(toDateInputValue(next));
          }}
        />
        <div className="border-[#252118] border-t px-3 py-2">
          <label className="flex items-center justify-between gap-3 text-[#8d857b] text-xs">
            <span>Time</span>
            <input
              type="time"
              value={dueDate && dueHasTime ? toTimeInputValue(dueDate) : ""}
              onChange={(event) => {
                if (!event.target.value) {
                  if (dueDate) onChange(toDateInputValue(dueDate));
                  return;
                }
                const [hours, minutes] = event.target.value.split(":").map(Number);
                const next = dueDate ? new Date(dueDate) : new Date();
                next.setHours(hours ?? 0, minutes ?? 0, 0, 0);
                onChange(next.toISOString());
              }}
              className="h-7 rounded-[5px] border border-[#302c27] bg-[#181511] px-2 font-mono text-[#f0ebe3] text-xs outline-none focus:border-[#4c463e]"
            />
          </label>
          <p className="mt-1.5 text-[#5c554d] text-[10px]">Indonesia time (WIB)</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={!dueDate || !dueHasTime}
              onClick={() => dueDate && onChange(toDateInputValue(dueDate))}
              className="text-[#8d857b] text-xs hover:text-[#c8bfb2] disabled:text-[#3d3830]"
            >
              Clear time
            </button>
            <button
              type="button"
              disabled={!dueAt}
              onClick={() => onChange(undefined)}
              className="text-[#8d857b] text-xs hover:text-[#c8bfb2] disabled:text-[#3d3830]"
            >
              Clear due
            </button>
          </div>
        </div>
      </PopoverContent>
    </PopoverRoot>
  );
}

function formatDueShort(date: Date, hasTime: boolean) {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const time = hasTime ? formatIndonesiaTime(date) : "";

  if (date.toDateString() === today.toDateString()) return hasTime ? `Today ${time}` : "Today";
  if (date.toDateString() === tomorrow.toDateString()) return hasTime ? `Tmrw ${time}` : "Tmrw";
  const day = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return hasTime ? `${day} ${time}` : day;
}

function formatIndonesiaTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

function toTimeInputValue(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function hasDueTime(dueAt?: string) {
  return !!dueAt && dueAt.includes("T");
}

function parseDueDate(dueAt: string) {
  if (hasDueTime(dueAt)) return new Date(dueAt);
  const [year, month, day] = dueAt.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function LinkCard({ item }: { item: Item }) {
  const domain = item.url ? new URL(item.url).hostname.replace("www.", "") : "";

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <TypeLabel item={item} />
      <div className="flex items-start gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-[5px] bg-[#7185d6] text-white">
          <Icons.link className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="font-bold text-[#f0ebe3]">{item.title}</p>
          <p className="mt-1 text-[#53b9a8] text-xs">{domain}</p>
        </div>
      </div>
      <p className="text-[#a9a199] text-sm leading-5">{item.text}</p>
    </div>
  );
}

export function ImageCard({ item }: { item: Item }) {
  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <TypeLabel item={item} />
      <div className="grid h-[214px] place-items-center rounded-[7px] bg-linear-to-br from-[#1d4039] to-[#27223c] text-[#9da39f]">
        <Icons.image className="size-8" />
      </div>
      <div className="flex items-center gap-2 font-mono text-[#8b8378] text-xs">
        <Icons.file className="size-3.5" />
        {item.source}
      </div>
    </div>
  );
}

export function FileCard({ item }: { item: Item }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <Icons.file className="size-5 text-[#9b88ff]" />
      <div>
        <TypeLabel item={item} />
        <p className="mt-2 font-semibold">{item.title ?? item.source}</p>
      </div>
    </div>
  );
}

export function ItemCardBody({ item, onToggle }: { item: Item; onToggle: () => void }) {
  switch (item.type) {
    case "task":
      return <TaskCard item={item} onToggle={onToggle} />;
    case "thought":
      return <ThoughtCard item={item} />;
    case "link":
      return <LinkCard item={item} />;
    case "image":
      return <ImageCard item={item} />;
    case "file":
      return <FileCard item={item} />;
    default:
      return null;
  }
}
