"use client";

import { Button } from "@alphonse/ui/components/button";
import { cn } from "@alphonse/ui/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
	highlightSegments,
	parseCapture,
	type Segment,
} from "../capture-grammar";
import { SPACE_ICONS, type SpaceIconKey } from "../nav";
import { useEngramStore } from "../store";
import type { Priority, Space } from "../types";
import { DueChip, PriorityChip, SomedayChip, TagChip } from "./chips";
import { Icons } from "./icons";

const SAMPLE_TEXT = "Follow up with design tomorrow 3pm #client !p2 ~Work";

const SEGMENT_CLASS: Record<Segment["kind"], string> = {
	plain: "text-[#f3eee7]",
	priority: "rounded-[3px] bg-amber-400/15 text-amber-300",
	tag: "rounded-[3px] bg-sky-400/15 text-sky-300",
	date: "rounded-[3px] bg-emerald-400/15 text-emerald-300",
	mention: "rounded-[3px] bg-violet-400/20 text-violet-300",
	space: "rounded-[3px] bg-teal-400/15 text-teal-300",
};

type ParsedLine = {
	id: string;
	raw: string;
	title: string;
	priority?: Priority;
	dueAt?: string;
	tags: string[];
	someday?: boolean;
	space?: Space;
};

function toDateInputValue(date: Date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function normalizeSpaceName(value: string) {
	return value.toLowerCase().replace(/[\s_-]+/g, "");
}

function resolveSpace(raw: string, spaces: Space[]) {
	const match = raw.match(/(?:^|\s)~(\S+)/);
	if (!match) return { clean: raw, space: undefined };

	const query = normalizeSpaceName(match[1]);
	const space = spaces.find((candidate) =>
		normalizeSpaceName(candidate.name).startsWith(query),
	);
	const clean = raw.replace(match[0], match[0].startsWith(" ") ? " " : "");
	return { clean, space };
}

function parseLine(
	raw: string,
	index: number,
	spaces: Space[],
): ParsedLine | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;

	const resolved = resolveSpace(trimmed, spaces);
	const parsed = parseCapture(resolved.clean);
	const title = parsed.cleanText.trim();
	if (!title) return null;

	return {
		id: `${index}-${trimmed}`,
		raw,
		title,
		priority: parsed.priority,
		dueAt: parsed.dueDate
			? parsed.dueHasTime
				? parsed.dueDate.toISOString()
				: toDateInputValue(parsed.dueDate)
			: undefined,
		tags: parsed.tags,
		someday: !parsed.dueDate && parsed.someday ? true : undefined,
		space: resolved.space,
	};
}

function lineIndexAt(value: string, caret: number) {
	return value.slice(0, caret).split("\n").length - 1;
}

