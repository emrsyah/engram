"use client";

import { Checkbox } from "@alphonse/ui/components/checkbox";
import { cn } from "@alphonse/ui/lib/utils";

import { DueChip, PriorityChip } from "./chips";
import { useEngramStore } from "../store";
import type { Item, Priority } from "../types";

const columns: { priority: Priority; title: string }[] = [
  { priority: 1, title: "Critical" },
  { priority: 2, title: "Important" },
  { priority: 3, title: "Eventually" },
];

export function PrioritiesView() {
  const { tasksByPriority } = useEngramStore();

  return (
    <section className="h-full overflow-y-auto bg-[#151310] px-8 py-10 text-white md:px-16 lg:px-28">
      <div className="mx-auto max-w-[1160px]">
        <h2 className="font-bold text-3xl">Priorities</h2>
        <p className="mt-3 text-[#b0a69a]">
          The same tasks from your canvas, triaged by how much they matter right now.
        </p>

        <div className="mt-9 grid gap-5 lg:grid-cols-3">
          {columns.map((column) => (
            <PriorityColumn
              key={column.priority}
              priority={column.priority}
              title={column.title}
              tasks={tasksByPriority[column.priority]}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function PriorityColumn({
  priority,
  title,
  tasks,
}: {
  priority: Priority;
  title: string;
  tasks: Item[];
}) {
  const openCount = tasks.filter((task) => !task.done).length;

  return (
    <div className="min-h-[210px] rounded-[8px] border border-[#302c27] bg-[#211e1a] p-5">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PriorityChip priority={priority} />
          <h3 className="font-bold text-[#c8bfb2]">{title}</h3>
        </div>
        <span className="text-[#81786e] text-sm">{openCount}</span>
      </div>
      <div className="space-y-4">
        {tasks.length ? (
          tasks.map((task) => <PriorityTask key={task.id} task={task} />)
        ) : (
          <p className="text-[#81786e] text-sm">Nothing here</p>
        )}
      </div>
    </div>
  );
}

function PriorityTask({ task }: { task: Item }) {
  const { toggleDone, jumpToItem } = useEngramStore();

  return (
    <button
      type="button"
      onClick={() => jumpToItem(task.id)}
      className="flex w-full items-start gap-3 rounded-[7px] p-2 text-left hover:bg-[#2b2722]"
    >
      <span onClick={(event) => event.stopPropagation()} className="mt-1">
        <Checkbox checked={task.done} onCheckedChange={() => toggleDone(task.id)} className="rounded-full" />
      </span>
      <span className="min-w-0">
        <span className={cn("block font-semibold text-white", task.done && "text-[#655e56] line-through")}>
          {task.title}
        </span>
        <span className="mt-1 flex">
          <DueChip dueAt={task.dueAt} />
        </span>
      </span>
    </button>
  );
}
