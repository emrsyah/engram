"use client";

import { Button } from "@alphonse/ui/components/button";
import { cn } from "@alphonse/ui/lib/utils";
import { ClockIcon as Clock, Pause, Play, RotateCcw, CancelIcon as X } from "./icons";

import { usePomodoro } from "./use-pomodoro";

const WORK_PRESETS = [15, 25, 30, 45, 60];

export function FocusTimerPanel({ onClose }: { onClose: () => void }) {
	const {
		workMins,
		setWorkMins,
		breakMins,
		phase,
		setPhase,
		setRemaining,
		running,
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

	return (
		<div className="absolute top-[calc(100%+8px)] right-0 z-50 w-[280px] rounded-[12px] border border-line-soft bg-panel shadow-2xl">
			<div className="flex items-center justify-between border-line-soft border-b px-4 py-3">
				<div className="flex items-center gap-2">
					<span className="font-bold text-white text-xs uppercase tracking-widest">
						Pomodoro
					</span>
					{sessions > 0 && (
						<span className="font-mono text-ink-faint text-[10px]">
							{sessions} done
						</span>
					)}
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

			<div className="flex flex-col items-center gap-4 px-5 py-5">
				{/* Circular progress */}
				<div className="relative size-28">
					<svg
						aria-label="Timer progress"
						className="size-28 -rotate-90"
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
								transition: "stroke-dashoffset 1s linear, stroke 0.4s ease",
							}}
						/>
					</svg>
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
						<span className="font-bold font-mono text-[22px] text-white leading-none tracking-tight">
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
					</div>
				</div>

				{/* Controls */}
				<div className="flex items-center gap-2">
					{running ? (
						<Button
							variant="outline"
							size="sm"
							onClick={pause}
							className="h-8 gap-2 rounded-[8px] border-line-strong bg-fill px-4 text-ink-2 hover:bg-line-soft"
						>
							<Pause className="size-3.5" />
							Pause
						</Button>
					) : (
						<Button
							size="sm"
							onClick={start}
							className="h-8 gap-2 rounded-[8px] px-4"
							style={{ backgroundColor: accent }}
						>
							<Play className="size-3.5 text-void" />
							<span className="font-bold text-void">
								{phase === "idle" ? "Start" : "Resume"}
							</span>
						</Button>
					)}
					<Button
						variant="ghost"
						size="icon-xs"
						onClick={reset}
						className="size-8 text-ink-faint hover:text-white"
						title="Reset"
					>
						<RotateCcw className="size-3.5" />
					</Button>
				</div>

				{/* Phase toggle */}
				<div className="flex w-full items-center gap-2">
					<div className="flex flex-1 gap-1 rounded-[7px] bg-base p-1">
						{(["work", "break"] as const).map((p) => {
							const isActive =
								p === "work"
									? phase === "work" || phase === "idle"
									: phase === "break";
							return (
								<button
									key={p}
									type="button"
									onClick={() => {
										if (running) return;
										setPhase(p);
										setRemaining(p === "break" ? breakSecs : workSecs);
									}}
									className={cn(
										"flex flex-1 items-center justify-center gap-1.5 rounded-[5px] py-1.5 font-semibold text-xs",
										"transition-[background-color,color,transform] duration-150",
										"active:scale-[0.96]",
										isActive
											? p === "work"
												? "bg-brand-surface text-brand-soft"
												: "bg-fill text-p3-ink"
											: "text-ink-faint hover:text-ink-muted",
										running && "pointer-events-none",
									)}
								>
									<Clock className="size-3" />
									{p === "work" ? `${workMins}m` : `${breakMins}m`}
								</button>
							);
						})}
					</div>
				</div>

				{/* Quick work presets */}
				<div className="flex w-full gap-1">
					{WORK_PRESETS.map((m) => (
						<button
							key={m}
							type="button"
							onClick={() => {
								if (running) return;
								setWorkMins(m);
								if (phase === "work" || phase === "idle") {
									setRemaining(m * 60);
								}
							}}
							className={cn(
								"flex-1 rounded-[4px] py-1 font-mono text-[10px]",
								"transition-[background-color,color,transform] duration-150",
								"active:scale-[0.95]",
								workMins === m
									? "bg-brand-surface text-brand-soft"
									: "text-line-max hover:text-ink-muted",
								running && "pointer-events-none opacity-40",
							)}
						>
							{m}
						</button>
					))}
				</div>

				{/* Session dots */}
				{sessions > 0 && (
					<div className="flex items-center gap-2">
						<div className="flex gap-1">
							{Array.from({ length: Math.min(sessions, 6) }).map((_, i) => (
								<span key={i} className="size-1.5 rounded-full bg-brand" />
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
