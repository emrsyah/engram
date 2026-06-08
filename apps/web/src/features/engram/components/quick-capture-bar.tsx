"use client";

import { Button } from "@alphonse/ui/components/button";
import { Calendar } from "@alphonse/ui/components/calendar";
import { Checkbox } from "@alphonse/ui/components/checkbox";
import { Input } from "@alphonse/ui/components/input";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "@alphonse/ui/components/popover";
import { ToggleGroup, ToggleGroupItem } from "@alphonse/ui/components/toggle-group";
import { cn } from "@alphonse/ui/lib/utils";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { isToday, isTomorrow, startOfDay } from "date-fns";
import {
  ArrowUpRightIcon,
  CalendarIcon,
  CheckSquareIcon,
  FileIcon,
  FlagIcon,
  ImageIcon,
  LinkIcon,
  SendHorizontalIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { useEngramStore } from "../store";
import { useUIStore } from "../ui-store";
import type { Priority } from "../types";

type Mode = "thought" | "task" | "link" | "attach";

type FileState = {
  name: string;
  size: number;
  type: string;
  previewUrl?: string;
};

const MODE_TABS: { mode: Mode; icon: React.ElementType; label: string; accent: string }[] = [
  { mode: "thought", icon: SparklesIcon,    label: "Thought", accent: "text-violet-300" },
  { mode: "task",    icon: CheckSquareIcon, label: "Task",    accent: "text-amber-300" },
  { mode: "link",    icon: LinkIcon,        label: "Link",    accent: "text-sky-300" },
];

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string }> = {
  1: { label: "P1", color: "text-red-400",   bg: "bg-red-400/15 border-red-400/30" },
  2: { label: "P2", color: "text-amber-400", bg: "bg-amber-400/15 border-amber-400/30" },
  3: { label: "P3", color: "text-blue-400",  bg: "bg-blue-400/15 border-blue-400/30" },
};

const EASE_DRAWER  = "cubic-bezier(0.32, 0.72, 0, 1)";
const EASE_OUT     = "cubic-bezier(0.23, 1, 0.32, 1)";

const TEXTAREA_MAX_PX = 280; // ~10 lines

