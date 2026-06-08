"use client";

import { Badge } from "@alphonse/ui/components/badge";
import { Button } from "@alphonse/ui/components/button";
import { ScrollArea } from "@alphonse/ui/components/scroll-area";
import { Textarea } from "@alphonse/ui/components/textarea";
import { cn } from "@alphonse/ui/lib/utils";
import { Hash, Save } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { todayPrefix } from "../projections";
import { useEngramStore } from "../store";

type SaveState = "idle" | "saving" | "saved";

export function FocusScratchpadInline() {
	const { items, upsertDailyNote } = useEngramStore();
	const prefix = todayPrefix();
	const noteTitle = `Daily Note — ${prefix}`;
	const existing = items.find(
		(item) => item.type === "thought" && item.title === noteTitle,
	);
	const [value, setValue] = useState(existing?.text ?? "");
	const [saveState, setSaveState] = useState<SaveState>("idle");
	const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const saveStateTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		textareaRef.current?.focus();
	}, []);

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLTextAreaElement>) => {
			setValue(e.target.value);
			setSaveState("idle");
			clearTimeout(saveTimer.current);
			saveTimer.current = setTimeout(() => {
				upsertDailyNote(e.target.value);
				setSaveState("saving");
				clearTimeout(saveStateTimer.current);
				saveStateTimer.current = setTimeout(
					() => setSaveState("saved"),
					200,
				);
				saveStateTimer.current = setTimeout(
					() => setSaveState("idle"),
					2200,
				);
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

			// Bold: Cmd+B
			if (mod && (e.key === "b" || e.key === "B")) {
				e.preventDefault();
				wrapSelection(ta, value, setValue, "**");
				return;
			}
			// Italic: Cmd+I
			if (mod && (e.key === "i" || e.key === "I")) {
				e.preventDefault();
				wrapSelection(ta, value, setValue, "*");
				return;
			}
			// Tab indent
			if (e.key === "Tab") {
				e.preventDefault();
				const next = value.slice(0, start) + "  " + value.slice(end);
				setValue(next);
				requestAnimationFrame(() =>
					ta.setSelectionRange(start + 2, start + 2),
				);
				return;
			}
			// Auto-continue lists
			if (e.key === "Enter" && !e.shiftKey && !mod) {
				const lineStart = value.lastIndexOf("\n", start - 1) + 1;
				const line = value.slice(lineStart, start);
				const m = line.match(/^(\s*)([-*]|\d+\.)\s/);
				if (m) {
					e.preventDefault();
					if (line.trim() === m[2]) {
						const next = value.slice(0, lineStart) + value.slice(start);
						setValue(next);
						requestAnimationFrame(() =>
							ta.setSelectionRange(lineStart, lineStart),
						);
						return;
					}
					const insert = "\n" + m[1] + m[2] + " ";
					const next =
						value.slice(0, start) + insert + value.slice(end);
					setValue(next);
					const pos = start + insert.length;
					requestAnimationFrame(() =>
						ta.setSelectionRange(pos, pos),
					);
				}
			}
		},
		[value],
	);

	const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
	const lineCount = value ? value.split("\n").length : 0;

	const today = new Date().toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
	});

	return (
		<div className="flex h-full flex-col">
			{/* ── Header ── */}
			<div className="shrink-0 border-[#2e2b26] border-b px-4 py-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span className="font-bold text-white text-xs uppercase tracking-widest">
							Today's Note
						</span>
						<SaveStateIndicator state={saveState} />
					</div>
				</div>
				<p className="mt-1 text-[#6b6560] text-[11px]">{today}</p>
			</div>

			{/* ── Editor ── */}
			<ScrollArea className="flex-1">
				<div className="px-4 py-3">
					<Textarea
						ref={textareaRef}
						value={value}
						onChange={handleChange}
						onKeyDown={handleKeyDown}
						placeholder={
							"Start writing…\n\n· What's the intention for today?\n· Key thoughts or reflections\n· Quick capture anything on your mind\n\n⌘+B bold · ⌘+I italic · Tab indents"
						}
						rows={12}
						className="w-full resize-none border-0 bg-transparent text-[#d4ccc4] text-sm leading-relaxed placeholder:text-[#3d3830] placeholder:leading-relaxed focus-visible:ring-0"
						spellCheck
					/>
				</div>
			</ScrollArea>

			{/* ── Footer ── */}
			<div className="shrink-0 border-[#2e2b26] border-t px-4 py-2">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3 font-mono text-[#4a4540] text-[10px]">
						<span className="flex items-center gap-1">
							<Hash className="size-2.5" />
							{wordCount} {wordCount === 1 ? "word" : "words"}
						</span>
						<span>
							{lineCount} {lineCount === 1 ? "line" : "lines"}
						</span>
					</div>
					<span className="text-[#3d3830] text-[10px]">
						Auto-saved
					</span>
				</div>
			</div>
		</div>
	);
}

function SaveStateIndicator({ state }: { state: SaveState }) {
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		if (state !== "idle") {
			setVisible(true);
		} else {
			const t = setTimeout(() => setVisible(false), 300);
			return () => clearTimeout(t);
		}
	}, [state]);

	if (!visible && state === "idle") return null;

	return (
		<Badge
			variant="secondary"
			className={cn(
				"h-4 gap-1 rounded-[4px] px-1.5 font-mono text-[9px] transition-opacity duration-200",
				state === "idle" ? "opacity-0" : "opacity-100",
				state === "saving"
					? "bg-[#3a3327] text-[#d6a93a]"
					: "bg-[#1a2e2a] text-[#43b6a6]",
			)}
		>
			<Save className="size-2" />
			{state === "saving" ? "Saving…" : "Saved"}
		</Badge>
	);
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
	requestAnimationFrame(() =>
		ta.setSelectionRange(start + wrap.length, end + wrap.length),
	);
}
