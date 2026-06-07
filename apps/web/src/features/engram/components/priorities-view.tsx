"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Button } from "@alphonse/ui/components/button";
import { Card } from "@alphonse/ui/components/card";
import { Checkbox } from "@alphonse/ui/components/checkbox";
import { cn } from "@alphonse/ui/lib/utils";
import { useState } from "react";

import { DueChip, PriorityChip } from "./chips";
import { useEngramStore } from "../store";
import type { Item, Priority } from "../types";

const columns: { priority: Priority; title: string }[] = [
  { priority: 1, title: "Critical" },
  { priority: 2, title: "Important" },
  { priority: 3, title: "Eventually" },
];

export function PrioritiesView() {
  const { tasksByPriority, updateItem, jumpToItem } = useEngramStore();
  const [activeTask, setActiveTask] = useState<Item | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragStart = ({ active }: DragStartEvent) => {
    const allTasks = Object.values(tasksByPriority).flat();
    setActiveTask(allTasks.find((t) => t.id === active.id) ?? null);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveTask(null);
    if (!over) return;
    const newPriority = Number(over.id) as Priority;
    const task = Object.values(tasksByPriority).flat().find((t) => t.id === active.id);
    if (task && task.priority !== newPriority) {
      updateItem(task.id, { priority: newPriority });
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <section className="h-full overflow-y-auto bg-[#151310] px-8 py-10 text-white md:px-16 lg:px-28">
        <div className="mx-auto max-w-[1160px]">
          <h2 className="stagger-item font-bold text-3xl" style={{ animationDelay: "0ms" }}>
            Priorities
          </h2>
          <p
            className="stagger-item mt-3 text-[#b0a69a]"
            style={{ animationDelay: "40ms" }}
          >
            The same tasks from your canvas, triaged by how much they matter. Drag to reprioritise.
          </p>

          <div className="mt-9 grid gap-5 lg:grid-cols-3">
            {columns.map((col, i) => (
              <PriorityColumn
                key={col.priority}
                priority={col.priority}
                title={col.title}
                tasks={tasksByPriority[col.priority]}
                onJump={jumpToItem}
                index={i}
              />
            ))}
          </div>
        </div>
      </section>

      <DragOverlay dropAnimation={null}>
        {activeTask ? <TaskDragPreview task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function PriorityColumn({
  priority,
  title,
  tasks,
  onJump,
  index,
}: {
  priority: Priority;
  title: string;
  tasks: Item[];
  onJump: (id: string) => void;
  index: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: String(priority) });
  const openCount = tasks.filter((t) => !t.done).length;

  return (
    <div
      ref={setNodeRef}
      className="stagger-item"
      style={{ animationDelay: `${80 + index * 60}ms` }}
    >
      <Card
        className={cn(
          "min-h-[210px] gap-0 rounded-[8px] border bg-[#211e1a] p-5 py-5 ring-0",
          "transition-[background-color,border-color,box-shadow] duration-150",
          isOver
            ? "border-[#4c463e] bg-[#272421] shadow-[inset_0_0_0_1px_#4c463e]"
            : "border-[#302c27]",
        )}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PriorityChip priority={priority} />
            <h3 className="font-bold text-[#c8bfb2]">{title}</h3>
          </div>
          <span className="tabular-nums text-[#81786e] text-sm">{openCount}</span>
        </div>

        <div className="space-y-1">
          {tasks.length ? (
            tasks.map((task, ti) => (
              <PriorityTask
                key={task.id}
                task={task}
                onJump={onJump}
                index={ti}
              />
            ))
          ) : (
            <p className={cn("text-[#81786e] text-sm transition-opacity duration-150", isOver && "opacity-0")}>
              Nothing here
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

function PriorityTask({
  task,
  onJump,
}: {
  task: Item;
  onJump: (id: string) => void;
  index: number;
}) {
  const { toggleDone } = useEngramStore();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      className="transition-opacity duration-150"
      style={{ opacity: isDragging ? 0.3 : 1 }}
    >
      <Button
        type="button"
        variant="ghost"
        onClick={() => onJump(task.id)}
        className={cn(
          "h-auto w-full items-start justify-start gap-3 rounded-[7px] p-2 text-left font-normal",
          "transition-[background-color,transform] duration-150",
          "hover:bg-[#2b2722]",
          "active:scale-[0.98] active:bg-[#2f2b26]",
        )}
      >
        <span
          {...listeners}
          {...attributes}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "mt-1 cursor-grab touch-none text-[#4c463e]",
            "transition-colors duration-150 hover:text-[#7a7068]",
            "active:cursor-grabbing",
          )}
          aria-label="Drag to reprioritise"
        >
          <GripIcon />
        </span>

        <span onClick={(e) => e.stopPropagation()} className="mt-1">
          <Checkbox
            checked={task.done}
            onCheckedChange={() => toggleDone(task.id)}
            className="rounded-full"
          />
        </span>

        <span className="min-w-0">
          <span
            className={cn(
              "block font-semibold text-white",
              task.done && "text-[#655e56] line-through",
            )}
          >
            {task.title}
          </span>
          <span className="mt-1 flex">
            <DueChip dueAt={task.dueAt} />
          </span>
        </span>
      </Button>
    </div>
  );
}

function TaskDragPreview({ task }: { task: Item }) {
  return (
    <div className="flex w-[280px] items-start gap-3 rounded-[7px] border border-[#9b88ff]/40 bg-[#211e1a] p-2 shadow-2xl ring-1 ring-[#9b88ff]/20 rotate-1 scale-[1.02]">
      <GripIcon className="mt-1 text-[#9b88ff]" />
      <span className="font-semibold text-white">{task.title}</span>
    </div>
  );
}

function GripIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" className={className}>
      <circle cx="4" cy="3.5" r="1.2" />
      <circle cx="10" cy="3.5" r="1.2" />
      <circle cx="4" cy="7" r="1.2" />
      <circle cx="10" cy="7" r="1.2" />
      <circle cx="4" cy="10.5" r="1.2" />
      <circle cx="10" cy="10.5" r="1.2" />
    </svg>
  );
}
