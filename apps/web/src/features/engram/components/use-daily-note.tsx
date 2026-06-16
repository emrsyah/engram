"use client";

import { Badge } from "@alphonse/ui/components/badge";
import { cn } from "@alphonse/ui/lib/utils";
import { useCallback, useRef, useState } from "react";

import { todayPrefix } from "../projections";
import { useEngramStore } from "../store";
import { Save } from "./icons";

// ─────────────────────────────────────────────────────────────────────────────
// useDailyNote — the shared daily-note editor: today's note lookup, debounced
// autosave with a save-state machine, and markdown key handling (bold/italic,
// tab indent, list continuation). Both the top-bar popover (FocusScratchpadPanel)
// and the focus dock (FocusScratchpadInline) consume this, so the autosave and
// editing behaviour stay identical between them.
// ─────────────────────────────────────────────────────────────────────────────

export type SaveState = "idle" | "saving" | "saved";

export function useDailyNote() {
  const { items, upsertDailyNote } = useEngramStore();
  const prefix = todayPrefix();
  const noteTitle = `Daily Note — ${prefix}`;
  const existing = items.find((item) => item.type === "thought" && item.title === noteTitle);

  const [value, setValue] = useState(existing?.text ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const saveStateTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
      setSaveState("idle");
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        upsertDailyNote(e.target.value);
        setSaveState("saving");
        clearTimeout(saveStateTimer.current);
        saveStateTimer.current = setTimeout(() => setSaveState("saved"), 200);
        saveStateTimer.current = setTimeout(() => setSaveState("idle"), 2200);
      }, 600);
    },
    [upsertDailyNote],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const mod = e.metaKey || e.ctrlKey;

      if (mod && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        wrapSelection(ta, value, setValue, "**");
        return;
      }
      if (mod && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        wrapSelection(ta, value, setValue, "*");
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const next = value.slice(0, start) + "  " + value.slice(end);
        setValue(next);
        requestAnimationFrame(() => ta.setSelectionRange(start + 2, start + 2));
        return;
      }
      if (e.key === "Enter" && !e.shiftKey && !mod) {
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const line = value.slice(lineStart, start);
        const m = line.match(/^(\s*)([-*]|\d+\.)\s/);
        if (m) {
          e.preventDefault();
          if (line.trim() === m[2]) {
            const next = value.slice(0, lineStart) + value.slice(start);
            setValue(next);
            requestAnimationFrame(() => ta.setSelectionRange(lineStart, lineStart));
            return;
          }
          const insert = "\n" + m[1] + m[2] + " ";
          const next = value.slice(0, start) + insert + value.slice(end);
          setValue(next);
          const pos = start + insert.length;
          requestAnimationFrame(() => ta.setSelectionRange(pos, pos));
        }
      }
    },
    [value],
  );

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const lineCount = value ? value.split("\n").length : 0;

  return { value, setValue, saveState, handleChange, handleKeyDown, wordCount, lineCount };
}

function wrapSelection(
  ta: HTMLTextAreaElement,
  value: string,
  setValue: (v: string) => void,
  wrap: string,
) {
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const sel = value.slice(start, end);
  const next = value.slice(0, start) + wrap + sel + wrap + value.slice(end);
  setValue(next);
  requestAnimationFrame(() => ta.setSelectionRange(start + wrap.length, end + wrap.length));
}

export function SaveStateIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;

  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-4 gap-1 rounded-[4px] px-1.5 font-mono text-[9px] transition-opacity duration-200",
        state === "saving" ? "bg-[#3a3327] text-[#d6a93a]" : "bg-[#1a2e2a] text-[#43b6a6]",
      )}
    >
      <Save className="size-2" />
      {state === "saving" ? "Saving…" : "Saved"}
    </Badge>
  );
}
