"use client";

import { Button } from "@alphonse/ui/components/button";
import { Textarea } from "@alphonse/ui/components/textarea";
import { Hash, CancelIcon as X } from "./icons";
import { useEffect, useRef } from "react";

import { SaveStateIndicator, useDailyNote } from "./use-daily-note";

export function FocusScratchpadPanel({ onClose }: { onClose: () => void }) {
	const { value, saveState, handleChange, handleKeyDown, wordCount, lineCount } = useDailyNote();
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		textareaRef.current?.focus();
	}, []);

	const today = new Date().toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
	});

	return (
		<div className="absolute top-[calc(100%+8px)] right-0 z-50 w-[380px] rounded-[12px] border border-line-soft bg-panel shadow-2xl">
			<div className="flex items-center justify-between border-line-soft border-b px-4 py-3">
				<div className="flex items-center gap-2">
					<span className="font-bold text-white text-xs uppercase tracking-widest">
						Today's Note
					</span>
					<SaveStateIndicator state={saveState} />
				</div>
				<Button
					variant="ghost"
					size="icon-xs"
					onClick={onClose}
					className="size-6 text-ink-faint hover:text-white"
				>
					<X className="size-3.5" />
				</Button>
			</div>
			<p className="px-4 pt-2 text-ink-faint text-[11px]">{today}</p>
			<div className="px-4 py-3">
				<Textarea
					ref={textareaRef}
					value={value}
					onChange={handleChange}
					onKeyDown={handleKeyDown}
					placeholder={
						"Start writing…\n\n· Intention for today\n· Quick thoughts\n· Anything on your mind\n\n⌘+B bold · ⌘+I italic"
					}
					rows={8}
					className="w-full resize-none border-0 bg-transparent text-ink-2 text-sm leading-relaxed placeholder:text-line-strong placeholder:leading-relaxed focus-visible:ring-0"
					spellCheck
				/>
			</div>
			<div className="flex items-center justify-between border-line-soft border-t px-4 py-2">
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
	);
}