export function CapturePage() {
	const { createItem, spaces } = useEngramStore();
	const [value, setValue] = useState("");
	const [caret, setCaret] = useState(0);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const sortedSpaces = useMemo(
		() => [...spaces].sort((a, b) => a.sortOrder - b.sortOrder),
		[spaces],
	);
	const lines = value.split("\n");
	const parsedLines = useMemo(
		() =>
			lines
				.map((line, index) => parseLine(line, index, sortedSpaces))
				.filter(Boolean) as ParsedLine[],
		[lines, sortedSpaces],
	);
	const activeLine = parseLine(
		lines[lineIndexAt(value, caret)] ?? "",
		lineIndexAt(value, caret),
		sortedSpaces,
	);
	const segments = highlightSegments(value, ["priority", "tag", "date"], true);

	useEffect(() => {
		textareaRef.current?.focus();
	}, []);

	const saveAll = () => {
		if (parsedLines.length === 0) return;

		for (const line of parsedLines) {
			createItem({
				type: "task",
				title: line.title,
				priority: line.priority,
				dueAt: line.dueAt,
				tags: line.tags.length > 0 ? line.tags : undefined,
				someday: line.someday,
				spaceId: line.space?.id,
				inbox: line.space ? undefined : true,
				stayOnCurrentView: true,
			});
		}

		toast.success(
			`Captured ${parsedLines.length} task${parsedLines.length === 1 ? "" : "s"}`,
		);
		setValue("");
		requestAnimationFrame(() => textareaRef.current?.focus());
	};

	return (
		<section className="h-full overflow-y-auto bg-[#151310] px-6 py-8 text-white md:px-12 lg:px-20">
			<div className="mx-auto grid max-w-[1180px] gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
				<div className="min-w-0">
					<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
						<div>
							<h2 className="flex items-center gap-3 font-bold text-3xl">
								<Icons.sparkles className="size-7 text-[#9b88ff]" />
								Capture
							</h2>
							<p className="mt-3 max-w-2xl text-[#b0a69a]">
								Write one task per line. Dates, tags, priority, and spaces are
								detected as you type.
							</p>
						</div>

						<Button
							type="button"
							disabled={parsedLines.length === 0}
							onClick={saveAll}
							className="h-10 gap-2 rounded-[8px] bg-[#907ce8] px-4 font-bold text-[#17131f] hover:bg-[#a08ef2] disabled:opacity-35"
						>
							<Icons.plus className="size-4" />
							Save {parsedLines.length > 0 ? parsedLines.length : ""}
						</Button>
					</div>

					<div className="mt-8 overflow-hidden rounded-[12px] border border-[#2d2823] bg-[#1b1815] shadow-2xl shadow-black/20">
						<div className="flex items-center justify-between border-[#29241f] border-b px-4 py-3">
							<div className="flex items-center gap-2 text-[#8d857b] text-sm">
								<Icons.square className="size-4 text-amber-300" />
								Task sheet
							</div>
							<button
								type="button"
								onClick={() => {
									setValue(SAMPLE_TEXT);
									requestAnimationFrame(() => textareaRef.current?.focus());
								}}
								className="rounded-[6px] px-2 py-1 text-[#6f685f] text-xs hover:bg-[#24201c] hover:text-[#c8bfb2]"
							>
								Insert example
							</button>
						</div>

						<div className="relative min-h-[520px]">
							<div
								aria-hidden
								className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words px-6 py-5 font-mono text-[15px] leading-7"
							>
								{segments.length === 0 ? (
									<span className="text-[#5f574f]">
										Plan launch tomorrow #work !p2 ~Ops
									</span>
								) : (
									segments.map((segment, index) => (
										<span
											key={`${index}-${segment.kind}`}
											className={SEGMENT_CLASS[segment.kind]}
										>
											{segment.text}
										</span>
									))
								)}
							</div>
							<textarea
								ref={textareaRef}
								value={value}
								onChange={(event) => {
									setValue(event.target.value);
									setCaret(event.target.selectionStart);
								}}
								onSelect={(event) =>
									setCaret(event.currentTarget.selectionStart)
								}
								onKeyUp={(event) =>
									setCaret(event.currentTarget.selectionStart)
								}
								onKeyDown={(event) => {
									if (
										(event.metaKey || event.ctrlKey) &&
										event.key === "Enter"
									) {
										event.preventDefault();
										saveAll();
									}
								}}
								spellCheck={false}
								placeholder="Plan launch tomorrow #work !p2 ~Ops"
								className={cn(
									"relative min-h-[520px] w-full resize-y bg-transparent px-6 py-5 font-mono text-[15px] leading-7",
									"text-transparent caret-white outline-none placeholder:text-transparent",
								)}
							/>
						</div>
					</div>
				</div>

				<aside className="space-y-4">
					<div className="rounded-[12px] border border-[#2d2823] bg-[#1b1815] p-4">
						<div className="mb-3 flex items-center gap-2 font-semibold text-[#f0ebe3] text-sm">
							<Icons.clock className="size-4 text-emerald-300" />
							Current line
						</div>

						{activeLine ? (
							<PreviewLine line={activeLine} />
						) : (
							<p className="text-[#7d746a] text-sm">
								Move the cursor onto a task line to inspect it.
							</p>
						)}
					</div>

					<div className="rounded-[12px] border border-[#2d2823] bg-[#1b1815] p-4">
						<div className="mb-3 flex items-center justify-between">
							<span className="font-semibold text-[#f0ebe3] text-sm">
								Batch preview
							</span>
							<span className="rounded-[5px] bg-[#25211d] px-2 py-0.5 font-mono text-[#82786e] text-xs">
								{parsedLines.length}
							</span>
						</div>
						<div className="max-h-[410px] space-y-2 overflow-y-auto pr-1">
							{parsedLines.length > 0 ? (
								parsedLines.map((line) => (
									<PreviewLine key={line.id} line={line} compact />
								))
							) : (
								<p className="text-[#7d746a] text-sm">
									Detected tasks will appear here.
								</p>
							)}
						</div>
					</div>
				</aside>
			</div>
		</section>
	);
}

function PreviewLine({
	line,
	compact,
}: {
	line: ParsedLine;
	compact?: boolean;
}) {
	const SpaceIcon = line.space
		? Icons[
				SPACE_ICONS[
					(line.space.icon in SPACE_ICONS
						? line.space.icon
						: "sparkles") as SpaceIconKey
				]
			]
		: Icons.inbox;

	return (
		<div
			className={cn(
				"rounded-[8px] border border-[#29241f] bg-[#161310]",
				compact ? "p-3" : "p-4",
			)}
		>
			<div className="flex min-w-0 items-start gap-2">
				<Icons.square className="mt-0.5 size-4 shrink-0 text-amber-300" />
				<p className="min-w-0 flex-1 break-words font-semibold text-[#f0ebe3] text-sm">
					{line.title}
				</p>
			</div>
			<div className="mt-3 flex flex-wrap items-center gap-1.5 pl-6">
				<PriorityChip priority={line.priority} />
				<DueChip dueAt={line.dueAt} />
				{line.someday && <SomedayChip />}
				{line.tags.map((tag) => (
					<TagChip key={tag} tag={tag} />
				))}
				<span className="inline-flex h-6 items-center gap-1.5 rounded-[5px] bg-[#1b2927] px-2 font-semibold text-[#62c8b9] text-[11px]">
					<SpaceIcon className="size-3.5" />
					{line.space?.name ?? "Inbox"}
				</span>
			</div>
		</div>
	);
}
