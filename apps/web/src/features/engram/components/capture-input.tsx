"use client";

import { cn } from "@alphonse/ui/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ItemType } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// CaptureInput — a single-line text input that renders a live, color-highlighted
// mirror of its contents behind a transparent <input>, and surfaces an "@" mention
// dropdown (styled like a command palette) for linking to existing nodes.
// ─────────────────────────────────────────────────────────────────────────────

export type MentionItem = { id: string; label: string; type: ItemType };

export type CaptureToken = "priority" | "tag" | "date" | "mention";

type Segment = { text: string; kind: "plain" | CaptureToken };

type Range = { start: number; end: number; kind: CaptureToken };

// Highlight-only regexes — kept loose on purpose; the canonical parsing for commit
// lives in parseTaskText. These just decide what to colorize as you type.
const TAG_RE = /#\w[\w-]*/g;
const MENTION_RE = /@\w*/g;
const PRIORITY_RE = /(^|\s)(!p?[123])\b/gi;
const DATE_WORD_RE = /\b(?:tonight|today|tomorrow|next week|someday|later)\b/gi;
const TIME_RE = /\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi;

function collectSimple(text: string, re: RegExp, kind: CaptureToken, out: Range[]) {
  re.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    out.push({ start: match.index, end: match.index + match[0].length, kind });
    if (match.index === re.lastIndex) re.lastIndex++; // guard against zero-width
  }
}

function tokenize(text: string, enabled: CaptureToken[]): Segment[] {
  if (!text) return [];
  const ranges: Range[] = [];

  if (enabled.includes("priority")) {
    PRIORITY_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = PRIORITY_RE.exec(text))) {
      const lead = m[1]?.length ?? 0; // skip the leading whitespace/anchor
      ranges.push({ start: m.index + lead, end: m.index + m[0].length, kind: "priority" });
    }
  }
  if (enabled.includes("tag")) collectSimple(text, TAG_RE, "tag", ranges);
  if (enabled.includes("mention")) collectSimple(text, MENTION_RE, "mention", ranges);
  if (enabled.includes("date")) {
    collectSimple(text, DATE_WORD_RE, "date", ranges);
    collectSimple(text, TIME_RE, "date", ranges);
  }

  // Sort and drop any range that overlaps one already accepted.
  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  const accepted: Range[] = [];
  let lastEnd = -1;
  for (const range of ranges) {
    if (range.start < lastEnd) continue;
    accepted.push(range);
    lastEnd = range.end;
  }

  // Walk the string, filling plain gaps between accepted ranges.
  const segments: Segment[] = [];
  let cursor = 0;
  for (const range of accepted) {
    if (range.start > cursor) segments.push({ text: text.slice(cursor, range.start), kind: "plain" });
    segments.push({ text: text.slice(range.start, range.end), kind: range.kind });
    cursor = range.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), kind: "plain" });
  return segments;
}

const SEGMENT_CLASS: Record<Segment["kind"], string> = {
  plain: "text-white",
  priority: "rounded-[3px] bg-amber-400/15 text-amber-300",
  tag: "rounded-[3px] bg-sky-400/15 text-sky-300",
  date: "rounded-[3px] bg-emerald-400/15 text-emerald-300",
  mention: "rounded-[3px] bg-violet-400/20 text-violet-300",
};

const TYPE_DOT: Record<ItemType, string> = {
  thought: "bg-[#907ce8]",
  task: "bg-[#d9a82f]",
  link: "bg-[#4aa5c8]",
  image: "bg-[#43b6a6]",
  file: "bg-[#8d857b]",
};

// Typography shared verbatim between the <input> and its highlight backdrop so the
// caret lines up glyph-for-glyph. Any change here must be mirrored in both elements.
const FIELD_TYPE = "px-1 py-2 text-[15px] leading-6";

type MentionState = { query: string; at: number; caret: number } | null;

function getMentionState(value: string, caret: number): MentionState {
  const upto = value.slice(0, caret);
  const match = upto.match(/(?:^|\s)@(\w*)$/);
  if (!match) return null;
  const query = match[1] ?? "";
  return { query, at: caret - query.length - 1, caret };
}