type ParsedTaskText = {
  cleanText: string;
  priority?: Priority;
  dueDate?: Date;
  dueHasTime?: boolean;
  tags: string[];
  tokens: { kind: "priority" | "date" | "tag"; label: string }[];
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isValidUrl(value: string) {
  try { new URL(value); return true; } catch { return false; }
}

function extractDomain(url: string) {
  try { return new URL(url).hostname.replace("www.", ""); } catch { return url; }
}

function formatDueLabel(date: Date, hasTime: boolean) {
  const day = isToday(date)
    ? "Today"
    : isTomorrow(date)
      ? "Tomorrow"
      : date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "Asia/Jakarta",
        });
  return hasTime ? `${day} ${formatIndonesiaTime(date)}` : day;
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

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseTaskText(value: string, base = new Date()): ParsedTaskText {
  let cleanText = value;
  const tokens: ParsedTaskText["tokens"] = [];

  const priorityMatch = cleanText.match(/(?:^|\s)!(?:p)?([123])\b/i);
  const priority = priorityMatch ? (Number(priorityMatch[1]) as Priority) : undefined;
  if (priorityMatch) {
    tokens.push({ kind: "priority", label: `P${priority}` });
    cleanText = cleanText.replace(priorityMatch[0], priorityMatch[0].startsWith(" ") ? " " : "");
  }

  const tagMatches = [...cleanText.matchAll(/#(\w[\w-]*)/g)];
  const tags = tagMatches.map((m) => m[1]);
  for (const tag of tags) {
    tokens.push({ kind: "tag", label: `#${tag}` });
    cleanText = cleanText.replace(`#${tag}`, "");
  }

  const parsedDue = parseDuePhrase(cleanText, base);
  if (parsedDue) {
    tokens.push({ kind: "date", label: parsedDue.label });
    cleanText = cleanText.slice(0, parsedDue.start) + cleanText.slice(parsedDue.end);
  }

  return {
    cleanText: cleanText.replace(/\s{2,}/g, " ").trim(),
    priority,
    dueDate: parsedDue?.date,
    dueHasTime: parsedDue?.hasTime,
    tags,
    tokens,
  };
}

function parseDuePhrase(value: string, base: Date) {
  const patterns: { regex: RegExp; offsetDays: number; label: string }[] = [
    { regex: /\btonight\b/i, offsetDays: 0, label: "Tonight" },
    { regex: /\btoday\b/i, offsetDays: 0, label: "Today" },
    { regex: /\btomorrow\b/i, offsetDays: 1, label: "Tomorrow" },
    { regex: /\bnext week\b/i, offsetDays: 7, label: "Next week" },
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern.regex);
    if (!match || match.index === undefined) continue;
    const date = startOfDay(new Date(base));
    date.setDate(date.getDate() + pattern.offsetDays);
    const time = parseTimeNear(value, match.index, match.index + match[0].length);
    if (time) {
      date.setHours(time.hours, time.minutes, 0, 0);
    }
    return {
      date,
      label: time ? `${pattern.label} ${time.label}` : pattern.label,
      hasTime: !!time,
      start: time?.start ?? match.index,
      end: time?.end ?? match.index + match[0].length,
    };
  }

  const timeOnly = value.match(/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (timeOnly?.index !== undefined) {
    const date = startOfDay(new Date(base));
    const time = normalizeTime(timeOnly[1], timeOnly[2], timeOnly[3]);
    date.setHours(time.hours, time.minutes, 0, 0);
    return {
      date,
      label: `Today ${time.label}`,
      hasTime: true,
      start: timeOnly.index,
      end: timeOnly.index + timeOnly[0].length,
    };
  }

  return null;
}

function parseTimeNear(value: string, start: number, end: number) {
  const after = value.slice(end, end + 16);
  const before = value.slice(Math.max(0, start - 16), start);
  const afterMatch = after.match(/^\s*(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (afterMatch) {
    const time = normalizeTime(afterMatch[1], afterMatch[2], afterMatch[3]);
    return { ...time, start, end: end + afterMatch[0].length };
  }
  const beforeMatch = before.match(/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*$/i);
  if (beforeMatch && beforeMatch.index !== undefined) {
    const time = normalizeTime(beforeMatch[1], beforeMatch[2], beforeMatch[3]);
    const tokenStart = start - before.length + beforeMatch.index;
    return { ...time, start: tokenStart, end };
  }
  return null;
}

function normalizeTime(hourText: string, minuteText: string | undefined, meridiem: string) {
  const hour = Number(hourText);
  const minutes = minuteText ? Number(minuteText) : 0;
  const lower = meridiem.toLowerCase();
  const hours = lower === "pm" && hour < 12 ? hour + 12 : lower === "am" && hour === 12 ? 0 : hour;
  return {
    hours,
    minutes,
    label: `${hour}:${String(minutes).padStart(2, "0")}${lower}`,
  };
}

export function QuickCaptureBar() {
  const pathname = usePathname();
  const { createItem, addChecklistItem } = useEngramStore();
  const {
    openNoteEditor,
    quickCaptureExpanded: expanded,
    quickCaptureHighlight,
    quickCaptureMode,
    expandQuickCapture,
    collapseQuickCapture,
  } = useUIStore();

  const contextualMode: Mode =
    pathname === "/timeline" || pathname === "/priorities" ? "task" : "thought";
  const initialMode = quickCaptureMode ?? contextualMode;

  const [mode, setMode] = useState<Mode>(initialMode);
  const [highlight, setHighlight] = useState(false);

  // Shared inputs
  const [text, setText] = useState("");
  const [priority, setPriority] = useState<Priority>(2);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [dueHasTime, setDueHasTime] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [keepCaptureOpen, setKeepCaptureOpen] = useState(false);

  // Thought "notes mode" — auto-morph when Shift+Enter is pressed
  const [thoughtNotesMode, setThoughtNotesMode] = useState(false);

  // Task chaining — pending tasks above the active row
  const [pendingTasks, setPendingTasks] = useState<string[]>([]);

  // Attach
  const [file, setFile] = useState<FileState | null>(null);
  const [dragging, setDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const taskSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const reset = useCallback(() => {
    setText("");
    setPriority(2);
    setDueDate(null);
    setDueHasTime(false);
    setFile(null);
    setKeepCaptureOpen(false);
    setMode(quickCaptureMode ?? contextualMode);
    setThoughtNotesMode(false);
    setPendingTasks([]);
  }, [contextualMode, quickCaptureMode]);

  const collapse = useCallback(() => { collapseQuickCapture(); reset(); }, [collapseQuickCapture, reset]);

  const expand = useCallback(() => {
    expandQuickCapture();
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [expandQuickCapture]);

  // Highlight pulse when expanded externally (hotkey, top-bar button)
  useEffect(() => {
    if (quickCaptureHighlight === 0) return;
    setMode(quickCaptureMode ?? contextualMode);
    setHighlight(true);
    requestAnimationFrame(() => inputRef.current?.focus());
    const t = setTimeout(() => setHighlight(false), 700);
    return () => clearTimeout(t);
  }, [contextualMode, quickCaptureHighlight, quickCaptureMode]);

  // Reset thought notes mode when leaving Thought
  useEffect(() => {
    if (mode !== "thought") setThoughtNotesMode(false);
    if (mode !== "task") setPendingTasks([]);
  }, [mode]);

  // Auto-detect URL paste -> link mode (only when not in notes mode)
  useEffect(() => {
    if (mode === "thought" && !thoughtNotesMode && text.length > 6 && isValidUrl(text.trim())) {
      setMode("link");
    }
  }, [text, mode, thoughtNotesMode]);

  // Auto-grow textarea
  useLayoutEffect(() => {
    if (!thoughtNotesMode) return;
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, TEXTAREA_MAX_PX)}px`;
  }, [text, thoughtNotesMode]);

  // Esc to collapse + arrow-key tab navigation when not in editable
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { collapse(); return; }
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      const idx = MODE_TABS.findIndex((t) => t.mode === mode);
      if (e.key === "ArrowLeft" && idx > 0) { setMode(MODE_TABS[idx - 1].mode); e.preventDefault(); }
      else if (e.key === "ArrowRight" && idx < MODE_TABS.length - 1) { setMode(MODE_TABS[idx + 1].mode); e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, collapse, mode]);

  const handleFile = useCallback((f: File) => {
    const previewUrl = f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined;
    setFile({ name: f.name, size: f.size, type: f.type, previewUrl });
  }, []);

  const handlePendingTaskDragEnd = useCallback((event: DragEndEvent) => {
    if (event.active.id === event.over?.id) return;
    setPendingTasks((current) => {
      const main = current[0];
      const subtasks = current.slice(1);
      const oldIndex = subtasks.findIndex((_, index) => `pending-${index + 1}` === event.active.id);
      const newIndex = subtasks.findIndex((_, index) => `pending-${index + 1}` === event.over?.id);
      if (oldIndex < 0 || newIndex < 0) return current;
      return [main, ...arrayMove(subtasks, oldIndex, newIndex)];
    });
  }, []);

  const parsedTask = mode === "task" ? parseTaskText(text) : undefined;
  const taskText = parsedTask?.cleanText ?? text.trim();
  const effectivePriority = parsedTask?.priority ?? priority;
  const effectiveDueDate = parsedTask?.dueDate ?? dueDate;
  const effectiveDueHasTime = parsedTask?.dueDate ? !!parsedTask.dueHasTime : dueHasTime;
  const effectiveTags = parsedTask?.tags ?? [];

  const allTasks = (() => {
    return taskText ? [...pendingTasks, taskText] : [...pendingTasks];
  })();

  const canCommit = (() => {
    const trimmed = text.trim();
    if (mode === "thought") return trimmed.length > 0;
    if (mode === "task")    return allTasks.length > 0;
    if (mode === "link")    return isValidUrl(trimmed);
    if (mode === "attach")  return file !== null;
    return false;
  })();

  const commit = () => {
    if (!canCommit) return;
    const trimmed = text.trim();

    if (mode === "thought") {
      createItem({ type: "thought", text: trimmed, stayOnCurrentView: pathname !== "/canvas" });
      if (keepCaptureOpen) {
        setText("");
        setThoughtNotesMode(false);
        setMode("thought");
        requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }
    } else if (mode === "task") {
      const due = effectiveDueDate
        ? effectiveDueHasTime
          ? effectiveDueDate.toISOString()
          : toDateInputValue(effectiveDueDate)
        : undefined;
      const [main, ...subs] = allTasks;
      const item = createItem({
        type: "task",
        title: main,
        priority: effectivePriority,
        dueAt: due,
        tags: effectiveTags.length > 0 ? effectiveTags : undefined,
        stayOnCurrentView: pathname !== "/canvas",
      });
      for (const sub of subs) addChecklistItem(item.id, sub);
      if (keepCaptureOpen) {
        setText("");
        setDueDate(null);
        setDueHasTime(false);
        setPendingTasks([]);
        setMode("task");
        requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }
    } else if (mode === "link") {
      createItem({
        type: "link",
        url: trimmed,
        title: extractDomain(trimmed),
        stayOnCurrentView: pathname !== "/canvas",
      });
      if (keepCaptureOpen) {
        setText("");
        setMode("link");
        requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }
    } else if (mode === "attach" && file) {
      createItem({
        type: file.type.startsWith("image/") ? "image" : "file",
        title: file.name,
        url: file.previewUrl,
        source: file.name,
        stayOnCurrentView: pathname !== "/canvas",
      });
      if (keepCaptureOpen) {
        setFile(null);
        setMode("attach");
        requestAnimationFrame(() => fileInputRef.current?.focus());
        return;
      }
    }
    reset();
    collapseQuickCapture();
  };

  // Open the dedicated editor — commit current text as a draft thought first, then jump to it.
  const popOutToEditor = () => {
    const trimmed = text.trim();
    const item = createItem({
      type: "thought",
      text: trimmed || "",
      stayOnCurrentView: pathname !== "/canvas",
    });
    reset();
    collapseQuickCapture();
    requestAnimationFrame(() => openNoteEditor(item.id));
  };

  // ── Collapsed pill ──────────────────────────────────────────────────────
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={expand}
        style={{ transition: `transform 160ms ${EASE_OUT}, background-color 160ms ${EASE_OUT}, border-color 160ms ${EASE_OUT}, color 160ms ${EASE_OUT}` }}
        className={cn(
          "group flex items-center gap-2.5 rounded-full border border-[#2a2621] bg-[#181511]/85 px-4 py-2.5 backdrop-blur-md",
          "text-sm text-[#8d857b] hover:border-[#3a3530] hover:bg-[#1f1c17] hover:text-[#c8bfb2]",
          "shadow-lg shadow-black/40 transform-gpu",
          "active:scale-[0.97] motion-reduce:active:scale-100 motion-reduce:transition-none",
        )}
      >
        <SparklesIcon className="size-4 text-[#9b88ff] group-hover:text-[#b3a4ff]" style={{ transition: `color 160ms ${EASE_OUT}` }} />
        <span>Quick capture</span>
        <span className="ml-1 rounded-[5px] bg-[#2b2722] px-1.5 py-0.5 font-mono text-[10px] text-[#6b6460]">N</span>
      </button>
    );
  }

  const activeTab = MODE_TABS.find((t) => t.mode === mode)!;
  const ActiveIcon = activeTab.icon;
  const activeAccent = activeTab.accent;

  return (
    <>
      <style>{`
        .qcb-card {
          opacity: 1;
          transform: translateY(0) scale(1);
          transition: opacity 220ms ${EASE_DRAWER}, transform 220ms ${EASE_DRAWER}, box-shadow 500ms ${EASE_OUT};
          transform-origin: bottom center;
          will-change: transform, opacity;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6);
        }
        @starting-style { .qcb-card { opacity: 0; transform: translateY(8px) scale(0.97); } }
        .qcb-card[data-highlight="true"] {
          box-shadow:
            0 0 0 2px rgba(155,136,255,0.45),
            0 0 36px 6px rgba(155,136,255,0.18),
            0 25px 50px -12px rgba(0,0,0,0.6);
        }
        .qcb-extra { opacity: 1; transform: translateY(0); transition: opacity 200ms ${EASE_OUT}, transform 200ms ${EASE_OUT}; }
        @starting-style { .qcb-extra { opacity: 0; transform: translateY(4px); } }
        @media (prefers-reduced-motion: reduce) {
          .qcb-card, .qcb-extra { transition: opacity 120ms linear; transform: none !important; }
        }
      `}</style>

      <div
        data-highlight={highlight}
        className={cn("qcb-card",
          "w-[560px] max-w-[calc(100vw-2rem)] rounded-[14px] border border-[#332e28] bg-[#1c1916]/95 backdrop-blur-xl",
          "transform-gpu",
        )}
      >
        {/* ── Mode selector ── */}
        <div className="flex items-center gap-1 border-b border-[#2a2621] px-2 pt-2">
          <ToggleGroup
            value={[mode]}
            onValueChange={(v: string[]) => { if (v[0]) setMode(v[0] as Mode); }}
            className="flex-1 gap-0"
          >
            {MODE_TABS.map(({ mode: m, icon: Icon, label, accent }) => (
              <ToggleGroupItem
                key={m}
                value={m}
                style={{ transition: `background-color 150ms ${EASE_OUT}, color 150ms ${EASE_OUT}, transform 160ms ${EASE_OUT}` }}
                className={cn(
                  "h-8 gap-1.5 rounded-[7px] px-3 text-[13px] font-medium transform-gpu",
                  "text-[#7f776d] hover:bg-[#252220] hover:text-[#c8bfb2]",
                  "data-[pressed=true]:bg-[#2a2621] data-[pressed=true]:text-white",
                  "active:scale-[0.96] motion-reduce:active:scale-100",
                  mode === m && accent,
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <button
            type="button"
            onClick={collapse}
            style={{ transition: `background-color 150ms ${EASE_OUT}, color 150ms ${EASE_OUT}, transform 160ms ${EASE_OUT}` }}
            className="mb-2 ml-1 flex size-7 items-center justify-center rounded-[6px] text-[#6b6460] hover:bg-[#252220] hover:text-[#c8bfb2] active:scale-[0.92] transform-gpu motion-reduce:active:scale-100"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-col gap-3 px-3 py-3">

          {/* THOUGHT — single-line OR auto-morphed textarea */}
          {mode === "thought" && (
            <>
              {!thoughtNotesMode ? (
                <div className="flex items-center gap-2.5">
                  <ActiveIcon className={cn("size-4 shrink-0", activeAccent)} />
                  <Input
                    ref={inputRef}
                    autoFocus
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { commit(); return; }
                      if (e.key === "Enter" && e.shiftKey) {
                        // Morph to notes mode and inject newline at cursor
                        e.preventDefault();
                        setThoughtNotesMode(true);
                        const sel = inputRef.current?.selectionStart ?? text.length;
                        setText(text.slice(0, sel) + "\n" + text.slice(sel));
                        requestAnimationFrame(() => {
                          textareaRef.current?.focus();
                          textareaRef.current?.setSelectionRange(sel + 1, sel + 1);
                        });
                        return;
                      }
                      handleArrowTabNav(e, mode, setMode);
                    }}
                    placeholder="Type a thought… (Shift+Enter for notes)"
                    className="h-10 rounded-[7px] border-0 bg-transparent px-1 text-[15px] text-white placeholder:text-[#6b6460] focus-visible:ring-0"
                  />
                </div>
              ) : (
                <div className="qcb-extra flex flex-col gap-2" key="thought-notes">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ActiveIcon className={cn("size-4 shrink-0", activeAccent)} />
                      <span className="text-[12px] font-medium text-[#a09889]">Notes</span>
                    </div>
                    <button
                      type="button"
                      onClick={popOutToEditor}
                      title="Open full editor"
                      style={{ transition: `background-color 150ms ${EASE_OUT}, color 150ms ${EASE_OUT}, transform 160ms ${EASE_OUT}` }}
                      className={cn(
                        "flex items-center gap-1 rounded-[5px] border border-[#2a2621] bg-[#181511] px-1.5 py-0.5",
                        "text-[10px] text-[#7f776d] hover:bg-[#252220] hover:text-[#c8bfb2]",
                        "transform-gpu active:scale-[0.94] motion-reduce:active:scale-100",
                      )}
                    >
                      <ArrowUpRightIcon className="size-2.5" />
                      Open editor
                    </button>
                  </div>
                  <textarea
                    ref={textareaRef}
                    autoFocus
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        commit();
                        return;
                      }
                      if (e.key === "Escape") {
                        if (text.length === 0) {
                          setThoughtNotesMode(false);
                          requestAnimationFrame(() => inputRef.current?.focus());
                        }
                      }
                    }}
                    placeholder="Markdown supported · ⌘+Enter to save"
                    style={{ minHeight: 80 }}
                    className={cn(
                      "w-full resize-none rounded-[8px] border border-[#2a2621] bg-[#181511] px-3 py-2.5",
                      "font-mono text-[13px] leading-6 text-[#d8d2ca] placeholder:text-[#4a4540]",
                      "outline-none focus:border-[#3a3530]",
                    )}
                  />
                </div>
              )}
            </>
          )}

          {/* TASK — chain on Enter */}
          {mode === "task" && (
            <>
              {pendingTasks.length > 0 && (
                <div className="qcb-extra flex flex-col gap-1" key={`pending-${pendingTasks.length}`}>
                  <PendingTaskRow
                    value={pendingTasks[0]}
                    isMain
                    onChange={(next) =>
                      setPendingTasks((current) =>
                        current.map((task, index) => (index === 0 ? next : task)),
                      )
                    }
                    onRemove={() => setPendingTasks((current) => current.slice(1))}
                    onEnter={() => inputRef.current?.focus()}
                  />
                  {pendingTasks.length > 1 && (
                    <DndContext sensors={taskSensors} onDragEnd={handlePendingTaskDragEnd}>
                      <SortableContext
                        items={pendingTasks.slice(1).map((_, index) => `pending-${index + 1}`)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="flex flex-col gap-1">
                          {pendingTasks.slice(1).map((task, subIndex) => {
                            const index = subIndex + 1;
                            return (
                              <SortablePendingTaskRow
                                key={`pending-${index}`}
                                id={`pending-${index}`}
                                value={task}
                                onChange={(next) =>
                                  setPendingTasks((current) =>
                                    current.map((candidate, taskIndex) =>
                                      taskIndex === index ? next : candidate,
                                    ),
                                  )
                                }
                                onRemove={() =>
                                  setPendingTasks((current) =>
                                    current.filter((_, taskIndex) => taskIndex !== index),
                                  )
                                }
                                onEnter={() => inputRef.current?.focus()}
                              />
                            );
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2.5">
                <ActiveIcon className={cn("size-4 shrink-0", activeAccent)} />
                <Input
                  ref={inputRef}
                  autoFocus
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); return; }
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const trimmed = text.trim();
                      if (trimmed) {
                        setPendingTasks((p) => [...p, trimmed]);
                        setText("");
                      } else if (allTasks.length > 0) {
                        commit();
                      }
                      return;
                    }
                    if (e.key === "Backspace" && text === "" && pendingTasks.length > 0) {
                      e.preventDefault();
                      const last = pendingTasks[pendingTasks.length - 1];
                      setPendingTasks((p) => p.slice(0, -1));
                      setText(last);
                      return;
                    }
                    handleArrowTabNav(e, mode, setMode);
                  }}
                  placeholder={pendingTasks.length === 0 ? "Main task... try tomorrow 3pm or !p1" : "Subtask..."}
                  className="h-10 rounded-[7px] border-0 bg-transparent px-1 text-[15px] text-white placeholder:text-[#6b6460] focus-visible:ring-0"
                />
              </div>

              {parsedTask && parsedTask.tokens.length > 0 && (
                <div className="qcb-extra -mt-1 flex flex-wrap gap-1.5 pl-7" key={parsedTask.tokens.map((t) => t.label).join("-")}>
                  {parsedTask.tokens.map((token) => (
                    <span
                      key={`${token.kind}-${token.label}`}
                      className={cn(
                        "rounded-[5px] border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
                        token.kind === "priority"
                          ? "border-amber-400/30 bg-amber-400/15 text-amber-300"
                          : token.kind === "tag"
                            ? "border-[#1e3a45] bg-[#1e2a30] text-[#4aa5c8]"
                            : "border-[#3a3530] bg-[#252220] text-[#c8bfb2]",
                      )}
                    >
                      {token.kind === "priority" ? "Priority " : token.kind === "tag" ? "" : "Due "}{token.label}
                    </span>
                  ))}
                </div>
              )}

              {/* Shared priority + date for the whole batch */}
              <div className="flex flex-wrap items-center gap-1.5 pl-7">
                {([1, 2, 3] as Priority[]).map((p) => {
                  const cfg = PRIORITY_CONFIG[p];
                  const selected = effectivePriority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      style={{ transition: `background-color 150ms ${EASE_OUT}, color 150ms ${EASE_OUT}, border-color 150ms ${EASE_OUT}, transform 200ms ${EASE_OUT}` }}
                      className={cn(
                        "flex items-center gap-1 rounded-[6px] border px-2 py-0.5 text-[11px] font-semibold transform-gpu",
                        selected ? `${cfg.color} ${cfg.bg} scale-[1.04]` : "border-transparent text-[#5a5450] hover:text-[#c8bfb2]",
                        "active:scale-[0.94] motion-reduce:active:scale-100 motion-reduce:scale-100",
                      )}
                    >
                      <FlagIcon className="size-2.5" />
                      {cfg.label}
                    </button>
                  );
                })}

                <div className="mx-1 h-3.5 w-px bg-[#2a2621]" />

                <PopoverRoot open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger
                    render={
                      <button
                        type="button"
                        style={{ transition: `background-color 150ms ${EASE_OUT}, color 150ms ${EASE_OUT}, border-color 150ms ${EASE_OUT}, transform 160ms ${EASE_OUT}` }}
                        className={cn(
                          "flex items-center gap-1.5 rounded-[6px] border px-2 py-0.5 text-[11px] font-medium transform-gpu",
                          "active:scale-[0.95] motion-reduce:active:scale-100",
                          effectiveDueDate ? "border-[#332e28] bg-[#252220] text-[#c8bfb2]" : "border-transparent text-[#5a5450] hover:text-[#c8bfb2]",
                        )}
                      />
                    }
                  >
                    <CalendarIcon className="size-2.5" />
                    {effectiveDueDate ? formatDueLabel(effectiveDueDate, effectiveDueHasTime) : "Due date"}
                  </PopoverTrigger>
                  <PopoverContent>
                    <Calendar
                      mode="single"
                      selected={effectiveDueDate ?? undefined}
                      onSelect={(d) => {
                        if (d) {
                          const next = new Date(d);
                          if (effectiveDueHasTime && effectiveDueDate) {
                            next.setHours(effectiveDueDate.getHours(), effectiveDueDate.getMinutes(), 0, 0);
                          }
                          setDueDate(next);
                          setDueHasTime(effectiveDueHasTime);
                        }
                        else {
                          setDueDate(null);
                          setDueHasTime(false);
                        }
                      }}
                      disabled={{ before: startOfDay(new Date()) }}
                    />
                    <div className="border-[#252118] border-t px-3 py-2">
                      <label className="flex items-center justify-between gap-3 text-[#8d857b] text-xs">
                        <span>Time</span>
                        <input
                          type="time"
                          value={effectiveDueDate && effectiveDueHasTime ? toTimeInputValue(effectiveDueDate) : ""}
                          onChange={(event) => {
                            if (!event.target.value) {
                              setDueHasTime(false);
                              return;
                            }
                            const [hours, minutes] = event.target.value.split(":").map(Number);
                            const next = effectiveDueDate ? new Date(effectiveDueDate) : new Date();
                            next.setHours(hours ?? 0, minutes ?? 0, 0, 0);
                            setDueDate(next);
                            setDueHasTime(true);
                          }}
                          className="h-7 rounded-[5px] border border-[#302c27] bg-[#181511] px-2 font-mono text-[#f0ebe3] text-xs outline-none focus:border-[#4c463e]"
                        />
                      </label>
                      <p className="mt-1.5 text-[#5c554d] text-[10px]">Indonesia time (WIB)</p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          disabled={!effectiveDueDate || !effectiveDueHasTime}
                          onClick={() => setDueHasTime(false)}
                          className="text-[#8d857b] text-xs hover:text-[#c8bfb2] disabled:text-[#3d3830]"
                        >
                          Clear time
                        </button>
                        <button
                          type="button"
                          disabled={!effectiveDueDate}
                          onClick={() => {
                            setDueDate(null);
                            setDueHasTime(false);
                          }}
                          className="text-[#8d857b] text-xs hover:text-[#c8bfb2] disabled:text-[#3d3830]"
                        >
                          Clear due
                        </button>
                      </div>
                    </div>
                  </PopoverContent>
                </PopoverRoot>

                {dueDate && (
                  <button
                    type="button"
                    onClick={() => {
                      setDueDate(null);
                      setDueHasTime(false);
                    }}
                    style={{ transition: `background-color 150ms ${EASE_OUT}, color 150ms ${EASE_OUT}, transform 160ms ${EASE_OUT}` }}
                    className="flex size-5 items-center justify-center rounded-[4px] text-[#5a5450] hover:bg-[#252220] hover:text-[#c8bfb2] active:scale-[0.9] transform-gpu motion-reduce:active:scale-100"
                  >
                    <XIcon className="size-2.5" />
                  </button>
                )}

                {allTasks.length > 1 && (
                  <span className="ml-auto font-mono text-[10px] text-[#5c554d]">
                    1 main + {allTasks.length - 1} sub
                  </span>
                )}
              </div>
            </>
          )}

          {/* LINK */}
          {mode === "link" && (
            <>
              <div className="flex items-center gap-2.5">
                <ActiveIcon className={cn("size-4 shrink-0", activeAccent)} />
                <Input
                  ref={inputRef}
                  autoFocus
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") commit(); else handleArrowTabNav(e, mode, setMode); }}
                  placeholder="Paste a URL…"
                  className="h-10 rounded-[7px] border-0 bg-transparent px-1 text-[15px] text-white placeholder:text-[#6b6460] focus-visible:ring-0"
                />
              </div>
              {isValidUrl(text.trim()) && (
                <div className="qcb-extra ml-7 flex items-center gap-2.5 rounded-[8px] border border-[#2a2621] bg-[#181511] px-2.5 py-1.5" key={`link-${extractDomain(text)}`}>
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${extractDomain(text)}&sz=32`}
                    alt=""
                    className="size-4 rounded-[3px]"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                  <span className="truncate text-xs text-[#a09889]">{extractDomain(text)}</span>
                </div>
              )}
            </>
          )}

          {/* ATTACH */}
          {mode === "attach" && (
            <AttachBody
              file={file}
              dragging={dragging}
              setDragging={setDragging}
              onFile={handleFile}
              onClear={() => setFile(null)}
              onPick={() => fileInputRef.current?.click()}
              fileInputRef={fileInputRef}
            />
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between rounded-b-[14px] border-t border-[#2a2621] bg-[#181511]/40 px-3 py-2">
          <span className="text-[11px] text-[#5a5450]">
            {mode === "thought" && (thoughtNotesMode ? "⌘+Enter to save · Esc to close" : "Enter to add · Shift+Enter for notes")}
            {mode === "task"    && (keepCaptureOpen ? "⌘+Enter saves and keeps task open" : pendingTasks.length > 0 ? "Enter chains · ⌘+Enter saves all" : "Enter chains tasks · ⌘+Enter saves")}
            {mode === "link"    && (keepCaptureOpen ? "Enter saves and keeps link open" : "Enter to add · Esc to close")}
            {mode === "attach"  && (keepCaptureOpen ? "Save keeps attach open" : "Drop file or browse")}
          </span>
          {(mode === "thought" || mode === "task" || mode === "link" || mode === "attach") && (
            <label className="ml-auto mr-2 flex items-center gap-2 rounded-[6px] px-1.5 py-1 text-[11px] text-[#8d857b]">
              <Checkbox
                checked={keepCaptureOpen}
                onCheckedChange={(checked) => setKeepCaptureOpen(checked === true)}
                className="size-3.5 rounded-[3px]"
              />
              Keep open
            </label>
          )}
          <Button
            type="button"
            size="sm"
            disabled={!canCommit}
            onClick={commit}
            style={{ transition: `background-color 160ms ${EASE_OUT}, opacity 160ms ${EASE_OUT}, transform 160ms ${EASE_OUT}` }}
            className={cn(
              "h-7 gap-1.5 rounded-[6px] bg-[#907ce8] px-3 font-semibold text-[#17131f] hover:bg-[#a08ef2] disabled:opacity-30 transform-gpu",
              "active:scale-[0.96] motion-reduce:active:scale-100",
            )}
          >
            Save
            <SendHorizontalIcon className="size-3" />
          </Button>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function handleArrowTabNav(
  e: React.KeyboardEvent<HTMLInputElement>,
  mode: Mode,
  setMode: (m: Mode) => void,
) {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const target = e.currentTarget;
  const atStart = target.selectionStart === 0 && target.selectionEnd === 0;
  const atEnd   = target.selectionStart === target.value.length && target.selectionEnd === target.value.length;
  const idx = MODE_TABS.findIndex((t) => t.mode === mode);
  if (e.key === "ArrowLeft" && atStart && idx > 0) { setMode(MODE_TABS[idx - 1].mode); e.preventDefault(); }
  else if (e.key === "ArrowRight" && atEnd && idx < MODE_TABS.length - 1) { setMode(MODE_TABS[idx + 1].mode); e.preventDefault(); }
}

function PendingTaskRow({
  value,
  isMain = false,
  onChange,
  onRemove,
  onEnter,
  dragHandle,
}: {
  value: string;
  isMain?: boolean;
  onChange: (value: string) => void;
  onRemove: () => void;
  onEnter: () => void;
  dragHandle?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-[6px] border bg-[#181511] py-1.5",
        isMain ? "border-amber-300/30 px-2.5" : "ml-5 border-[#2a2621] px-2 py-1",
      )}
    >
      {isMain ? (
        <CheckSquareIcon className="size-3.5 shrink-0 text-amber-300/80" />
      ) : (
        dragHandle ?? <span className="ml-0.5 size-1 shrink-0 rounded-full bg-[#5a5450]" />
      )}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onEnter();
          }
        }}
        className={cn(
          "min-w-0 flex-1 bg-transparent outline-none",
          isMain ? "text-[13px] font-semibold text-[#efe9df]" : "text-[12px] text-[#a09889]",
        )}
      />
      {isMain && (
        <span className="rounded-[4px] bg-[#221f1b] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#7f6e3e]">
          Main
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        style={{ transition: `background-color 150ms ${EASE_OUT}, color 150ms ${EASE_OUT}, transform 160ms ${EASE_OUT}` }}
        className="flex size-5 items-center justify-center rounded-[4px] text-[#5a5450] hover:bg-[#252220] hover:text-[#c8bfb2] active:scale-[0.9] transform-gpu motion-reduce:active:scale-100"
      >
        <XIcon className="size-2.5" />
      </button>
    </div>
  );
}

function SortablePendingTaskRow({
  id,
  value,
  onChange,
  onRemove,
  onEnter,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onRemove: () => void;
  onEnter: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-80")}
    >
      <PendingTaskRow
        value={value}
        onChange={onChange}
        onRemove={onRemove}
        onEnter={onEnter}
        dragHandle={
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="grid size-4 shrink-0 cursor-grab place-items-center text-[#4c463e] hover:text-[#8d857b] active:cursor-grabbing"
            aria-label="Reorder subtask"
          >
            <GripIcon />
          </button>
        }
      />
    </div>
  );
}

function GripIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <circle cx="4" cy="3" r="1" />
      <circle cx="8" cy="3" r="1" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="8" cy="6" r="1" />
      <circle cx="4" cy="9" r="1" />
      <circle cx="8" cy="9" r="1" />
    </svg>
  );
}

