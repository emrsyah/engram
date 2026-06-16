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
		<div className="absolute top-[calc(100%+8px)] right-0 z-50 w-[280px] rounded-[12px] border border-[#2e2b26] bg-[#1a1714] shadow-2xl">
			<div className="flex items-center justify-between border-[#2e2b26] border-b px-4 py-3">
				<div className="flex items-center gap-2">
					<span className="font-bold text-white text-xs uppercase tracking-widest">
						Pomodoro
					</span>
					{sessions > 0 && (
						<span className="font-mono text-[#6b6560] text-[10px]">
							{sessions} done
						</span>
					)}
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
							stroke="#252220"
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
								phase === "break" ? "text-[#43b6a6]" : "text-[#907ce8]",
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
							className="h-8 gap-2 rounded-[8px] border-[#3a3530] bg-[#252220] px-4 text-[#c8bfb2] hover:bg-[#2e2b26]"
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
							<Play className="size-3.5 text-[#0e0c0a]" />
							<span className="font-bold text-[#0e0c0a]">
								{phase === "idle" ? "Start" : "Resume"}
							</span>
						</Button>
					)}
					<Button
						variant="ghost"
						size="icon-xs"
						onClick={reset}
						className="size-8 text-[#706a62] hover:text-white"
						title="Reset"
					>
						<RotateCcw className="size-3.5" />
					</Button>
				</div>

				{/* Phase toggle */}
				<div className="flex w-full items-center gap-2">
					<div className="flex flex-1 gap-1 rounded-[7px] bg-[#151310] p-1">
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
												? "bg-[#251f38] text-[#c4b5fd]"
												: "bg-[#1a2e2a] text-[#7dd4c6]"
											: "text-[#6b6560] hover:text-[#9a9088]",
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
									? "bg-[#251f38] text-[#c4b5fd]"
									: "text-[#4a4540] hover:text-[#9a9088]",
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
								<span key={i} className="size-1.5 rounded-full bg-[#907ce8]" />
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
