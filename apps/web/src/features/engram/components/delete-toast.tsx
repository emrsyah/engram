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
    <div className="flex w-[300px] items-center gap-3 rounded-[8px] border border-[#302c27] bg-[#1a1714] px-3.5 py-3 shadow-xl">
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
          stroke="#302c27"
          strokeWidth={2.2}
        />
        <circle
          r={R}
          cx={11}
          cy={11}
          fill="none"
          stroke="#d7b238"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={0}
          style={{
            animation: `toast-drain ${DURATION}ms linear forwards`,
          }}
        />
      </svg>

      <span className="flex-1 text-[#c8bfb2] text-sm">
        <span className="text-[#6b6258]">Deleted </span>
        {label}
      </span>

      <button
        type="button"
        onClick={onUndo}
        className="flex shrink-0 items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-[#9b88ff] text-xs transition-colors hover:bg-[#272421]"
      >
        Undo
        <kbd className="rounded bg-[#2b2722] px-1.5 py-0.5 font-mono text-[10px] text-[#6b6258]">
          ⌘Z
        </kbd>
      </button>
    </div>
  );
}
