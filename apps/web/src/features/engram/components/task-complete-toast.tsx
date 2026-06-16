"use client";

import { CheckmarkIcon as CheckIcon, DeleteIcon as Trash2Icon, CancelIcon as XIcon } from "./icons";

export function TaskCompleteToast({
  label,
  onDelete,
  onKeep,
}: {
  label: string;
  onDelete: () => void;
  onKeep: () => void;
}) {
  return (
    <div className="flex w-[360px] items-start gap-3 rounded-[8px] border border-line-2 bg-panel px-3.5 py-3 shadow-2xl shadow-black/35">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-line-max bg-line text-ink-3">
        <CheckIcon className="size-3.5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink text-sm leading-5">{label}</p>
            <p className="mt-0.5 text-ink-muted text-xs leading-4">Task complete. Delete it?</p>
          </div>

          <button
            type="button"
            onClick={onKeep}
            className="grid size-6 shrink-0 place-items-center rounded-[5px] text-ink-faint transition-colors hover:bg-fill hover:text-ink-2"
            title="Keep task (Esc)"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onKeep}
            className="rounded-[5px] px-2.5 py-1 text-ink-muted text-xs transition-colors hover:bg-fill hover:text-ink-2"
          >
            Keep
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1.5 rounded-[5px] border border-p1 bg-clay px-2.5 py-1 text-p1-ink text-xs transition-colors hover:border-p1 hover:bg-surface"
          >
            <Trash2Icon className="size-3" />
            Delete
            <kbd className="rounded bg-line px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
              D
            </kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
