"use client";

import { Button } from "@alphonse/ui/components/button";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { todayPrefix } from "../projections";
import { useEngramStore } from "../store";

export function FocusScratchpadPanel({ onClose }: { onClose: () => void }) {
	const { items, upsertDailyNote } = useEngramStore();
	const prefix = todayPrefix();
	const noteTitle = `Daily Note — ${prefix}`;
	const existing = items.find(
		(item) => item.type === "thought" && item.title === noteTitle,
	);
	const [value, setValue] = useState(existing?.text ?? "");
	const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		textareaRef.current?.focus();
	}, []);

	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setValue(e.target.value);
		clearTimeout(saveTimer.current);
		saveTimer.current = setTimeout(() => upsertDailyNote(e.target.value), 600);
	};

	const today = new Date().toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
	});

	return (
		<div className="absolute top-[calc(100%+8px)] right-0 z-50 w-[360px] rounded-[12px] border border-[#2e2b26] bg-[#1a1714] shadow-2xl">
			<div className="flex items-center justify-between border-[#2e2b26] border-b px-4 py-3">
				<div>
					<span className="font-bold text-white text-xs uppercase tracking-widest">
						Today's Note
					</span>
					<p className="mt-0.5 text-[#6b6560] text-[11px]">{today}</p>
				</div>
				<Button
					variant="ghost"
					size="icon-xs"
					onClick={onClose}
					className="size-6 text-[#706a62] hover:text-white"
				>
					<X className="size-3.5" />
				</Button>
			</div>
			<div className="px-4 py-3">
				<textarea
					ref={textareaRef}
					value={value}
					onChange={handleChange}
					placeholder="Intention for today, quick thoughts, anything…"
					rows={8}
					className="w-full resize-none bg-transparent text-[#d4ccc4] text-sm placeholder:text-[#4a4540] focus:outline-none"
				/>
			</div>
			<div className="border-[#2e2b26] border-t px-4 py-2">
				<p className="text-[#4a4540] text-[11px]">
					Auto-saved as a thought node
				</p>
			</div>
		</div>
	);
}
