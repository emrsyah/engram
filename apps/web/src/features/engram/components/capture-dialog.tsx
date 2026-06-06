"use client";

import { Button } from "@alphonse/ui/components/button";
import { Input } from "@alphonse/ui/components/input";
import { cn } from "@alphonse/ui/lib/utils";
import { useEffect, useState } from "react";

import { Icons } from "./icons";
import { useEngramStore } from "../store";
import type { Priority } from "../types";

export function CaptureDialog() {
  const { captureOpen, closeCapture, createItem } = useEngramStore();
  const [mode, setMode] = useState<"thought" | "task">("thought");
  const [text, setText] = useState("");
  const [priority, setPriority] = useState<Priority>(2);
  const [due, setDue] = useState<"none" | "today" | "tomorrow">("none");

  useEffect(() => {
    if (captureOpen) {
      setText("");
      setMode("thought");
      setPriority(2);
      setDue("none");
    }
  }, [captureOpen]);

  if (!captureOpen) {
    return null;
  }

  const commit = () => {
    const value = text.trim();
    if (!value) {
      return;
    }

    createItem({
      type: mode === "task" ? "task" : "thought",
      text: mode === "thought" ? value : undefined,
      title: mode === "task" ? value : undefined,
      priority: mode === "task" ? priority : undefined,
      dueAt: mode === "task" ? dueToIso(due) : undefined,
    });
    closeCapture();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-black/40 pt-[18vh] backdrop-blur-sm">
      <div className="mx-auto w-[min(560px,calc(100vw-32px))] rounded-[8px] border border-[#3b352f] bg-[#211e1a] p-3 shadow-2xl">
        <div className="flex items-center gap-2 border-[#332e28] border-b pb-3">
          <button
            type="button"
            onClick={() => setMode("thought")}
            className={cn(
              "rounded-[6px] px-3 py-1.5 text-sm font-semibold",
              mode === "thought" ? "bg-[#302c27] text-white" : "text-[#9b9388]",
            )}
          >
            Thought
          </button>
          <button
            type="button"
            onClick={() => setMode("task")}
            className={cn(
              "rounded-[6px] px-3 py-1.5 text-sm font-semibold",
              mode === "task" ? "bg-[#302c27] text-white" : "text-[#9b9388]",
            )}
          >
            Task
          </button>
          <Button variant="ghost" size="icon-xs" className="ml-auto" onClick={closeCapture}>
            x
          </Button>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <Icons.sparkles className="size-4 shrink-0 text-[#9b88ff]" />
          <Input
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                commit();
              }
              if (event.key === "Escape") {
                closeCapture();
              }
            }}
            placeholder={mode === "task" ? "Type a task" : "Type a thought"}
            className="h-11 border-0 bg-transparent text-base text-white placeholder:text-[#7f776d] focus-visible:ring-0"
          />
        </div>

        {mode === "task" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 pl-7">
            {[1, 2, 3].map((candidate) => (
              <button
                type="button"
                key={candidate}
                onClick={() => setPriority(candidate as Priority)}
                className={cn(
                  "rounded-[6px] px-3 py-1.5 font-bold text-xs",
                  priority === candidate
                    ? "bg-[#4b3d21] text-[#e5b83d]"
                    : "bg-[#2a2621] text-[#8d857b]",
                )}
              >
                P{candidate}
              </button>
            ))}
            {(["none", "today", "tomorrow"] as const).map((candidate) => (
              <button
                type="button"
                key={candidate}
                onClick={() => setDue(candidate)}
                className={cn(
                  "rounded-[6px] px-3 py-1.5 font-bold text-xs capitalize",
                  due === candidate ? "bg-[#302b20] text-[#e0ad3b]" : "bg-[#2a2621] text-[#8d857b]",
                )}
              >
                {candidate}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between pl-7 text-[#7f776d] text-xs">
          <span>Enter commits / Esc closes</span>
          <Button onClick={commit} className="rounded-[7px] bg-[#907ce8] text-[#17131f]">
            Capture
          </Button>
        </div>
      </div>
    </div>
  );
}

function dueToIso(due: "none" | "today" | "tomorrow") {
  if (due === "none") {
    return undefined;
  }

  return due === "today" ? "2026-06-06T14:00:00.000Z" : "2026-06-07T10:00:00.000Z";
}
