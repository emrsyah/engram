"use client";

const DURATION = 5000;
const R = 9;
const CIRCUMFERENCE = 2 * Math.PI * R; // ≈ 56.55

export function DeleteToast({
  label,
  onUndo,
}: {
  label: string;
  onUndo: () => void;
}) {
  return (
    <div className="flex w-[300px] items-center gap-3 rounded-[8px] border border-line-2 bg-panel px-3.5 py-3 shadow-xl">
      {/* Circular countdown */}
      <svg
        width="22"
        height="22"
        viewBox="0 0 22 22"
        className="-rotate-90 shrink-0"
        aria-hidden
      >
        <circle
          r={R}
          cx={11}
          cy={11}
          fill="none"
          stroke="var(--color-line-2)"
          strokeWidth={2.2}
        />
        <circle
          r={R}
          cx={11}
          cy={11}
          fill="none"
          stroke="var(--color-amber)"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={0}
          style={{
            animation: `toast-drain ${DURATION}ms linear forwards`,
          }}
        />
      </svg>

      <span className="flex-1 text-ink-2 text-sm">
        <span className="text-done">Deleted </span>
        {label}
      </span>

      <button
        type="button"
        onClick={onUndo}
        className="flex shrink-0 items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-brand-glow text-xs transition-colors hover:bg-fill"
      >
        Undo
        <kbd className="rounded bg-line px-1.5 py-0.5 font-mono text-[10px] text-done">
          ⌘Z
        </kbd>
      </button>
    </div>
  );
}
