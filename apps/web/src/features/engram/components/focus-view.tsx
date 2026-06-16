"use client";

import { Button } from "@alphonse/ui/components/button";
import { Checkbox } from "@alphonse/ui/components/checkbox";
import { cn } from "@alphonse/ui/lib/utils";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { todayPrefix } from "../projections";
import { useEngramStore } from "../store";
import { useUIStore } from "../ui-store";
import type { DailyBriefing, FocusTier, Item } from "../types";
import { DueChip, PriorityChip } from "./chips";
import {
	ArrowUpRightIcon,
	CheckmarkIcon as Check,
	ChevronDown,
	ChevronRight,
	ClockIcon,
	Loader,
	PinOff,
	PlusIcon as Plus,
	Sparkles,
	Icons,
} from "./icons";

type BriefingStatus = "idle" | "loading";

type BriefingTask = {
	id: string;
	title: string;
	priority?: number;
	dueAt?: string;
	done?: boolean;
};

function asBriefingTask(task: Item): BriefingTask {
	return {
		id: task.id,
		title: task.title ?? task.text ?? "Untitled task",
		priority: task.priority,
		dueAt: task.dueAt,
		done: task.done,
	};
}

export function FocusView() {
	const {
		items,
		dailyBriefings,
		focusBuckets,
		overdueNotPinnedTasks,
		todayUnpinnedTasks,
		toggleDone,
		pinToFocus,
		unpinFromFocus,
		setFocusTier,
		reorderFocusPlan,
		saveDailyBriefing,
		jumpToItem,
	} = useEngramStore();
	const { expandQuickCapture } = useUIStore();

	const prefix = todayPrefix();
	const [briefingStatus, setBriefingStatus] = useState<BriefingStatus>("idle");
	const [briefingOpen, setBriefingOpen] = useState(true);
	const [attentionOpen, setAttentionOpen] = useState(true);
	const [doneOpen, setDoneOpen] = useState(false);

	const { top: topItems, backlog: backlogItems, done: doneItems, pending: pendingFocusItems, legacy: legacyPinnedItems } =
		focusBuckets;

	const doneCount = doneItems.length;
	const todaysCount = doneItems.length + pendingFocusItems.length;
	const briefing = dailyBriefings?.[prefix];
	const noteExcerpt =
		items.find((item) => item.type === "thought" && item.title?.startsWith("Daily Note") && item.title.includes(prefix))?.text ??
		"";

	const todayLabel = new Date().toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
	});

	const orderedIds = pendingFocusItems.map((item) => item.id);
	const moveTask = useCallback(
		(taskId: string, direction: -1 | 1) => {
			const current = orderedIds.indexOf(taskId);
			const next = current + direction;
			if (current < 0 || next < 0 || next >= orderedIds.length) return;
			const copy = [...orderedIds];
			const [id] = copy.splice(current, 1);
			copy.splice(next, 0, id);
			reorderFocusPlan(copy);
		},
		[orderedIds, reorderFocusPlan],
	);

	const addExistingToFocus = (task: Item, tier: FocusTier) => {
		pinToFocus(task.id);
		setFocusTier(task.id, tier);
	};

	const captureFocusTask = () => expandQuickCapture("task", "focus-task");

	const generateBriefing = async () => {
		setBriefingStatus("loading");
		try {
			const response = await fetch("/api/focus/briefing", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					date: prefix,
					topTasks: topItems.map(asBriefingTask),
					backlogTasks: backlogItems.map(asBriefingTask),
					overdueTasks: overdueNotPinnedTasks.map(asBriefingTask),
					dueTodayTasks: todayUnpinnedTasks.map(asBriefingTask),
					noteExcerpt: noteExcerpt.slice(0, 2000),
				}),
			});
			const data = (await response.json()) as Partial<DailyBriefing> & { error?: string };
			if (!response.ok || data.error) {
				throw new Error(data.error ?? "Could not generate briefing.");
			}
			if (
				!data.date ||
				!data.headline ||
				!data.summary ||
				!data.generatedAt ||
				!Array.isArray(data.topThreeRationale) ||
				!Array.isArray(data.risks) ||
				!Array.isArray(data.suggestedAdjustments)
			) {
				throw new Error("Briefing response was incomplete.");
			}
			saveDailyBriefing(data as DailyBriefing);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not generate briefing.");
		} finally {
			setBriefingStatus("idle");
		}
	};

	return (
		<section className="relative h-full overflow-y-auto bg-[#151310] text-[#f4eee7]">
			<div className="mx-auto min-h-full w-full max-w-[980px] px-6 py-10 md:px-10 lg:py-14">
				<header className="mb-10">
					<div className="mb-4 flex flex-wrap items-end justify-between gap-5">
						<div>
							<h2
								className="stagger-item flex items-center gap-3 font-bold text-3xl"
								style={{ animationDelay: "0ms" }}
							>
								<Icons.target className="size-7 text-[#907ce8]" />
								Focus
							</h2>
							<p
								className="stagger-item mt-3 max-w-2xl text-[#b0a69a]"
								style={{ animationDelay: "40ms" }}
							>
								{todayLabel} — plan your top three and stay on track.
							</p>
						</div>
						<span className="shrink-0 rounded-[6px] border border-[#302c27] bg-[#211e1a] px-2.5 py-1 font-mono text-[#9f9588] text-xs">
							{topItems.length} top · {backlogItems.length} backlog
						</span>
					</div>
					{todaysCount > 0 ? (
						<div className="h-px w-full bg-[#302a24]">
							<div
								className="h-px bg-[#907ce8] transition-transform duration-500"
								style={{
									transform: `scaleX(${doneCount / todaysCount})`,
									transformOrigin: "left",
								}}
							/>
						</div>
					) : null}
				</header>

				<div className="space-y-11">
					<DailyBriefingCard
						briefing={briefing}
						status={briefingStatus}
						open={briefingOpen}
						onOpenChange={setBriefingOpen}
						onGenerate={generateBriefing}
						canRegenerate={Boolean(briefing)}
					/>

					<FocusSection
						title="Top 3"
						description="Pinned for the next deep-work block"
						items={topItems}
						empty="Move one task here when you know what matters first."
						tone="top"
						onToggle={toggleDone}
						onUnpin={unpinFromFocus}
						onMove={moveTask}
						onSetTier={setFocusTier}
						onJump={jumpToItem}
					/>

					<CaptureFocusTask onCapture={captureFocusTask} />

					<AttentionCluster
						attentionOpen={attentionOpen}
						onToggleOpen={() => setAttentionOpen((value) => !value)}
						overdueTasks={overdueNotPinnedTasks}
						todayTasks={todayUnpinnedTasks}
						legacyPinnedItems={legacyPinnedItems}
						onAdd={addExistingToFocus}
						onJump={jumpToItem}
					/>

					<FocusSection
						title="Backlog"
						description="Selected for today, not competing with the top three"
						items={backlogItems}
						empty="Keep this short. Add only tasks worth seeing today."
						tone="backlog"
						onToggle={toggleDone}
						onUnpin={unpinFromFocus}
						onMove={moveTask}
						onSetTier={setFocusTier}
						onJump={jumpToItem}
					/>

					<DoneSection
						open={doneOpen}
						onOpenChange={setDoneOpen}
						items={doneItems}
						onToggle={toggleDone}
						onJump={jumpToItem}
					/>
				</div>
			</div>
		</section>
	);
}

