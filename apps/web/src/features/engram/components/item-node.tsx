"use client";

import { Card } from "@alphonse/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@alphonse/ui/components/dropdown-menu";
import { cn } from "@alphonse/ui/lib/utils";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { toast } from "sonner";

import { Icons } from "./icons";
import { ItemCardBody } from "./item-card-bodies";
import { useEngramStore } from "../store";
import { useUIStore } from "../ui-store";
import type { Item } from "../types";

export type ItemNodeType = Node<{ item: Item }, "item">;

export function ItemNode({ data, selected }: NodeProps<ItemNodeType>) {
  const { item } = data;
  const { toggleDone, removeItem, connectItems } = useEngramStore();
  const { linkSourceId, setLinkSource, openDetail, openNoteEditor } = useUIStore();

  const isLinkSource = linkSourceId === item.id;
  const finishLink = () => {
    if (!linkSourceId || linkSourceId === item.id) return;
    connectItems(linkSourceId, item.id);
    setLinkSource(undefined);
    toast.success("Nodes linked");
  };

  return (
    <Card
      className={cn(
        "engram-card group relative select-none gap-0 py-0",
        "transition-[border-color] duration-150",
        isLinkSource && "border-[#9b88ff]",
      )}
      style={{ width: item.width, minHeight: item.height }}
      onPointerUp={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest(".nodrag,button,a,input,textarea,[role='menuitem']")) return;
        if (!linkSourceId || linkSourceId === item.id) return;
        e.stopPropagation();
        finishLink();
      }}
      onClick={(e) => {
        if (!linkSourceId || linkSourceId === item.id) return;
        e.stopPropagation();
        finishLink();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (item.type === "thought") {
          openNoteEditor(item.id);
          return;
        }
        openDetail(item.id);
      }}
    >
      <Handle type="target" position={Position.Left} className="!size-0 !border-0 !bg-transparent" />
      <Handle type="source" position={Position.Right} className="!size-0 !border-0 !bg-transparent" />
      {/* Selection / link-source outline */}
      {(selected || isLinkSource) && (
        <span
          className={cn(
            "pointer-events-none absolute inset-0 z-10 rounded-[inherit]",
            isLinkSource
              ? "shadow-[0_0_0_2px_#9b88ff,0_0_10px_0_rgba(155,136,255,0.25)]"
              : "shadow-[0_0_0_2px_#d7b238,0_0_10px_0_rgba(215,178,56,0.2)]",
          )}
        />
      )}

      {/* Top-right actions: always visible on hover, always visible when selected */}
      <div
        className={cn(
          "nodrag nopan absolute top-2 right-2 z-20 flex gap-1",
          "opacity-0 transition-opacity duration-150",
          "group-hover:opacity-100",
          selected && "opacity-100",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {linkSourceId && linkSourceId !== item.id && (
          <button
            type="button"
            onClick={finishLink}
            className={cn(
              "grid size-6 place-items-center rounded-[5px]",
              "border border-[#6d5fd0] bg-[#231d3d] text-[#cfc7ff]",
              "hover:bg-[#2d2550] hover:text-white",
              "active:scale-[0.92] transition-[colors,transform] duration-100",
            )}
            aria-label="Link here"
            title="Link here"
          >
            <Icons.check className="size-3.5" />
          </button>
        )}
        {/* 3-dot context menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "grid size-6 place-items-center rounded-[5px]",
              "border border-[#474038] bg-[#15130f] text-[#938a80]",
              "hover:bg-[#1e1b16] hover:text-[#c8bfb2]",
              "transition-colors duration-100",
            )}
          >
            <Icons.moreHorizontal className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end" sideOffset={6}>
            <DropdownMenuItem onClick={() => openDetail(item.id)}>
              <Icons.info className="size-3.5" />
              Open detail
            </DropdownMenuItem>
            {item.type === "thought" && (
              <DropdownMenuItem onClick={() => openNoteEditor(item.id)}>
                <Icons.book className="size-3.5" />
                Open editor
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setLinkSource(item.id)}>
              <Icons.link className="size-3.5" />
              Link from this
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => removeItem(item.id)}>
              <Icons.trash className="size-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Link button */}
        <button
          type="button"
          onClick={() => setLinkSource(isLinkSource ? undefined : item.id)}
          className={cn(
            "grid size-6 place-items-center rounded-[5px]",
            "border border-[#474038] bg-[#15130f] text-[#938a80]",
            "hover:bg-[#1e1b16] hover:text-[#c8bfb2]",
            "active:scale-[0.92] transition-[colors,transform] duration-100",
          )}
          aria-label="Start link"
        >
          <Icons.link className="size-3.5" />
        </button>
      </div>

      <ItemCardBody item={item} onToggle={() => toggleDone(item.id)} />
    </Card>
  );
}
