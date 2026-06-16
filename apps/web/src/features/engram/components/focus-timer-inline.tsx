"use client";

import { Button } from "@alphonse/ui/components/button";
import { Input } from "@alphonse/ui/components/input";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "@alphonse/ui/components/popover";
import { ToggleGroup, ToggleGroupItem } from "@alphonse/ui/components/toggle-group";
import { cn } from "@alphonse/ui/lib/utils";
import { ClockIcon as Clock, Pause, Play, RotateCcw, Settings2 } from "./icons";
import { useCallback, useState } from "react";

import { usePomodoro } from "./use-pomodoro";

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

const WORK_PRESETS = [15, 25, 30, 45, 60];
const BREAK_PRESETS = [5, 10, 15];

export function FocusTimerInline() {
	const {
		workMins,
		setWorkMins,
		breakMins,
		setBreakMins,
		phase,
		setPhase,
		setRemaining,
		running,
		setRunning,
		sessions,
		workSecs,
		breakSecs,
		start,
		pause,
		reset,
		mins,
		secs,
		progress,
		accent,
	} = usePomodoro(25, 5);
	const [customOpen, setCustomOpen] = useState(false);
	const [customWork, setCustomWork] = useState("25");
	const [customBreak, setCustomBreak] = useState("5");

	const switchPhase = useCallback(
		(p: "work" | "break") => {
			setRunning(false);
			setPhase(p);
			setRemaining(p === "break" ? breakSecs : workSecs);
		},
		[breakSecs, workSecs, setRunning, setPhase, setRemaining],
	);

	const applyCustom = () => {
		const w = Math.max(1, Math.min(120, Number(customWork) || 25));
		const b = Math.max(1, Math.min(60, Number(customBreak) || 5));
		setWorkMins(w);
		setBreakMins(b);
		setRunning(false);
		setPhase("idle");
		setRemaining(w * 60);
		setCustomOpen(false);
	};

	const activeMins = phase === "break" ? breakMins : workMins;

	const statusLine =
		phase === "idle"
			? "Work in focused intervals"
			: phase === "work"
				? running
					? `Focusing — ${workMins}m block`
					: "Focus block paused"
				: running
					? `On a break — ${breakMins}m`
					: "Break paused";

	return (
		<div className="flex h-full flex-col">
			{/* ── Header ── */}
			<div className="shrink-0 border-line-soft border-b px-4 py-3">
				<div className="flex items-center justify-between">
					<span className="font-bold text-white text-xs uppercase tracking-widest">
						Pomodoro
					</span>
					{sessions > 0 && (
						<span className="font-mono text-ink-faint text-[10px]">
							{sessions} {sessions === 1 ? "session" : "sessions"}
						</span>
					)}
				</div>
				<p className="mt-1 text-ink-faint text-[11px]">{statusLine}</p>
			</div>

			{/* ── Timer body ── */}
			<div className="flex flex-col items-center gap-5 px-4 py-6">
			{/* ── Circle ── */}
			<div className="relative size-36">
				<svg
					aria-label="Timer progress"
					className="size-36 -rotate-90"
					viewBox="0 0 100 100"
				>
					<circle
						cx="50"
						cy="50"
						r="44"
						fill="none"
						stroke="var(--color-fill)"
						strokeWidth="5"
					/>
					<circle
						cx="50"
						cy="50"
						r="44"
						fill="none"
						stroke={accent}
						strokeWidth="5"
						strokeDasharray="276.5"
						strokeDashoffset={276.5 * (1 - progress)}
						strokeLinecap="round"
						style={{
							transition: `stroke-dashoffset 1s linear, stroke 200ms ${EASE_OUT}`,
						}}
					/>
				</svg>
				<div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
					<span className="font-bold font-mono text-[28px] text-white leading-none tracking-tight">
						{mins}:{secs}
					</span>
					<span
						className={cn(
							"font-semibold text-[11px] uppercase tracking-wider",
							phase === "break" ? "text-teal" : "text-brand",
						)}
					>
						{phase === "idle"
							? "Ready"
							: phase === "work"
								? "Focus"
								: "Break"}
					</span>
					{activeMins !== (phase === "break" ? 5 : 25) && phase !== "idle" && (
						<span className="font-mono text-line-max text-[10px]">
							{activeMins}m session
						</span>
					)}
				</div>
			</div>

			{/* ── Controls ── */}
			<div className="flex items-center gap-2">
				{running ? (
					<Button
						variant="outline"
						size="sm"
						onClick={pause}
						className="h-9 gap-2 rounded-[8px] border-line-strong bg-fill px-4 text-ink-2 transition-colors duration-150 hover:bg-line-soft active:scale-[0.97]"
					>
						<Pause className="size-4" />
						Pause
					</Button>
				) : (
					<Button
						size="sm"
						onClick={start}
						className="h-9 gap-2 rounded-[8px] px-5 transition-transform duration-150 active:scale-[0.97]"
						style={{ backgroundColor: accent }}
					>
						<Play className="size-4 text-void" />
						<span className="font-bold text-void">
							{phase === "idle" ? "Start" : "Resume"}
						</span>
					</Button>
				)}
				<Button
					variant="ghost"
					size="icon-xs"
					onClick={reset}
					className="size-9 text-ink-faint transition-colors duration-150 hover:text-white active:scale-[0.95]"
					title="Reset"
				>
					<RotateCcw className="size-4" />
				</Button>
			</div>

			{/* ── Phase toggle ── */}
			<div className="flex w-full items-center gap-2">
				<ToggleGroup
					value={[phase === "idle" ? "work" : phase]}
					onValueChange={(v: string[]) => {
						if (v[0]) switchPhase(v[0] as "work" | "break");
					}}
					className="flex-1 rounded-[8px] bg-panel p-1"
				>
					<ToggleGroupItem
						value="work"
						className={cn(
							"h-7 flex-1 gap-1.5 rounded-[6px] text-xs font-semibold",
							"transition-[background-color,color,transform] duration-150",
							"active:scale-[0.96]",
							(phase === "work" || phase === "idle")
								? "bg-brand-surface text-brand-soft"
								: "text-ink-faint hover:text-ink-muted",
						)}
					>
						<Clock className="size-3" />
						{workMins}m
					</ToggleGroupItem>
					<ToggleGroupItem
						value="break"
						className={cn(
							"h-7 flex-1 gap-1.5 rounded-[6px] text-xs font-semibold",
							"transition-[background-color,color,transform] duration-150",
							"active:scale-[0.96]",
							phase === "break"
								? "bg-fill text-p3-ink"
								: "text-ink-faint hover:text-ink-muted",
						)}
					>
						<Clock className="size-3" />
						{breakMins}m
					</ToggleGroupItem>
				</ToggleGroup>

				{/* ── Custom duration popover ── */}
				<PopoverRoot open={customOpen} onOpenChange={setCustomOpen}>
					<PopoverTrigger
						render={
							<Button
								type="button"
								variant="ghost"
								size="icon-xs"
								className="size-7 text-ink-ghost transition-colors duration-150 hover:text-ink-2 active:scale-[0.95]"
								title="Custom duration"
							/>
						}
					>
						<Settings2 className="size-3.5" />
					</PopoverTrigger>
					<PopoverContent className="w-[200px] p-4">
						<div className="space-y-3">
							<p className="font-bold text-white text-xs uppercase tracking-widest">
								Duration
							</p>
							<div className="space-y-2">
								<label className="flex items-center justify-between gap-3 text-ink-3 text-xs">
									Focus
									<Input
										type="number"
										min={1}
										max={120}
										value={customWork}
										onChange={(e) => setCustomWork(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") applyCustom();
										}}
										className="h-7 w-16 rounded-[6px] border-line-2 bg-base px-2 text-center font-mono text-ink text-xs focus:border-brand focus-visible:ring-0"
									/>
								</label>
								<label className="flex items-center justify-between gap-3 text-ink-3 text-xs">
									Break
									<Input
										type="number"
										min={1}
										max={60}
										value={customBreak}
										onChange={(e) => setCustomBreak(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") applyCustom();
										}}
										className="h-7 w-16 rounded-[6px] border-line-2 bg-base px-2 text-center font-mono text-ink text-xs focus:border-teal focus-visible:ring-0"
									/>
								</label>
							</div>
							<div className="flex gap-1.5">
								{WORK_PRESETS.map((m) => (
									<button
										key={`w-${m}`}
										type="button"
										onClick={() => setCustomWork(String(m))}
										className={cn(
											"flex-1 rounded-[4px] py-1 font-mono text-[10px] transition-colors duration-150",
											Number(customWork) === m
												? "bg-brand-surface text-brand-soft"
												: "text-ink-ghost hover:text-ink-2",
										)}
									>
										{m}
									</button>
								))}
							</div>
							<div className="flex gap-1.5">
								{BREAK_PRESETS.map((m) => (
									<button
										key={`b-${m}`}
										type="button"
										onClick={() => setCustomBreak(String(m))}
										className={cn(
											"flex-1 rounded-[4px] py-1 font-mono text-[10px] transition-colors duration-150",
											Number(customBreak) === m
												? "bg-fill text-p3-ink"
												: "text-ink-ghost hover:text-ink-2",
										)}
									>
										{m}
									</button>
								))}
							</div>
							<Button
								size="sm"
								onClick={applyCustom}
								className="h-7 w-full rounded-[6px] bg-brand font-semibold text-brand-ink transition-colors duration-150 hover:bg-brand-bright active:scale-[0.97]"
							>
								Apply
							</Button>
						</div>
					</PopoverContent>
				</PopoverRoot>
			</div>

			{/* ── Quick presets ── */}
			<div className="flex w-full gap-1.5">
				{WORK_PRESETS.map((m) => (
					<button
						key={m}
						type="button"
						onClick={() => {
							if (running) return;
							setWorkMins(m);
							setRemaining(m * 60);
							setCustomWork(String(m));
							if (phase === "idle") setRemaining(m * 60);
							if (phase === "work") { setRemaining(m * 60); }
						}}
						className={cn(
							"flex-1 rounded-[5px] py-1 font-mono text-[11px] transition-[background-color,color,transform] duration-150",
							"active:scale-[0.95]",
							workMins === m
								? "bg-brand-surface text-brand-soft"
								: "text-ink-ghost hover:text-ink-muted",
							running && "pointer-events-none opacity-40",
						)}
					>
						{m}m
					</button>
				))}
			</div>

			{/* ── Session counter ── */}
			{sessions > 0 && (
				<div className="flex items-center gap-1.5">
					{Array.from({ length: Math.min(sessions, 8) }).map((_, i) => (
						<span
							key={i}
							className="size-2 rounded-full bg-brand transition-transform duration-150"
							style={{ transitionDelay: `${i * 40}ms` }}
						/>
					))}
					{sessions > 8 && (
						<span className="font-mono text-ink-faint text-[10px]">
							+{sessions - 8}
						</span>
					)}
				</div>
			)}
			</div>
		</div>
	);
}