function CaptureFocusTask({ onCapture }: { onCapture: () => void }) {
	return (
		<section className="rounded-[10px] border border-[#2e2b26] border-dashed px-4 py-3">
			<button
				type="button"
				onClick={onCapture}
				className="flex w-full items-center justify-center gap-2 text-[#82786e] text-sm transition-colors hover:text-[#c4b5fd]"
			>
				<Plus className="size-4" />
				Capture focus task
			</button>
		</section>
	);
}

function DoneSection({
	open,
	onOpenChange,
	items,
	onToggle,
	onJump,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	items: Item[];
	onToggle: (id: string) => void;
	onJump: (id: string) => void;
}) {
	return (
		<section className="border-[#252220] border-t pt-5">
			<button
				type="button"
				onClick={() => onOpenChange(!open)}
				className="flex w-full items-center justify-between gap-4 text-left"
			>
				<div>
					<p className="flex items-center gap-2 font-bold text-[#746a60] text-[11px] uppercase tracking-[0.24em]">
						<Check className="size-3.5" />
						Done Today
					</p>
					<p className="mt-1 text-[#5f5750] text-xs">
						Clears automatically at 23:59.
					</p>
				</div>
				<span className="flex items-center gap-2 font-mono text-[#5f564d] text-xs">
					{items.length}
					{open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
				</span>
			</button>
			{open ? (
				items.length > 0 ? (
					<div className="mt-3 space-y-2">
						{items.map((task) => (
							<div
								key={task.id}
								className="flex items-center gap-3 rounded-[10px] border border-[#252220] bg-[#171411] px-4 py-3 opacity-65"
							>
								<Checkbox
									checked={task.done}
									onCheckedChange={() => onToggle(task.id)}
									className="rounded-full border-[#5f5750] data-[state=checked]:border-[#746a60] data-[state=checked]:bg-[#746a60]"
								/>
								<button type="button" onClick={() => onJump(task.id)} className="min-w-0 flex-1 text-left">
									<span className="block truncate text-[#8a8378] text-sm line-through">
										{task.title ?? task.text ?? "Untitled task"}
									</span>
								</button>
								<span className="font-mono text-[#4f4943] text-[10px]">23:59</span>
							</div>
						))}
					</div>
				) : (
					<p className="mt-3 rounded-[10px] border border-[#2e2b26] border-dashed px-4 py-3 text-[#5f5750] text-sm">
						No completed focus tasks yet.
					</p>
				)
			) : null}
		</section>
	);
}

function DailyBriefingCard({
	briefing,
	status,
	open,
	onOpenChange,
	onGenerate,
	canRegenerate,
}: {
	briefing?: DailyBriefing;
	status: BriefingStatus;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onGenerate: () => void;
	canRegenerate: boolean;
}) {
	const loading = status === "loading";
	return (
		<section className="rounded-[14px] border border-[#3a3327] bg-[#201c16] px-7 py-6 shadow-[0_18px_70px_rgba(0,0,0,0.18)]">
			<div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", open && "mb-4")}>
				<button type="button" onClick={() => onOpenChange(!open)} className="min-w-0 text-left">
					<span className="flex items-center gap-2 font-bold text-[#d9a82f] text-[11px] uppercase tracking-[0.22em]">
						{open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
						<Sparkles className="size-3.5" />
						<span>Daily Briefing</span>
					</span>
					{briefing ? (
						<p className="mt-2 text-[#746a60] text-xs">
							Generated {new Date(briefing.generatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
						</p>
					) : null}
				</button>
				<Button
					type="button"
					size="sm"
					onClick={onGenerate}
					disabled={loading}
					className="h-8 rounded-[7px] bg-[#d9a82f] px-3 font-semibold text-[#1d1608] hover:bg-[#e5b83d]"
				>
					{loading ? <Loader className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
					{canRegenerate ? "Regenerate" : "Generate"}
				</Button>
			</div>
			{!open ? null : briefing ? (
				<div className="space-y-5">
					<div>
						<h2 className="font-semibold text-[#f2eadf] text-2xl leading-snug">{briefing.headline}</h2>
						<p className="mt-3 max-w-[74ch] text-[#c7bcb0] text-base leading-7">{briefing.summary}</p>
					</div>
					<div className="grid gap-5 border-[#342d26] border-t pt-5 md:grid-cols-2">
						<BriefingList title="Why these three" items={briefing.topThreeRationale} />
						<BriefingList title="Watch" items={briefing.risks} />
					</div>
				</div>
			) : (
				<div className="grid gap-4 py-2 md:grid-cols-[minmax(0,1fr)_260px] md:items-end">
					<div>
						<p className="text-[#c7bcb0] text-xl leading-8">
							Start the day with a generated read of what matters, what is waiting,
							and what might slip.
						</p>
						<div className="mt-5 grid gap-2 sm:grid-cols-3">
							<BriefingSource label="Top tasks" value="Priority" />
							<BriefingSource label="Backlog" value="Capacity" />
							<BriefingSource label="Due work" value="Risk" />
						</div>
					</div>
					<div className="rounded-[10px] border border-[#342d26] bg-[#181511] px-4 py-3">
						<p className="font-bold text-[#81776d] text-[11px] uppercase tracking-[0.18em]">Output</p>
						<ul className="mt-3 space-y-2 text-[#8f857a] text-sm">
							<li className="flex gap-2">
								<Check className="mt-0.5 size-3.5 shrink-0 text-[#70675e]" />
								A short headline
							</li>
							<li className="flex gap-2">
								<Check className="mt-0.5 size-3.5 shrink-0 text-[#70675e]" />
								Why the top three matter
							</li>
							<li className="flex gap-2">
								<Check className="mt-0.5 size-3.5 shrink-0 text-[#70675e]" />
								Risks to watch today
							</li>
						</ul>
					</div>
				</div>
			)}
		</section>
	);
}

function BriefingSource({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-[9px] border border-[#342d26] bg-[#181511] px-3 py-2.5">
			<p className="font-mono text-[#5f5750] text-[10px] uppercase tracking-[0.14em]">{label}</p>
			<p className="mt-1 font-semibold text-[#b8aea3] text-sm">{value}</p>
		</div>
	);
}

function BriefingList({ title, items }: { title: string; items: string[] }) {
	return (
		<div>
			<p className="mb-3 font-bold text-[#81776d] text-[11px] uppercase tracking-[0.2em]">{title}</p>
			{items.length > 0 ? (
				<ul className="space-y-2">
					{items.map((item, index) => (
						<li key={`${item}-${index}`} className="flex gap-2.5 text-[#b8aea3] text-sm leading-6">
							<Check className="mt-1 size-3.5 shrink-0 text-[#62b68d]" />
							<span>{item}</span>
						</li>
					))}
				</ul>
			) : (
				<p className="text-[#5f5750] text-sm">No notes.</p>
			)}
		</div>
	);
}

function FocusSection({
	title,
	description,
	items,
	empty,
	tone,
	onToggle,
	onUnpin,
	onMove,
	onSetTier,
	onJump,
}: {
	title: string;
	description: string;
	items: Item[];
	empty: string;
	tone: "top" | "backlog";
	onToggle: (id: string) => void;
	onUnpin: (id: string) => void;
	onMove: (id: string, direction: -1 | 1) => void;
	onSetTier: (id: string, tier: FocusTier) => void;
	onJump: (id: string) => void;
}) {
	return (
		<section>
			<div className="mb-3 flex items-end justify-between gap-4">
				<div>
					<p
						className={cn(
							"font-bold text-[11px] uppercase tracking-[0.24em]",
							tone === "top" ? "text-[#8d8276]" : "text-[#746a60]",
						)}
					>
						{title}
					</p>
					<p className="mt-1 text-[#6d6259] text-xs">{description}</p>
				</div>
				<span className="font-mono text-[#5f564d] text-xs">{items.length}</span>
			</div>
			<div className="space-y-2">
				{items.length > 0
					? items.map((task, index) => (
						<FocusTaskRow
							key={task.id}
							task={task}
							index={index}
							tone={tone}
							onToggle={onToggle}
							onUnpin={onUnpin}
							onMove={onMove}
							onSetTier={onSetTier}
							onJump={onJump}
						/>
					))
					: (
					<div className="rounded-[10px] border border-[#2e2b26] border-dashed px-5 py-7 text-[#6f675f] text-sm">
						{empty}
					</div>
				)}
			</div>
		</section>
	);
}

function FocusTaskRow({
	task,
	index,
	tone,
	onToggle,
	onUnpin,
	onMove,
	onSetTier,
	onJump,
}: {
	task: Item;
	index: number;
	tone: "top" | "backlog";
	onToggle: (id: string) => void;
	onUnpin: (id: string) => void;
	onMove: (id: string, direction: -1 | 1) => void;
	onSetTier: (id: string, tier: FocusTier) => void;
	onJump: (id: string) => void;
}) {
	return (
		<div
			className={cn(
				"group rounded-[10px] border px-4 py-4 transition-colors",
				tone === "top"
					? "border-[#3a3128] bg-[#201c16] hover:border-[#4a3d32]"
					: "border-[#2d2822] bg-[#1b1814] hover:border-[#3a332b]",
				task.done && "opacity-55",
			)}
		>
			<div className="flex items-center gap-4">
				{tone === "top" ? (
					<span className="w-7 shrink-0 text-center font-mono font-semibold text-[#8b8175] text-xl">
						{index + 1}
					</span>
				) : null}
				<Checkbox
					checked={task.done}
					onCheckedChange={() => onToggle(task.id)}
					className="rounded-full border-[#6f655a] data-[state=checked]:border-[#62b68d] data-[state=checked]:bg-[#62b68d]"
				/>
				<div className="min-w-0 flex-1">
					<button type="button" onClick={() => onJump(task.id)} className="block text-left">
						<span
							className={cn(
								"font-semibold text-[#e3d9ce] text-base leading-5 hover:text-white",
								task.done && "text-[#6b6560] line-through",
							)}
						>
							{task.title ?? task.text ?? "Untitled task"}
						</span>
					</button>
					{(task.priority || task.dueAt) && (
						<div className="mt-2 flex flex-wrap items-center gap-2">
							{task.priority && <PriorityChip priority={task.priority} />}
							{task.dueAt && <DueChip dueAt={task.dueAt} />}
						</div>
					)}
				</div>
				<div className="flex shrink-0 items-center gap-1 opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
					<Button type="button" variant="ghost" size="icon-xs" title="Move up" onClick={() => onMove(task.id, -1)}>
						<ChevronDown className="size-3.5 rotate-180 text-[#6b6560]" />
					</Button>
					<Button type="button" variant="ghost" size="icon-xs" title="Move down" onClick={() => onMove(task.id, 1)}>
						<ChevronDown className="size-3.5 text-[#6b6560]" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => onSetTier(task.id, tone === "top" ? "backlog" : "top")}
						className="h-6 rounded-[5px] border border-[#342d27] px-2 text-[#8a8378] hover:text-[#907ce8]"
					>
						{tone === "top" ? "backlog" : "top"}
					</Button>
					<Button type="button" variant="ghost" size="icon-xs" title="Remove from focus" onClick={() => onUnpin(task.id)}>
						<PinOff className="size-3.5 text-[#6b6560] hover:text-[#e46f50]" />
					</Button>
				</div>
			</div>
		</div>
	);
}

function AttentionCluster({
	attentionOpen,
	onToggleOpen,
	overdueTasks,
	todayTasks,
	legacyPinnedItems,
	onAdd,
	onJump,
}: {
	attentionOpen: boolean;
	onToggleOpen: () => void;
	overdueTasks: Item[];
	todayTasks: Item[];
	legacyPinnedItems: Item[];
	onAdd: (task: Item, tier: FocusTier) => void;
	onJump: (id: string) => void;
}) {
	const total = overdueTasks.length + todayTasks.length + legacyPinnedItems.length;
	return (
		<section>
			<button
				type="button"
				onClick={onToggleOpen}
				className="mb-3 flex w-full items-center justify-between gap-4 text-left"
			>
				<div>
					<p className="flex items-center gap-2 font-bold text-[#e46f50] text-[11px] uppercase tracking-[0.24em]">
						<ClockIcon className="size-3.5" />
						Needs Attention
					</p>
					<p className="mt-1 text-[#6d6259] text-xs">
						Overdue and due-today tasks that are not in the plan.
					</p>
				</div>
				<span className="flex items-center gap-2 font-mono text-[#5f564d] text-xs">
					{total}
					{attentionOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
				</span>
			</button>
			{attentionOpen ? (
				total > 0 ? (
					<div className="space-y-7">
					{overdueTasks.length > 0 ? (
						<AttentionGroup
							label="Overdue"
							tasks={overdueTasks}
							empty=""
							tone="danger"
							onAdd={onAdd}
							onJump={onJump}
						/>
					) : null}
					{todayTasks.length > 0 ? (
						<AttentionGroup
							label="Due today"
							tasks={todayTasks}
							empty=""
							tone="neutral"
							onAdd={onAdd}
							onJump={onJump}
						/>
					) : null}
					{legacyPinnedItems.length > 0 ? (
						<AttentionGroup
							label="Pinned earlier"
							tasks={legacyPinnedItems}
							empty=""
							tone="neutral"
							onAdd={onAdd}
							onJump={onJump}
						/>
					) : null}
					</div>
				) : (
					<p className="rounded-[10px] border border-[#2e2b26] border-dashed px-4 py-3 text-[#5f5750] text-sm">
						No date-bound tasks need attention.
					</p>
				)
			) : null}
		</section>
	);
}

function AttentionGroup({
	label,
	tasks,
	empty,
	tone,
	onAdd,
	onJump,
}: {
	label: string;
	tasks: Item[];
	empty: string;
	tone: "danger" | "neutral";
	onAdd: (task: Item, tier: FocusTier) => void;
	onJump: (id: string) => void;
}) {
	return (
		<div>
			<div className="mb-2 flex items-center justify-between">
				<p
					className={cn(
						"font-bold text-[11px] uppercase tracking-[0.2em]",
						tone === "danger" ? "text-[#e46f50]" : "text-[#81776d]",
					)}
				>
					{label}
				</p>
				<span className="font-mono text-[#5f5750] text-[10px]">{tasks.length}</span>
			</div>
			{tasks.length > 0 ? (
				<div className="space-y-2">
					{tasks.map((task) => (
						<div
							key={task.id}
							className="group flex items-center gap-3 rounded-[10px] border border-[#2d2822] bg-[#1b1814] px-4 py-3 hover:border-[#3a332b]"
						>
							<button
								type="button"
								onClick={() => onAdd(task, "top")}
								aria-label="Add to top focus"
								className="size-5 shrink-0 rounded-full border border-[#6f655a] transition-colors hover:border-[#907ce8]"
							/>
							<button type="button" onClick={() => onJump(task.id)} className="min-w-0 flex-1 text-left">
								<span className="block truncate font-semibold text-[#d8cec2] text-sm">
									{task.title ?? task.text ?? "Untitled task"}
								</span>
							</button>
							<div className="hidden shrink-0 flex-wrap items-center gap-2 sm:flex">
								{task.priority && <PriorityChip priority={task.priority} />}
								{task.dueAt && <DueChip dueAt={task.dueAt} />}
							</div>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => onAdd(task, "top")}
								className="h-7 rounded-[6px] border border-[#342d27] px-2 text-[#907ce8]"
							>
								focus
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon-xs"
								title="Add to backlog"
								onClick={() => onAdd(task, "backlog")}
								className="text-[#8a8378]"
							>
								<ArrowUpRightIcon className="size-3.5" />
							</Button>
						</div>
					))}
				</div>
			) : (
				<p className="rounded-[10px] border border-[#2e2b26] border-dashed px-4 py-3 text-[#5f5750] text-sm">
					{empty}
				</p>
			)}
		</div>
	);
}
