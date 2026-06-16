"use client";

import { ScrollArea } from "@alphonse/ui/components/scroll-area";
import { Textarea } from "@alphonse/ui/components/textarea";
import { Hash } from "./icons";
import { useRef } from "react";

import { SaveStateIndicator, useDailyNote } from "./use-daily-note";

export function FocusScratchpadInline() {
	const { value, saveState, handleChange, handleKeyDown, wordCount, lineCount } = useDailyNote();
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const today = new Date().toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
	});

	return (
		<div className="flex h-full flex-col">
			{/* ── Header ── */}
			<div className="shrink-0 border-line-soft border-b px-4 py-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span className="font-bold text-white text-xs uppercase tracking-widest">
							Today's Note
						</span>
						<SaveStateIndicator state={saveState} />
					</div>
				</div>
				<p className="mt-1 text-ink-faint text-[11px]">{today}</p>
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
						className="w-full resize-none border-0 bg-transparent text-ink-2 text-sm leading-relaxed placeholder:text-line-strong placeholder:leading-relaxed focus-visible:ring-0"
						spellCheck
					/>
				</div>
			</ScrollArea>

			{/* ── Footer ── */}
			<div className="shrink-0 border-line-soft border-t px-4 py-2">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3 font-mono text-line-max text-[10px]">
						<span className="flex items-center gap-1">
							<Hash className="size-2.5" />
							{wordCount} {wordCount === 1 ? "word" : "words"}
						</span>
						<span>
							{lineCount} {lineCount === 1 ? "line" : "lines"}
						</span>
					</div>
					<span className="text-line-strong text-[10px]">Auto-saved</span>
				</div>
			</div>
		</div>
	);
}
