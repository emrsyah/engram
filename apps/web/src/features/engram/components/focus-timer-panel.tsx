"use client";

import { Button } from "@alphonse/ui/components/button";
import { cn } from "@alphonse/ui/lib/utils";
import { Pause, Play, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const WORK_SECS = 25 * 60;
const BREAK_SECS = 5 * 60;

type Phase = "idle" | "work" | "break";

export function FocusTimerPanel({ onClose }: { onClose: () => void }) {
	const [phase, setPhase] = useState<Phase>("idle");
	const [remaining, setRemaining] = useState(WORK_SECS);
	const [running, setRunning] = useState(false);
	const phaseRef = useRef(phase);
	phaseRef.current = phase;

	useEffect(() => {
		if (!running) return;
		const id = setInterval(() => {
			setRemaining((s) => {
				if (s > 1) return s - 1;
				clearInterval(id);
				setRunning(false);
				const next: Phase = phaseRef.current === "work" ? "break" : "work";
				setPhase(next);
				setRemaining(next === "break" ? BREAK_SECS : WORK_SECS);
				return 0;
			});
		}, 1000);
		return () => clearInterval(id);
	}, [running]);

	const start = () => {
		if (phase === "idle") setPhase("work");
		setRunning(true);
	};
	const pause = () => setRunning(false);
	const reset = () => {
		setRunning(false);
		setPhase("idle");
		setRemaining(WORK_SECS);
	};

	const mins = Math.floor(remaining / 60)
		.toString()
		.padStart(2, "0");
	const secs = (remaining % 60).toString().padStart(2, "0");
	const total = phase === "break" ? BREAK_SECS : WORK_SECS;
	const progress = total > 0 ? (total - remaining) / total : 0;
	const accent = phase === "break" ? "#43b6a6" : "#907ce8";

	return (
		<div className="absolute top-[calc(100%+8px)] right-0 z-50 w-[240px] rounded-[12px] border border-[#2e2b26] bg-[#1a1714] shadow-2xl">
			<div className="flex items-center justify-between border-[#2e2b26] border-b px-4 py-3">
				<span className="font-bold text-white text-xs uppercase tracking-widest">
					Pomodoro
				</span>
				<Button
					variant="ghost"
					size="icon-xs"
					onClick={onClose}
					className="size-6 text-[#706a62] hover:text-white"
				>
					<X className="size-3.5" />
				</Button>
			</div>

			<div className="flex flex-col items-center gap-5 px-6 py-6">
				{/* Circular progress */}
				<div className="relative size-24">
					<svg
						aria-label="Timer progress"
						className="size-24 -rotate-90"
						viewBox="0 0 100 100"
					>
						<circle
							cx="50"
							cy="50"
							r="42"
							fill="none"
							stroke="#252220"
							strokeWidth="8"
						/>
						<circle
							cx="50"
							cy="50"
							r="42"
							fill="none"
							stroke={accent}
							strokeWidth="8"
							strokeDasharray="263.9"
							strokeDashoffset={263.9 * (1 - progress)}
							strokeLinecap="round"
							style={{
								transition: "stroke-dashoffset 1s linear, stroke 0.4s ease",
							}}
						/>
					</svg>
					<div className="absolute inset-0 flex flex-col items-center justify-center">
						<span className="font-bold font-mono text-2xl text-white leading-none">
							{mins}:{secs}
						</span>
						<span
							className={cn(
								"mt-1 font-semibold text-[11px] uppercase tracking-wide",
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
							className="h-8 gap-2 rounded-[8px] border-[#3a3530] bg-[#252220] text-[#c8bfb2] hover:bg-[#2e2b26]"
						>
							<Pause className="size-3.5" />
							Pause
						</Button>
					) : (
						<Button
							size="sm"
							onClick={start}
							className="h-8 gap-2 rounded-[8px]"
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

				{/* Phase labels */}
				<div className="flex w-full gap-2">
					{(["work", "break"] as const).map((p) => (
						<button
							key={p}
							type="button"
							onClick={() => {
								setRunning(false);
								setPhase(p);
								setRemaining(p === "break" ? BREAK_SECS : WORK_SECS);
							}}
							className={cn(
								"flex-1 rounded-[6px] py-1.5 font-semibold text-xs transition-colors",
								phase === p
									? "bg-[#252220] text-white"
									: "text-[#6b6560] hover:text-[#9a9088]",
							)}
						>
							{p === "work" ? "25 min" : "5 min"}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
