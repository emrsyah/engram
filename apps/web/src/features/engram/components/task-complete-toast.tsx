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
    <div className="flex w-[360px] items-start gap-3 rounded-[8px] border border-[#302c27] bg-[#1a1714] px-3.5 py-3 shadow-2xl shadow-black/35">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-[#48603a] bg-[#22301d] text-[#9fd66f]">
        <CheckIcon className="size-3.5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-[#efe9df] text-sm leading-5">{label}</p>
            <p className="mt-0.5 text-[#8d857b] text-xs leading-4">Task complete. Delete it?</p>
          </div>

          <button
            type="button"
            onClick={onKeep}
            className="grid size-6 shrink-0 place-items-center rounded-[5px] text-[#6f675f] transition-colors hover:bg-[#25221e] hover:text-[#c8bfb2]"
            title="Keep task (Esc)"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onKeep}
            className="rounded-[5px] px-2.5 py-1 text-[#8d857b] text-xs transition-colors hover:bg-[#25221e] hover:text-[#c8bfb2]"
          >
            Keep
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1.5 rounded-[5px] border border-[#472323] bg-[#241616] px-2.5 py-1 text-[#e17a70] text-xs transition-colors hover:border-[#62302c] hover:bg-[#2d1a18]"
          >
            <Trash2Icon className="size-3" />
            Delete
            <kbd className="rounded bg-[#34201e] px-1.5 py-0.5 font-mono text-[10px] text-[#a78b85]">
              D
            </kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
