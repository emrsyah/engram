"use client";

import { useEffect, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// usePomodoro — the shared Pomodoro timer engine. Owns the countdown, the
// work→break→work transition, session counting, and the derived clock/progress.
// Both the top-bar popover (FocusTimerPanel) and the focus dock (FocusTimerInline)
// render their own chrome on top of this one engine, so the timing logic can't
// drift between them.
// ─────────────────────────────────────────────────────────────────────────────

export type PomodoroPhase = "idle" | "work" | "break";

export function usePomodoro(defaultWork = 25, defaultBreak = 5) {
  const [workMins, setWorkMins] = useState(defaultWork);
  const [breakMins, setBreakMins] = useState(defaultBreak);
  const [phase, setPhase] = useState<PomodoroPhase>("idle");
  const [remaining, setRemaining] = useState(defaultWork * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);

  const workSecs = workMins * 60;
  const breakSecs = breakMins * 60;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((s) => {
        if (s > 1) return s - 1;
        clearInterval(id);
        setRunning(false);
        const next: PomodoroPhase = phase === "work" ? "break" : "work";
        if (phase === "work") setSessions((n) => n + 1);
        setPhase(next);
        setRemaining(next === "break" ? breakSecs : workSecs);
        return 0;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, workSecs, breakSecs, phase]);

  const start = () => {
    if (phase === "idle") setPhase("work");
    setRunning(true);
  };
  const pause = () => setRunning(false);
  const reset = () => {
    setRunning(false);
    setPhase("idle");
    setRemaining(workSecs);
  };

  const mins = Math.floor(remaining / 60)
    .toString()
    .padStart(2, "0");
  const secs = (remaining % 60).toString().padStart(2, "0");
  const total = phase === "break" ? breakSecs : workSecs;
  const progress = total > 0 ? (total - remaining) / total : 0;
  const accent = phase === "break" ? "var(--color-teal)" : "var(--color-brand)";

  return {
    workMins,
    setWorkMins,
    breakMins,
    setBreakMins,
    phase,
    setPhase,
    remaining,
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
  };
}
