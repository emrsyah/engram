"use client";

import { cn } from "@alphonse/ui/lib/utils";
import { CalendarIcon, FlagIcon, Hash as HashIcon, LayoutDashboard as LayoutDashboardIcon } from "./icons";
import { useCallback, useEffect, useRef, useState } from "react";

import { type CaptureToken, highlightSegments, type Segment } from "../capture-grammar";
import type { ItemType } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// CaptureInput — single-line input with live syntax highlighting and trigger
// popups for @mention, !priority, ~space, and /command. The capture syntax
// itself lives in ../capture-grammar (shared with QuickCaptureBar's parser).
// ─────────────────────────────────────────────────────────────────────────────

export type MentionItem = { id: string; label: string; type: ItemType };
export type SpaceItem = { id: string; name: string };

export type { CaptureToken };

const SEGMENT_CLASS: Record<Segment["kind"], string> = {
  plain: "text-white",
  priority: "rounded-[3px] bg-amber-400/15 text-amber-300",
  tag: "rounded-[3px] bg-sky-400/15 text-sky-300",
  date: "rounded-[3px] bg-emerald-400/15 text-emerald-300",
  mention: "rounded-[3px] bg-violet-400/20 text-violet-300",
  space: "rounded-[3px] bg-teal-400/15 text-teal-300",
};

const TYPE_DOT: Record<ItemType, string> = {
  thought: "bg-[#907ce8]",
  task: "bg-[#d9a82f]",
  link: "bg-[#4aa5c8]",
  image: "bg-[#43b6a6]",
  file: "bg-[#8d857b]",
};

const FIELD_TYPE = "px-1 py-2 text-[15px] leading-6";

// ── Popup state ────────────────────────────────────────────────────────────

type PopupKind = "mention" | "priority" | "space" | "command";
type PopupState = {
  kind: PopupKind;
  query: string;
  triggerAt: number;
  caretAt: number;
} | null;

const PRIORITY_OPTIONS = [
  { id: "1", label: "P1", sublabel: "High",   shorthand: "!p1", color: "text-red-400",   bg: "bg-red-400/20" },
  { id: "2", label: "P2", sublabel: "Medium",  shorthand: "!p2", color: "text-amber-400", bg: "bg-amber-400/20" },
  { id: "3", label: "P3", sublabel: "Low",     shorthand: "!p3", color: "text-blue-400",  bg: "bg-blue-400/20" },
];

const COMMAND_OPTIONS = [
  { id: "priority", label: "Priority", hint: "!",  desc: "Set task priority",  Icon: FlagIcon },
  { id: "date",     label: "Date",     hint: "📅", desc: "Set due date",        Icon: CalendarIcon },
  { id: "space",    label: "Space",    hint: "~",  desc: "File to space",       Icon: LayoutDashboardIcon },
  { id: "tag",      label: "Tag",      hint: "#",  desc: "Add a tag",           Icon: HashIcon },
];

function filterPriority(query: string) {
  if (!query) return PRIORITY_OPTIONS;
  const q = query.toLowerCase();
  return PRIORITY_OPTIONS.filter(
    (p) => p.id === q || `p${p.id}` === q || p.sublabel.toLowerCase().startsWith(q),
  );
}

function filterCommands(query: string) {
  if (!query) return COMMAND_OPTIONS;
  const q = query.toLowerCase();
  return COMMAND_OPTIONS.filter((c) => c.label.toLowerCase().startsWith(q));
}

function getPopupState(
  value: string,
  caret: number,
  f: { mention: boolean; priority: boolean; space: boolean; command: boolean },
): PopupState {
  const upto = value.slice(0, caret);
  const m = upto.match(/(\S+)$/);
  if (!m) return null;
  const word = m[1];
  const triggerAt = caret - word.length;

  if (f.priority && word[0] === "!") return { kind: "priority", query: word.slice(1), triggerAt, caretAt: caret };
  if (f.space    && word[0] === "~") return { kind: "space",    query: word.slice(1), triggerAt, caretAt: caret };
  if (f.command  && word[0] === "/") return { kind: "command",  query: word.slice(1), triggerAt, caretAt: caret };
  if (f.mention  && word[0] === "@") return { kind: "mention",  query: word.slice(1), triggerAt, caretAt: caret };

  return null;
}

function splice(value: string, from: number, to: number, insert: string) {
  return value.slice(0, from) + insert + value.slice(to);
}

// ── Props ──────────────────────────────────────────────────────────────────

type CaptureInputProps = {
  value: string;
  onValueChange: (value: string) => void;
  onCommitKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  highlight?: CaptureToken[];
  mentionItems?: MentionItem[];
  onSelectMention?: (item: MentionItem) => void;
  spaces?: SpaceItem[];
  onSelectSpace?: (id: string, name: string) => void;
  onOpenDatePicker?: () => void;
  autoFocus?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  className?: string;
};

