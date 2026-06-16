"use client";

import { Button } from "@alphonse/ui/components/button";
import { cn } from "@alphonse/ui/lib/utils";
import { format } from "date-fns";
import {
  ExternalLink as ExternalLinkIcon,
  Hash as HashIcon,
  MaximizeIcon,
  MinimizeIcon,
  DeleteIcon as Trash2Icon,
  CancelIcon as XIcon,
} from "./icons";
import { useEffect, useRef, useState } from "react";

import { useEngramStore } from "../store";
import type { Item } from "../types";
import { useUIStore } from "../ui-store";

const EASE_OUT     = "cubic-bezier(0.23, 1, 0.32, 1)";
const EASE_DRAWER  = "cubic-bezier(0.32, 0.72, 0, 1)";

export function NoteEditorPanel() {
  const { noteEditorItemId, closeNoteEditor, openDetail } = useUIStore();
  const { items, updateItem, removeItem } = useEngramStore();
  const item = items.find((i) => i.id === noteEditorItemId);

  if (!item) return null;

  return (
    <NoteEditorPanelContent
      key={item.id}
      item={item}
      closeNoteEditor={closeNoteEditor}
      openDetail={openDetail}
      updateItem={updateItem}
      removeItem={removeItem}
    />
  );
}

function NoteEditorPanelContent({
  item,
  closeNoteEditor,
  openDetail,
  updateItem,
  removeItem,
}: {
  item: Item;
  closeNoteEditor: () => void;
  openDetail: (id: string) => void;
  updateItem: (id: string, patch: Partial<Item>) => void;
  removeItem: (id: string) => void;
}) {
  const isOpen = !!item;

  const [title, setTitle] = useState(() => item.title ?? "");
  const [body, setBody]   = useState(() => item.text ?? "");
  const [wide, setWide]   = useState(false);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef  = useRef<HTMLTextAreaElement>(null);
  const savingTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    requestAnimationFrame(() => {
      bodyRef.current?.focus();
      bodyRef.current?.setSelectionRange(item.text?.length ?? 0, item.text?.length ?? 0);
    });
  }, [item.id, item.text]);

  useEffect(() => {
    return () => {
      if (savingTimeoutRef.current) window.clearTimeout(savingTimeoutRef.current);
    };
  }, []);

  // Esc closes (only when focus is inside the panel)
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const ae = document.activeElement as HTMLElement | null;
        if (ae?.closest?.("[data-note-editor]")) closeNoteEditor();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, closeNoteEditor]);

  const handleDelete = () => {
    if (!item) return;
    removeItem(item.id);
    closeNoteEditor();
  };

  const handleTitleChange = (nextTitle: string) => {
    setTitle(nextTitle);
    markSaving();
    updateItem(item.id, { title: nextTitle.trim() || undefined });
  };

  const handleBodyChange = (nextBody: string) => {
    setBody(nextBody);
    markSaving();
    updateItem(item.id, { text: nextBody });
  };

  const markSaving = () => {
    setSaving(true);
    if (savingTimeoutRef.current) window.clearTimeout(savingTimeoutRef.current);
    savingTimeoutRef.current = window.setTimeout(() => setSaving(false), 400);
  };

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  const charCount = body.length;

  return (
    <>
      <style>{`
        .note-panel {
          transform: translateX(100%);
          transition: transform 280ms ${EASE_DRAWER};
          will-change: transform;
        }
        .note-panel[data-open="true"] { transform: translateX(0); }
        @media (prefers-reduced-motion: reduce) {
          .note-panel { transition: opacity 120ms linear; }
        }
        .note-textarea::-webkit-scrollbar { width: 8px; }
        .note-textarea::-webkit-scrollbar-thumb {
          background: #2a2621; border-radius: 4px;
        }
        .note-textarea::-webkit-scrollbar-thumb:hover { background: #3a3530; }
      `}</style>

      <div
        data-note-editor
        data-open={isOpen}
        className={cn(
          "note-panel fixed top-0 right-0 z-40 flex h-full flex-col",
          "border-l border-[#252118] bg-[#141210] shadow-2xl shadow-black/50",
          wide ? "w-[min(900px,75vw)]" : "w-[min(640px,55vw)]",
        )}
        style={{ transition: `transform 280ms ${EASE_DRAWER}, width 220ms ${EASE_OUT}` }}
      >
        {item && (
          <>
            {/* ── Header ── */}
            <div className="flex items-center gap-2 border-b border-[#252118] px-4 py-3">
              <span className="rounded-[5px] bg-[#221f1b] px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-[#7f776d]">
                {item.type}
              </span>
              <span className="font-mono text-[10px] text-[#3d3830]">
                {format(new Date(item.createdAt), "MMM d, h:mm a")}
              </span>

              <div className="ml-auto flex items-center gap-0.5">
                <IconBtn
                  title={wide ? "Narrow" : "Wide"}
                  onClick={() => setWide((v) => !v)}
                  Icon={wide ? MinimizeIcon : MaximizeIcon}
                />
                <IconBtn
                  title="Open detail panel"
                  onClick={() => { openDetail(item.id); }}
                  Icon={ExternalLinkIcon}
                />
                <IconBtn title="Close" onClick={closeNoteEditor} Icon={XIcon} />
              </div>
            </div>

            {/* ── Title ── */}
            <div className="border-b border-[#221f1b] px-6 pt-6 pb-3">
              <input
                ref={titleRef}
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); bodyRef.current?.focus(); }
                  if (e.key === "ArrowDown" || e.key === "Tab") { e.preventDefault(); bodyRef.current?.focus(); }
                }}
                placeholder="Untitled note"
                className={cn(
                  "w-full bg-transparent text-[26px] font-bold text-[#f0ebe3] outline-none",
                  "placeholder:text-[#3d3830]",
                )}
              />
            </div>

            {/* ── Body (markdown textarea) ── */}
            <div className="flex-1 overflow-hidden">
              <textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => handleBodyChange(e.target.value)}
                onKeyDown={(e) => handleEditorKey(e, body, handleBodyChange, markSaving)}
                placeholder={"Start writing… markdown supported.\n\nTab indents · ⌘+B wraps in **bold** · ⌘+I in *italic*"}
                className={cn(
                  "note-textarea h-full w-full resize-none bg-transparent px-6 py-5",
                  "font-mono text-[14px] leading-7 text-[#d8d2ca]",
                  "outline-none placeholder:text-[#3d3830]",
                )}
                spellCheck
              />
            </div>

            {/* ── Footer ── */}
            <div className="flex items-center justify-between border-t border-[#221f1b] bg-[#100e0c] px-4 py-2.5">
              <div className="flex items-center gap-3 font-mono text-[10px] text-[#5c554d]">
                <span className="flex items-center gap-1.5">
                  <HashIcon className="size-2.5" />
                  {wordCount} words · {charCount} chars
                </span>
                {saving && (
                  <span className="text-[#7f6e3e]">Saving…</span>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDelete}
                className={cn(
                  "h-7 rounded-[6px] border-[#3d2020] bg-[#1a1212] text-[11px] text-[#e06b6b]",
                  "hover:border-[#5c2e2e] hover:bg-[#1f1515]",
                )}
              >
                <Trash2Icon className="size-3" />
                Delete
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function IconBtn({
  title,
  onClick,
  Icon,
}: {
  title: string;
  onClick: () => void;
  Icon: React.ElementType;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{ transition: `background-color 150ms ${EASE_OUT}, color 150ms ${EASE_OUT}, transform 160ms ${EASE_OUT}` }}
      className={cn(
        "flex size-7 items-center justify-center rounded-[5px] text-[#5c554d]",
        "hover:bg-[#211e1a] hover:text-[#c8bfb2] transform-gpu",
        "active:scale-[0.92] motion-reduce:active:scale-100",
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}

// Keyboard shortcuts in the editor: Tab indents, Cmd/Ctrl+B wraps **, Cmd/Ctrl+I wraps *
function handleEditorKey(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  body: string,
  setBody: (v: string) => void,
  markDirty: () => void,
) {
  const ta = e.currentTarget;
  const start = ta.selectionStart;
  const end   = ta.selectionEnd;
  const mod   = e.metaKey || e.ctrlKey;

  if (e.key === "Tab") {
    e.preventDefault();
    const next = body.slice(0, start) + "  " + body.slice(end);
    setBody(next);
    markDirty();
    requestAnimationFrame(() => { ta.setSelectionRange(start + 2, start + 2); });
    return;
  }

  if (mod && (e.key === "b" || e.key === "B")) {
    e.preventDefault();
    wrapSelection(ta, body, setBody, markDirty, "**");
    return;
  }
  if (mod && (e.key === "i" || e.key === "I")) {
    e.preventDefault();
    wrapSelection(ta, body, setBody, markDirty, "*");
    return;
  }

  // Auto-continue lists: pressing Enter on a "- " line adds another "- "
  if (e.key === "Enter" && !e.shiftKey && !mod) {
    const lineStart = body.lastIndexOf("\n", start - 1) + 1;
    const line = body.slice(lineStart, start);
    const m = line.match(/^(\s*)([-*]|\d+\.)\s/);
    if (m) {
      e.preventDefault();
      // Empty list item → terminate list
      if (line.trim() === m[2]) {
        const next = body.slice(0, lineStart) + body.slice(start);
        setBody(next);
        markDirty();
        requestAnimationFrame(() => ta.setSelectionRange(lineStart, lineStart));
        return;
      }
      const insert = "\n" + m[1] + m[2] + " ";
      const next = body.slice(0, start) + insert + body.slice(end);
      setBody(next);
      markDirty();
      const pos = start + insert.length;
      requestAnimationFrame(() => ta.setSelectionRange(pos, pos));
    }
  }
}

function wrapSelection(
  ta: HTMLTextAreaElement,
  body: string,
  setBody: (v: string) => void,
  markDirty: () => void,
  wrap: string,
) {
  const start = ta.selectionStart;
  const end   = ta.selectionEnd;
  const sel   = body.slice(start, end);
  const next  = body.slice(0, start) + wrap + sel + wrap + body.slice(end);
  setBody(next);
  markDirty();
  requestAnimationFrame(() => {
    ta.setSelectionRange(start + wrap.length, end + wrap.length);
  });
}