type CaptureInputProps = {
  value: string;
  onValueChange: (value: string) => void;
  /** Called for key presses the mention dropdown does not consume. */
  onCommitKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  highlight?: CaptureToken[];
  mentionItems?: MentionItem[];
  onSelectMention?: (item: MentionItem) => void;
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
  autoFocus,
  inputRef,
  className,
}: CaptureInputProps) {
  const internalRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? internalRef;
  const backdropRef = useRef<HTMLDivElement>(null);
  const [mention, setMention] = useState<MentionState>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const mentionsEnabled = highlight.includes("mention") && !!mentionItems && !!onSelectMention;

  const filtered = (() => {
    if (!mention || !mentionItems) return [];
    const q = mention.query.toLowerCase();
    return mentionItems.filter((i) => i.label.toLowerCase().includes(q)).slice(0, 6);
  })();
  const dropdownOpen = mentionsEnabled && mention !== null && filtered.length > 0;

  const segments = tokenize(value, highlight);

  // Keep the backdrop's horizontal scroll glued to the input's.
  const syncScroll = useCallback(() => {
    if (backdropRef.current && ref.current) {
      backdropRef.current.scrollLeft = ref.current.scrollLeft;
    }
  }, [ref]);

  useEffect(() => {
    syncScroll();
  }, [value, syncScroll]);

  const refreshMention = useCallback(
    (nextValue: string, caret: number | null) => {
      if (!mentionsEnabled || caret === null) {
        setMention(null);
        return;
      }
      const next = getMentionState(nextValue, caret);
      setMention(next);
      setActiveIndex(0);
    },
    [mentionsEnabled],
  );

  function handleSelect(item: MentionItem) {
    if (!mention) return;
    const before = value.slice(0, mention.at);
    const after = value.slice(mention.caret);
    const next = before + after;
    onValueChange(next);
    onSelectMention?.(item);
    setMention(null);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(mention.at, mention.at);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (dropdownOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % filtered.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        handleSelect(filtered[activeIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.nativeEvent.stopPropagation(); // don't let the bar's global Esc collapse it
        setMention(null);
        return;
      }
      // other keys fall through to edit text; mention recomputes on key up
      return;
    }
    onCommitKeyDown?.(e);
  }

  return (
    <div className={cn("relative min-w-0 flex-1", className)}>
      {/* Highlight backdrop — mirrors the input text with colored token spans. */}
      <div
        ref={backdropRef}
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 overflow-hidden whitespace-pre",
          FIELD_TYPE,
        )}
      >
        {segments.map((seg, i) => (
          <span key={`${i}-${seg.kind}`} className={SEGMENT_CLASS[seg.kind]}>
            {seg.text}
          </span>
        ))}
      </div>

      <input
        ref={ref}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          onValueChange(v);
          refreshMention(v, e.target.selectionStart);
        }}
        onKeyDown={handleKeyDown}
        onKeyUp={(e) => {
          // Don't recompute on dropdown-navigation keys — it would reset activeIndex.
          if (["ArrowUp", "ArrowDown", "Enter", "Tab", "Escape"].includes(e.key)) return;
          refreshMention(value, e.currentTarget.selectionStart);
        }}
        onClick={(e) => refreshMention(value, e.currentTarget.selectionStart)}
        onScroll={syncScroll}
        onBlur={() => requestAnimationFrame(() => setMention(null))}
        placeholder={placeholder}
        className={cn(
          "relative w-full bg-transparent text-transparent caret-white outline-none",
          "placeholder:text-[#6b6460]",
          FIELD_TYPE,
        )}
      />

      {/* "@" mention dropdown — command-palette styling, manually navigated. */}
      {dropdownOpen && (
        <div className="absolute top-full left-0 z-50 mt-1.5 w-[clamp(220px,100%,320px)] overflow-hidden rounded-[10px] border border-[#332e28] bg-[#1e1b17] py-1 shadow-xl shadow-black/50">
          <p className="px-2.5 pt-1 pb-1.5 font-mono text-[10px] text-[#6b6460] uppercase tracking-widest">
            Link to node
          </p>
          {filtered.map((item, i) => (
            <button
              key={item.id}
              type="button"
              // onMouseDown (not onClick) so the input's onBlur doesn't fire first
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(item);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px]",
                i === activeIndex ? "bg-[#2a2621] text-[#f0ebe3]" : "text-[#c8bfb2]",
              )}
            >
              <span className={cn("size-2 shrink-0 rounded-[2px]", TYPE_DOT[item.type])} />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <span className="shrink-0 font-mono text-[10px] text-[#6b6460] uppercase tracking-wider">
                {item.type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