export function CaptureInput({
  value,
  onValueChange,
  onCommitKeyDown,
  placeholder,
  highlight = [],
  mentionItems,
  onSelectMention,
  spaces,
  onSelectSpace,
  onOpenDatePicker,
  autoFocus,
  inputRef,
  className,
}: CaptureInputProps) {
  const internalRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? internalRef;
  const backdropRef = useRef<HTMLDivElement>(null);
  const [popup, setPopup] = useState<PopupState>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const priorityEnabled = highlight.includes("priority");
  const mentionEnabled  = highlight.includes("mention") && !!mentionItems && !!onSelectMention;
  const spaceEnabled    = !!spaces && !!onSelectSpace;
  // /command palette: available in task mode (priority enabled)
  const commandEnabled  = priorityEnabled;

  const features = { mention: mentionEnabled, priority: priorityEnabled, space: spaceEnabled, command: commandEnabled };

  // Build the filtered list for the active popup
  const popupItems = (() => {
    if (!popup) return [];
    if (popup.kind === "priority") return filterPriority(popup.query);
    if (popup.kind === "command")  return filterCommands(popup.query);
    if (popup.kind === "space") {
      const q = popup.query.toLowerCase();
      const list = q ? (spaces ?? []).filter((s) => s.name.toLowerCase().includes(q)) : (spaces ?? []);
      return list.slice(0, 8);
    }
    if (popup.kind === "mention") {
      const q = popup.query.toLowerCase();
      return (mentionItems ?? []).filter((i) => i.label.toLowerCase().includes(q)).slice(0, 6);
    }
    return [];
  })();

  const dropdownOpen = popup !== null && popupItems.length > 0;
  const segments = highlightSegments(value, highlight, spaceEnabled);

  const syncScroll = useCallback(() => {
    if (backdropRef.current && ref.current) backdropRef.current.scrollLeft = ref.current.scrollLeft;
  }, [ref]);

  useEffect(() => { syncScroll(); }, [value, syncScroll]);

  const refreshPopup = useCallback(
    (nextValue: string, caret: number | null) => {
      if (caret === null) { setPopup(null); return; }
      const next = getPopupState(nextValue, caret, features);
      setPopup((prev) => {
        if (next?.kind !== prev?.kind) setActiveIndex(0);
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [priorityEnabled, mentionEnabled, spaceEnabled, commandEnabled],
  );

  function handleSelect(id: string) {
    if (!popup) return;

    if (popup.kind === "mention") {
      const item = mentionItems?.find((i) => i.id === id);
      if (!item) return;
      const next = splice(value, popup.triggerAt, popup.caretAt, "");
      onValueChange(next);
      onSelectMention?.(item);
      setPopup(null);
      const pos = popup.triggerAt;
      requestAnimationFrame(() => { ref.current?.focus(); ref.current?.setSelectionRange(pos, pos); });
      return;
    }

    if (popup.kind === "priority") {
      const opt = PRIORITY_OPTIONS.find((p) => p.id === id);
      if (!opt) return;
      const next = splice(value, popup.triggerAt, popup.caretAt, opt.shorthand);
      onValueChange(next);
      setPopup(null);
      const pos = popup.triggerAt + opt.shorthand.length;
      requestAnimationFrame(() => { ref.current?.focus(); ref.current?.setSelectionRange(pos, pos); });
      return;
    }

    if (popup.kind === "space") {
      const space = spaces?.find((s) => s.id === id);
      if (!space) return;
      const next = splice(value, popup.triggerAt, popup.caretAt, "");
      onValueChange(next);
      onSelectSpace?.(space.id, space.name);
      setPopup(null);
      const pos = popup.triggerAt;
      requestAnimationFrame(() => { ref.current?.focus(); ref.current?.setSelectionRange(pos, pos); });
      return;
    }

    if (popup.kind === "command") {
      if (id === "priority") {
        const next = splice(value, popup.triggerAt, popup.caretAt, "!");
        onValueChange(next);
        const newCaret = popup.triggerAt + 1;
        setPopup({ kind: "priority", query: "", triggerAt: popup.triggerAt, caretAt: newCaret });
        setActiveIndex(0);
        requestAnimationFrame(() => { ref.current?.focus(); ref.current?.setSelectionRange(newCaret, newCaret); });
      } else if (id === "date") {
        const next = splice(value, popup.triggerAt, popup.caretAt, "");
        onValueChange(next);
        setPopup(null);
        const pos = popup.triggerAt;
        requestAnimationFrame(() => { ref.current?.focus(); ref.current?.setSelectionRange(pos, pos); });
        onOpenDatePicker?.();
      } else if (id === "space") {
        const next = splice(value, popup.triggerAt, popup.caretAt, "~");
        onValueChange(next);
        const newCaret = popup.triggerAt + 1;
        setPopup({ kind: "space", query: "", triggerAt: popup.triggerAt, caretAt: newCaret });
        setActiveIndex(0);
        requestAnimationFrame(() => { ref.current?.focus(); ref.current?.setSelectionRange(newCaret, newCaret); });
      } else if (id === "tag") {
        const next = splice(value, popup.triggerAt, popup.caretAt, "#");
        onValueChange(next);
        setPopup(null);
        const pos = popup.triggerAt + 1;
        requestAnimationFrame(() => { ref.current?.focus(); ref.current?.setSelectionRange(pos, pos); });
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (dropdownOpen) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => (i + 1) % popupItems.length); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIndex((i) => (i - 1 + popupItems.length) % popupItems.length); return; }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        handleSelect((popupItems[activeIndex] as { id: string }).id);
        return;
      }
      if (e.key === "Escape") { e.preventDefault(); e.nativeEvent.stopPropagation(); setPopup(null); return; }
      // let other keys fall through to mutate text; popup recomputes on keyup
      return;
    }
    onCommitKeyDown?.(e);
  }

  const popupTitle =
    popup?.kind === "mention" ? "Link to node" :
    popup?.kind === "priority" ? "Set priority" :
    popup?.kind === "space" ? "File to space" :
    "Commands";

  return (
    <div className={cn("relative min-w-0 flex-1", className)}>
      {/* Highlight backdrop */}
      <div
        ref={backdropRef}
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 overflow-hidden whitespace-pre", FIELD_TYPE)}
      >
        {segments.map((seg, i) => (
          <span key={`${i}-${seg.kind}`} className={SEGMENT_CLASS[seg.kind]}>{seg.text}</span>
        ))}
      </div>

      <input
        ref={ref}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          refreshPopup(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={handleKeyDown}
        onKeyUp={(e) => {
          if (["ArrowUp", "ArrowDown", "Enter", "Tab", "Escape"].includes(e.key)) return;
          refreshPopup(value, e.currentTarget.selectionStart);
        }}
        onClick={(e) => refreshPopup(value, e.currentTarget.selectionStart)}
        onScroll={syncScroll}
        onBlur={() => requestAnimationFrame(() => setPopup(null))}
        placeholder={placeholder}
        className={cn(
          "relative w-full bg-transparent text-transparent caret-white outline-none",
          "placeholder:text-[#6b6460]",
          FIELD_TYPE,
        )}
      />

      {/* Popup dropdown */}
      {dropdownOpen && (
        <div className="absolute bottom-full left-0 z-[200] mb-1.5 w-[clamp(240px,100%,340px)] overflow-hidden rounded-[10px] border border-[#332e28] bg-[#1e1b17] py-1 shadow-xl shadow-black/50">
          <p className="px-2.5 pt-1 pb-1.5 font-mono text-[10px] uppercase tracking-widest text-[#6b6460]">
            {popupTitle}
          </p>

          {popup?.kind === "priority" && (popupItems as typeof PRIORITY_OPTIONS).map((item, i) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(item.id); }}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                "flex w-full items-center gap-2.5 px-2.5 py-2 text-left",
                i === activeIndex ? "bg-[#2a2621]" : "hover:bg-[#252220]",
              )}
            >
              <span className={cn("grid size-6 shrink-0 place-items-center rounded-[5px] font-bold text-[11px]", item.bg, item.color)}>
                {item.label}
              </span>
              <span className={cn("flex-1 text-[13px] font-medium", item.color)}>{item.sublabel}</span>
              <span className="font-mono text-[10px] text-[#6b6460]">{item.shorthand}</span>
            </button>
          ))}

          {popup?.kind === "command" && (popupItems as typeof COMMAND_OPTIONS).map((item, i) => {
            const { Icon } = item;
            return (
              <button
                key={item.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(item.id); }}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-2.5 py-2 text-left",
                  i === activeIndex ? "bg-[#2a2621] text-[#f0ebe3]" : "text-[#c8bfb2] hover:bg-[#252220]",
                )}
              >
                <Icon className="size-3.5 shrink-0 text-[#6b6460]" />
                <span className="flex-1 text-[13px]">{item.label}</span>
                <span className="text-[11px] text-[#6b6460]">{item.desc}</span>
                <span className="ml-1 rounded-[4px] bg-[#2a2621] px-1.5 py-0.5 font-mono text-[10px] text-[#8d857b]">{item.hint}</span>
              </button>
            );
          })}

          {popup?.kind === "space" && (popupItems as SpaceItem[]).map((item, i) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(item.id); }}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px]",
                i === activeIndex ? "bg-[#2a2621] text-[#f0ebe3]" : "text-[#c8bfb2] hover:bg-[#252220]",
              )}
            >
              <span className="size-1.5 shrink-0 rounded-full bg-[#43b6a6]" />
              <span className="flex-1 truncate">{item.name}</span>
            </button>
          ))}

          {popup?.kind === "mention" && (popupItems as MentionItem[]).map((item, i) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(item.id); }}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px]",
                i === activeIndex ? "bg-[#2a2621] text-[#f0ebe3]" : "text-[#c8bfb2] hover:bg-[#252220]",
              )}
            >
              <span className={cn("size-2 shrink-0 rounded-[2px]", TYPE_DOT[item.type])} />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-[#6b6460]">{item.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
