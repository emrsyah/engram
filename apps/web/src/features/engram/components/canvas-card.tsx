"use client";

import { Checkbox } from "@alphonse/ui/components/checkbox";
import { cn } from "@alphonse/ui/lib/utils";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useRef, useState } from "react";

import { DueChip, PriorityChip, TypeLabel } from "./chips";
import { Icons } from "./icons";
import { useEngramStore } from "../store";
import type { Item } from "../types";

type CanvasCardProps = {
  item: Item;
};

export function CanvasCard({ item }: CanvasCardProps) {
  const {
    moveItem,
    toggleDone,
    linkSourceId,
    setLinkSource,
    connectItems,
    selectedItemId,
    jumpToItem,
    activeViewState,
  } = useEngramStore();
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ pointerId: 0, startX: 0, startY: 0, itemX: 0, itemY: 0 });

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("[data-no-drag]")) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      itemX: item.x,
      itemY: item.y,
    };
    setDragging(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || dragRef.current.pointerId !== event.pointerId) {
      return;
    }

    const nextX = dragRef.current.itemX + (event.clientX - dragRef.current.startX) / activeViewState.zoom;
    const nextY = dragRef.current.itemY + (event.clientY - dragRef.current.startY) / activeViewState.zoom;
    moveItem(item.id, Math.round(nextX), Math.round(nextY));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId === event.pointerId) {
      setDragging(false);
    }
  };

  const onCardClick = () => {
    if (linkSourceId && linkSourceId !== item.id) {
      connectItems(linkSourceId, item.id);
      return;
    }
    jumpToItem(item.id);
  };

  return (
    <div
      className={cn(
        "engram-card group absolute select-none",
        selectedItemId === item.id && "ring-1 ring-[#d7b238]",
        linkSourceId === item.id && "ring-1 ring-[#9b88ff]",
        dragging && "cursor-grabbing",
      )}
      style={{
        transform: `translate(${item.x}px, ${item.y}px)`,
        width: item.width,
        minHeight: item.height,
      }}
      onClick={onCardClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <button
        type="button"
        data-no-drag
        onClick={(event) => {
          event.stopPropagation();
          setLinkSource(linkSourceId === item.id ? undefined : item.id);
        }}
        className="absolute top-3 right-3 z-10 hidden size-6 place-items-center rounded-[5px] border border-[#474038] bg-[#15130f] text-[#938a80] group-hover:grid"
        aria-label="Start link"
      >
        <Icons.link className="size-3.5" />
      </button>

      {item.type === "task" ? <TaskCard item={item} onToggle={() => toggleDone(item.id)} /> : null}
      {item.type === "thought" ? <ThoughtCard item={item} /> : null}
      {item.type === "link" ? <LinkCard item={item} /> : null}
      {item.type === "image" ? <ImageCard item={item} /> : null}
      {item.type === "file" ? <FileCard item={item} /> : null}
    </div>
  );
}

function ThoughtCard({ item }: { item: Item }) {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <TypeLabel item={item} />
      <p className="text-[15px] text-[#e7e2da] leading-6">{item.text}</p>
    </div>
  );
}

function TaskCard({ item, onToggle }: { item: Item; onToggle: () => void }) {
  return (
    <div className="flex h-full gap-3 p-4">
      <div data-no-drag className="pt-7">
        <Checkbox checked={item.done} onCheckedChange={onToggle} className="rounded-full" />
      </div>
      <div className="min-w-0 flex-1">
        <TypeLabel item={item} />
        <p className={cn("mt-3 font-semibold text-[#f0ebe3]", item.done && "text-[#756e65] line-through")}>
          {item.title}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <PriorityChip priority={item.priority} />
          <DueChip dueAt={item.dueAt} />
        </div>
      </div>
    </div>
  );
}

function LinkCard({ item }: { item: Item }) {
  const domain = item.url ? new URL(item.url).hostname.replace("www.", "") : "";

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <TypeLabel item={item} />
      <div className="flex items-start gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-[5px] bg-[#7185d6] text-white">
          <Icons.link className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="font-bold text-[#f0ebe3]">{item.title}</p>
          <p className="mt-1 text-[#53b9a8] text-xs">{domain}</p>
        </div>
      </div>
      <p className="text-[#a9a199] text-sm leading-5">{item.text}</p>
    </div>
  );
}

function ImageCard({ item }: { item: Item }) {
  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <TypeLabel item={item} />
      <div className="grid h-[214px] place-items-center rounded-[7px] bg-linear-to-br from-[#1d4039] to-[#27223c] text-[#9da39f]">
        <Icons.image className="size-8" />
      </div>
      <div className="flex items-center gap-2 font-mono text-[#8b8378] text-xs">
        <Icons.file className="size-3.5" />
        {item.source}
      </div>
    </div>
  );
}

function FileCard({ item }: { item: Item }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <Icons.file className="size-5 text-[#9b88ff]" />
      <div>
        <TypeLabel item={item} />
        <p className="mt-2 font-semibold">{item.title ?? item.source}</p>
      </div>
    </div>
  );
}
