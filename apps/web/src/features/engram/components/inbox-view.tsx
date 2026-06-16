"use client";

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  violet: "bg-brand",
  gold: "bg-honey",
  teal: "bg-teal",
  red: "bg-coral",
  blue: "bg-blue",
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
  const [triageMode, setTriageMode] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeRowRef = useRef<HTMLDivElement | null>(null);
  const sortedSpaces = useMemo(() => [...spaces].sort((a, b) => a.sortOrder - b.sortOrder), [spaces]);
  const safeActiveIndex = Math.min(activeIndex, Math.max(inboxItems.length - 1, 0));
  const activeItem = inboxItems[safeActiveIndex];

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

  const moveActive = useCallback(
    (direction: 1 | -1) => {
      if (inboxItems.length === 0) return;
      setActiveIndex((current) => {
        const next = current + direction;
        if (next < 0) return inboxItems.length - 1;
        if (next >= inboxItems.length) return 0;
        return next;
      });
    },
    [inboxItems.length],
  );

  const fileActiveItem = useCallback(
    (spaceIndex: number) => {
      if (!activeItem) return;
      const targetSpace = sortedSpaces[spaceIndex];
      if (!targetSpace) return;

      fileItem(activeItem.id, targetSpace.id);
      toast.success(`Filed to ${targetSpace.name}`);
      setActiveIndex((current) => Math.min(current, Math.max(inboxItems.length - 2, 0)));
    },
    [activeItem, fileItem, inboxItems.length, sortedSpaces],
  );

  const deleteActiveItem = useCallback(() => {
    if (!activeItem) return;
    removeItems([activeItem.id]);
    setActiveIndex((current) => Math.min(current, Math.max(inboxItems.length - 2, 0)));
  }, [activeItem, inboxItems.length, removeItems]);

  useEffect(() => {
    if (!triageMode) return;
    activeRowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [safeActiveIndex, triageMode]);

  useEffect(() => {
    if (!triageMode) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (isEditable || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setTriageMode(false);
        return;
      }

      if (event.key === "j" || event.key === "J" || event.key === "ArrowDown") {
        event.preventDefault();
        event.stopImmediatePropagation();
        moveActive(1);
        return;
      }

      if (event.key === "k" || event.key === "K" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopImmediatePropagation();
        moveActive(-1);
        return;
      }

      if ((event.key === "Enter" || event.key === "o" || event.key === "O") && activeItem) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openDetail(activeItem.id);
        return;
      }

      if ((event.key === "d" || event.key === "D" || event.key === "Backspace") && activeItem) {
        event.preventDefault();
        event.stopImmediatePropagation();
        deleteActiveItem();
        return;
      }

      if (event.key === " " && activeItem?.type === "task") {
        event.preventDefault();
        event.stopImmediatePropagation();
        toggleDone(activeItem.id);
        return;
      }

      if (/^[1-9]$/.test(event.key)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        fileActiveItem(Number(event.key) - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [
    activeItem,
    deleteActiveItem,
    fileActiveItem,
    moveActive,
    openDetail,
    toggleDone,
    triageMode,
  ]);

  return (
    <section className="h-full overflow-y-auto bg-base px-8 py-10 text-white md:px-16 lg:px-28">
      <div className="mx-auto max-w-[860px]">
        <div className="flex items-end justify-between gap-5">
          <div>
            <h2
              className="stagger-item flex items-center gap-3 font-serif font-medium text-3xl tracking-tight"
              style={{ animationDelay: "0ms" }}
            >
              <Icons.inbox className="size-7 text-brand-glow" />
              Inbox
            </h2>
            <p
              className="stagger-item mt-3 max-w-2xl text-ink-3"
              style={{ animationDelay: "40ms" }}
            >
              Untriaged captures. File each into a space when you're ready — nothing forces you to
              decide at capture time.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setTriageMode((value) => !value)}
              disabled={inboxItems.length === 0}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-[7px] border px-3 font-semibold text-xs transition-colors",
                triageMode
                  ? "border-brand bg-brand-surface text-brand-soft"
                  : "border-line-2 bg-surface text-ink-muted hover:border-line-strong hover:text-ink-2",
                inboxItems.length === 0 && "cursor-not-allowed opacity-50 hover:border-line-2",
              )}
            >
              <Icons.keyboard className="size-3.5" />
              Triage
            </button>
            <span className="rounded-[6px] border border-line-2 bg-surface px-2.5 py-1 font-mono text-ink-muted text-xs">
              {inboxItems.length} item{inboxItems.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {triageMode && inboxItems.length > 0 && (
          <div className="mt-6 rounded-[10px] border border-line-max bg-brand-surface px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span className="font-semibold text-brand-soft">
                Triage {safeActiveIndex + 1} / {inboxItems.length}
              </span>
              <span className="text-brand">J/K move</span>
              <span className="text-brand">1-9 file</span>
              <span className="text-brand">Enter open</span>
              <span className="text-brand">D delete</span>
              <span className="text-brand">Esc exit</span>
            </div>
            {sortedSpaces.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {sortedSpaces.slice(0, 9).map((space, index) => {
                  const iconKey = (space.icon in SPACE_ICONS
                    ? space.icon
                    : "sparkles") as SpaceIconKey;
                  const SpaceIcon = Icons[SPACE_ICONS[iconKey]];
                  return (
                    <button
                      key={space.id}
                      type="button"
                      onClick={() => fileActiveItem(index)}
                      className="flex h-7 items-center gap-1.5 rounded-[6px] border border-line-max bg-brand-surface px-2 text-[12px] font-medium text-brand-soft hover:bg-p3 hover:text-white"
                    >
                      <span className="font-mono text-brand">{index + 1}</span>
                      <SpaceIcon className="size-3.5" />
                      {space.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Bulk action bar */}
        {someSelected && (
          <div className="mt-6 flex items-center gap-3 rounded-[10px] border border-line-max bg-brand-surface px-4 py-2.5">
            <Checkbox
              checked={allSelected}
              onCheckedChange={allSelected ? deselectAll : selectAll}
              className="rounded-[4px] border-ink-faint"
            />
            <span className="font-medium text-brand-soft text-sm">
              {selected.size} selected
            </span>
            <button
              type="button"
              onClick={allSelected ? deselectAll : selectAll}
              className="text-brand text-xs hover:text-brand-soft"
            >
              {allSelected ? "Deselect all" : "Select all"}
            </button>

            <div className="ml-auto flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={cn(
                    "flex h-7 items-center gap-1.5 rounded-[6px] border border-line-max bg-brand-surface px-2.5 text-[12px] font-medium text-brand-soft",
                    "hover:bg-p3 hover:text-white",
                  )}
                >
                  <Icons.cornerDownRight className="size-3.5" />
                  File to…
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={6}
                  className="min-w-[180px] rounded-[10px] border-line-soft bg-panel text-ink"
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
                        className="cursor-pointer text-ink-3 focus:bg-fill focus:text-white"
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
                className="flex h-7 items-center gap-1.5 rounded-[6px] px-2.5 text-[12px] font-medium text-done hover:bg-line hover:text-coral"
              >
                <Icons.trash className="size-3.5" />
                Delete
              </button>

              <button
                type="button"
                onClick={deselectAll}
                aria-label="Clear selection"
                className="grid size-7 place-items-center rounded-[6px] text-ink-ghost hover:bg-fill hover:text-ink-2"
              >
                <Icons.x className="size-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="mt-9 space-y-2.5">
          {inboxItems.length === 0 ? (
            <div
              className="stagger-item flex flex-col items-center gap-3 rounded-[10px] border border-dashed border-raise px-6 py-16 text-center"
              style={{ animationDelay: "80ms" }}
            >
              <Icons.inbox className="size-8 text-line-max" />
              <p className="font-semibold text-ink-2">Inbox zero</p>
              <p className="max-w-sm text-ink-dim text-sm">
                Captures with no chosen space land here. Dump a thought or task and triage it later.
              </p>
              <Button
                type="button"
                onClick={() => expandQuickCapture()}
                className="mt-1 h-8 gap-1.5 rounded-[7px] bg-brand px-3 font-semibold text-brand-ink hover:bg-brand-bright"
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
                  active={triageMode && i === safeActiveIndex}
                  ref={triageMode && i === safeActiveIndex ? activeRowRef : undefined}
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
                    className="text-ink-ghost text-xs hover:text-brand"
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

const InboxRow = forwardRef<HTMLDivElement, {
  item: Item;
  index: number;
  spaces: { id: string; name: string; icon: string; color: Accent }[];
  selected: boolean;
  anySelected: boolean;
  active: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onToggleDone: () => void;
  onDelete: () => void;
  onFile: (spaceId: string, spaceName: string) => void;
}>(function InboxRow({
  item,
  index,
  spaces,
  selected,
  anySelected,
  active,
  onSelect,
  onOpen,
  onToggleDone,
  onDelete,
  onFile,
}, ref) {
  const TypeIcon = Icons[TYPE_ICON[item.type]];
  const label = item.title?.trim() || item.text?.trim() || item.url || item.source || "Untitled";
  const secondary = item.title?.trim() && item.text?.trim() ? item.text.trim() : undefined;

  return (
    <div
      ref={ref}
      className={cn(
        "stagger-item group flex items-start gap-3 rounded-[10px] border bg-panel px-4 py-3",
        "transition-[border-color,background-color,box-shadow] duration-150",
        selected
          ? "border-line-max bg-brand-surface"
          : "border-line hover:border-line-strong hover:bg-surface",
        active && "border-brand bg-brand-surface shadow-[0_0_0_1px_rgba(144,124,232,0.35)]",
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
          className="rounded-[4px] border-ink-faint"
        />
      </span>

      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <TypeIcon className="size-3.5 shrink-0 text-done" />
          <span
            className={cn(
              "truncate font-semibold text-ink",
              item.done && "text-ink-faint line-through",
            )}
          >
            <LinkifiedText text={label} />
          </span>
        </div>
        {secondary && (
          <p className="mt-1 line-clamp-1 pl-[22px] text-ink-muted text-sm">{secondary}</p>
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
            className="grid size-7 place-items-center rounded-[6px] text-done hover:bg-fill hover:text-brand"
          >
            <Icons.check className="size-3.5" />
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-[6px] border border-line-max bg-brand-surface px-2.5 text-[12px] font-medium text-brand-soft",
              "hover:bg-p3 hover:text-white",
            )}
          >
            <Icons.cornerDownRight className="size-3.5" />
            File to…
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={6}
            className="min-w-[180px] rounded-[10px] border-line-soft bg-panel text-ink"
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
                  className="cursor-pointer text-ink-3 focus:bg-fill focus:text-white"
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
          className="grid size-7 place-items-center rounded-[6px] text-done hover:bg-fill hover:text-coral"
        >
          <Icons.trash className="size-3.5" />
        </button>
      </div>
    </div>
  );
});
