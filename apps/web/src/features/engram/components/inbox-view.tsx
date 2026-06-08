"use client";

import { useCallback, useState } from "react";
import { Button } from "@alphonse/ui/components/button";
import { Checkbox } from "@alphonse/ui/components/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@alphonse/ui/components/dropdown-menu";
import { cn } from "@alphonse/ui/lib/utils";
import { toast } from "sonner";

import { DueChip, PriorityChip, SomedayChip, TagChip } from "./chips";
import { Icons } from "./icons";
import { LinkifiedText } from "./linkified-text";
import { SPACE_ICONS, type SpaceIconKey } from "../nav";
import { useEngramStore } from "../store";
import type { Accent, Item, ItemType } from "../types";
import { useUIStore } from "../ui-store";

const ACCENT_DOT: Record<Accent, string> = {
  violet: "bg-[#907ce8]",
  gold: "bg-[#d9a82f]",
  teal: "bg-[#43b6a6]",
  red: "bg-[#e46f50]",
  blue: "bg-[#4aa5c8]",
};

const TYPE_ICON: Record<ItemType, keyof typeof Icons> = {
  thought: "sparkles",
  task: "square",
  link: "link",
  image: "image",
  file: "file",
};

export function InboxView() {
  const { inboxItems, spaces, fileItem, removeItems, toggleDone } = useEngramStore();
  const { openDetail, expandQuickCapture } = useUIStore();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const sortedSpaces = [...spaces].sort((a, b) => a.sortOrder - b.sortOrder);

  const allSelected = inboxItems.length > 0 && selected.size === inboxItems.length;
  const someSelected = selected.size > 0;

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(inboxItems.map((i) => i.id)));
  }, [inboxItems]);

  const deselectAll = useCallback(() => {
    setSelected(new Set());
  }, []);

  const handleBulkFile = useCallback(
    (spaceId: string, spaceName: string) => {
      for (const id of selected) fileItem(id, spaceId);
      toast.success(
        `Filed ${selected.size} item${selected.size === 1 ? "" : "s"} to ${spaceName}`,
      );
      setSelected(new Set());
    },
    [selected, fileItem],
  );

  const handleBulkDelete = useCallback(() => {
    removeItems([...selected]);
    setSelected(new Set());
  }, [selected, removeItems]);

  return (
    <section className="h-full overflow-y-auto bg-[#151310] px-8 py-10 text-white md:px-16 lg:px-28">
      <div className="mx-auto max-w-[860px]">
        <div className="flex items-end justify-between gap-5">
          <div>
            <h2
              className="stagger-item flex items-center gap-3 font-bold text-3xl"
              style={{ animationDelay: "0ms" }}
            >
              <Icons.inbox className="size-7 text-[#9b88ff]" />
              Inbox
            </h2>
            <p
              className="stagger-item mt-3 max-w-2xl text-[#b0a69a]"
              style={{ animationDelay: "40ms" }}
            >
              Untriaged captures. File each into a space when you're ready — nothing forces you to
              decide at capture time.
            </p>
          </div>
          <span className="shrink-0 rounded-[6px] border border-[#302c27] bg-[#211e1a] px-2.5 py-1 font-mono text-[#9f9588] text-xs">
            {inboxItems.length} item{inboxItems.length === 1 ? "" : "s"}
          </span>
        </div>

        {/* Bulk action bar */}
        {someSelected && (
          <div className="mt-6 flex items-center gap-3 rounded-[10px] border border-[#3a3252] bg-[#1e1b2a] px-4 py-2.5">
            <Checkbox
              checked={allSelected}
              onCheckedChange={allSelected ? deselectAll : selectAll}
              className="rounded-[4px] border-[#5a546d]"
            />
            <span className="font-medium text-[#cfc7ff] text-sm">
              {selected.size} selected
            </span>
            <button
              type="button"
              onClick={allSelected ? deselectAll : selectAll}
              className="text-[#9087b8] text-xs hover:text-[#cfc7ff]"
            >
              {allSelected ? "Deselect all" : "Select all"}
            </button>

            <div className="ml-auto flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={cn(
                    "flex h-7 items-center gap-1.5 rounded-[6px] border border-[#3a3252] bg-[#241f3a] px-2.5 text-[12px] font-medium text-[#cfc7ff]",
                    "hover:bg-[#2d2750] hover:text-white",
                  )}
                >
                  <Icons.cornerDownRight className="size-3.5" />
                  File to…
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={6}
                  className="min-w-[180px] rounded-[10px] border-[#2e2b26] bg-[#1a1714] text-[#efe9df]"
                >
                  {sortedSpaces.map((space) => {
                    const iconKey = (space.icon in SPACE_ICONS
                      ? space.icon
                      : "sparkles") as SpaceIconKey;
                    const SpaceIcon = Icons[SPACE_ICONS[iconKey]];
                    return (
                      <DropdownMenuItem
                        key={space.id}
                        onClick={() => handleBulkFile(space.id, space.name)}
                        className="cursor-pointer text-[#b0a99f] focus:bg-[#22201f] focus:text-white"
                      >
                        <SpaceIcon className="mr-1.5 size-4" />
                        {space.name}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              <button
                type="button"
                onClick={handleBulkDelete}
                className="flex h-7 items-center gap-1.5 rounded-[6px] px-2.5 text-[12px] font-medium text-[#6b6258] hover:bg-[#2a2220] hover:text-[#e46f50]"
              >
                <Icons.trash className="size-3.5" />
                Delete
              </button>

              <button
                type="button"
                onClick={deselectAll}
                aria-label="Clear selection"
                className="grid size-7 place-items-center rounded-[6px] text-[#5a5450] hover:bg-[#252220] hover:text-[#c8bfb2]"
              >
                <Icons.x className="size-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="mt-9 space-y-2.5">
          {inboxItems.length === 0 ? (
            <div
              className="stagger-item flex flex-col items-center gap-3 rounded-[10px] border border-dashed border-[#34302b] px-6 py-16 text-center"
              style={{ animationDelay: "80ms" }}
            >
              <Icons.inbox className="size-8 text-[#4c463e]" />
              <p className="font-semibold text-[#c8bfb2]">Inbox zero</p>
              <p className="max-w-sm text-[#82786e] text-sm">
                Captures with no chosen space land here. Dump a thought or task and triage it later.
              </p>
              <Button
                type="button"
                onClick={() => expandQuickCapture()}
                className="mt-1 h-8 gap-1.5 rounded-[7px] bg-[#907ce8] px-3 font-semibold text-[#17131f] hover:bg-[#a08ef2]"
              >
                <Icons.plus className="size-3.5" />
                Quick capture
              </Button>
            </div>
          ) : (
            <>
              {inboxItems.map((item, i) => (
                <InboxRow
                  key={item.id}
                  item={item}
                  index={i}
                  spaces={sortedSpaces}
                  selected={selected.has(item.id)}
                  anySelected={someSelected}
                  onSelect={() => toggleSelect(item.id)}
                  onOpen={() => openDetail(item.id)}
                  onToggleDone={() => toggleDone(item.id)}
                  onDelete={() => removeItems([item.id])}
                  onFile={(spaceId, spaceName) => {
                    fileItem(item.id, spaceId);
                    toast.success(`Filed to ${spaceName}`);
                  }}
                />
              ))}
              {!someSelected && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-[#5a5450] text-xs hover:text-[#9087b8]"
                  >
                    Select all {inboxItems.length} item{inboxItems.length === 1 ? "" : "s"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function InboxRow({
  item,
  index,
  spaces,
  selected,
  anySelected,
  onSelect,
  onOpen,
  onToggleDone,
  onDelete,
  onFile,
}: {
  item: Item;
  index: number;
  spaces: { id: string; name: string; icon: string; color: Accent }[];
  selected: boolean;
  anySelected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onToggleDone: () => void;
  onDelete: () => void;
  onFile: (spaceId: string, spaceName: string) => void;
}) {
  const TypeIcon = Icons[TYPE_ICON[item.type]];
  const label = item.title?.trim() || item.text?.trim() || item.url || item.source || "Untitled";
  const secondary = item.title?.trim() && item.text?.trim() ? item.text.trim() : undefined;

  return (
    <div
      className={cn(
        "stagger-item group flex items-start gap-3 rounded-[10px] border bg-[#1b1815] px-4 py-3",
        "transition-[border-color,background-color] duration-150",
        selected
          ? "border-[#3a3252] bg-[#1e1b2a]"
          : "border-[#2a2621] hover:border-[#3a352e] hover:bg-[#201d19]",
      )}
      style={{ animationDelay: `${80 + index * 30}ms` }}
    >
      {/* Selection checkbox — visible on hover or when anything is selected */}
      <span
        className={cn(
          "grid size-5 shrink-0 place-items-center pt-0.5 transition-opacity duration-150",
          anySelected || selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={onSelect}
          className="rounded-[4px] border-[#5a546d]"
        />
      </span>

      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <TypeIcon className="size-3.5 shrink-0 text-[#6b6258]" />
          <span
            className={cn(
              "truncate font-semibold text-[#f0ebe3]",
              item.done && "text-[#756e65] line-through",
            )}
          >
            <LinkifiedText text={label} />
          </span>
        </div>
        {secondary && (
          <p className="mt-1 line-clamp-1 pl-[22px] text-[#8d857b] text-sm">{secondary}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[22px]">
          <PriorityChip priority={item.priority} />
          <DueChip dueAt={item.dueAt} />
          {item.someday && !item.dueAt && <SomedayChip />}
          {item.tags?.map((tag) => <TagChip key={tag} tag={tag} />)}
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
        {item.type === "task" && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleDone(); }}
            aria-label={item.done ? "Mark undone" : "Mark done"}
            className="grid size-7 place-items-center rounded-[6px] text-[#6b6258] hover:bg-[#252220] hover:text-[#907ce8]"
          >
            <Icons.check className="size-3.5" />
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-[6px] border border-[#3a3252] bg-[#241f3a] px-2.5 text-[12px] font-medium text-[#cfc7ff]",
              "hover:bg-[#2d2750] hover:text-white",
            )}
          >
            <Icons.cornerDownRight className="size-3.5" />
            File to…
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={6}
            className="min-w-[180px] rounded-[10px] border-[#2e2b26] bg-[#1a1714] text-[#efe9df]"
          >
            {spaces.map((space) => {
              const iconKey = (space.icon in SPACE_ICONS
                ? space.icon
                : "sparkles") as SpaceIconKey;
              const SpaceIcon = Icons[SPACE_ICONS[iconKey]];
              return (
                <DropdownMenuItem
                  key={space.id}
                  onClick={() => onFile(space.id, space.name)}
                  className="cursor-pointer text-[#b0a99f] focus:bg-[#22201f] focus:text-white"
                >
                  <SpaceIcon className="mr-1.5 size-4" />
                  {space.name}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete"
          className="grid size-7 place-items-center rounded-[6px] text-[#6b6258] hover:bg-[#252220] hover:text-[#e46f50]"
        >
          <Icons.trash className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