function AttachBody({
  file,
  dragging,
  setDragging,
  onFile,
  onClear,
  onPick,
  fileInputRef,
}: {
  file: FileState | null;
  dragging: boolean;
  setDragging: (v: boolean) => void;
  onFile: (f: File) => void;
  onClear: () => void;
  onPick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  if (file) {
    const isImage = file.type.startsWith("image/");
    return (
      <div className="qcb-extra flex items-center gap-3 rounded-[8px] border border-[#2a2621] bg-[#181511] px-2.5 py-2" key={file.name}>
        {isImage && file.previewUrl ? (
          <img src={file.previewUrl} alt="" className="size-10 shrink-0 rounded-[6px] object-cover" />
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[6px] bg-[#252220]">
            <FileIcon className="size-5 text-[#6b6460]" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[#efe9df]">{file.name}</p>
          <p className="text-xs text-[#5a5450]">{formatBytes(file.size)}</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          style={{ transition: `background-color 150ms ${EASE_OUT}, color 150ms ${EASE_OUT}, transform 160ms ${EASE_OUT}` }}
          className="flex size-7 items-center justify-center rounded-[5px] text-[#6b6460] hover:bg-[#252220] hover:text-[#c8bfb2] active:scale-[0.9] transform-gpu motion-reduce:active:scale-100"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={onPick}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
      style={{ transition: `background-color 200ms ${EASE_OUT}, border-color 200ms ${EASE_OUT}, transform 220ms ${EASE_OUT}` }}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-[8px] border-2 border-dashed px-3 py-3 transform-gpu",
        dragging ? "border-[#907ce8]/60 bg-[#907ce8]/5 scale-[1.01]" : "border-[#332e28] bg-[#181511] hover:border-[#4a4540] hover:bg-[#1e1c18]",
        "motion-reduce:scale-100",
      )}
    >
      <div
        style={{ transition: `background-color 200ms ${EASE_OUT}, color 200ms ${EASE_OUT}` }}
        className={cn("flex size-9 shrink-0 items-center justify-center rounded-[6px]", dragging ? "bg-[#907ce8]/15" : "bg-[#252220]")}
      >
        <ImageIcon className={cn("size-4", dragging ? "text-[#907ce8]" : "text-[#6b6460]")} style={{ transition: `color 200ms ${EASE_OUT}` }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[#c8bfb2]">Drop an image or file</p>
        <p className="text-xs text-[#5a5450]">or click to browse</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </div>
  );
}
