"use client";

import { Tabs, TabsList, TabsTrigger } from "@alphonse/ui/components/tabs";
import { cn } from "@alphonse/ui/lib/utils";
import { useCallback, useState } from "react";

import { ChevronDown, ChevronRight, Icons } from "./icons";
import { ItemCardBody } from "./item-card-bodies";
import { useEngramStore } from "../store";
import { useUIStore } from "../ui-store";
import type { Item, ItemType } from "../types";

// ─── Backlinks row ────────────────────────────────────────────────────────────

function BacklinksRow({ item, onOpenLinked }: { item: Item; onOpenLinked: (linked: Item) => void }) {
  const { backlinksForItem } = useEngramStore();
  const linked = backlinksForItem(item.id);
  if (linked.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 border-t border-surface px-3 py-2"
      onClick={(e) => e.stopPropagation()}
    >
      <Icons.link className="size-3 shrink-0 text-line-max" />
      {linked.map((target) => {
        const label = target.title?.trim() || target.text?.trim() || target.url || "Untitled";
        return (
          <button
            key={target.id}
            type="button"
            onClick={() => onOpenLinked(target)}
            className="max-w-[120px] truncate rounded-[4px] bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-muted hover:bg-line hover:text-ink-2 transition-colors duration-100"
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Item card ────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  onOpen,
  onOpenLinked,
}: {
  item: Item;
  onOpen: () => void;
  onOpenLinked: (linked: Item) => void;
}) {
  const { toggleDone } = useEngramStore();
  return (
    <div
      className={cn(
        "break-inside-avoid w-full rounded-[10px] border bg-panel",
        "border-line hover:border-line-strong transition-[border-color] duration-150",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left"
      >
        <ItemCardBody item={item} onToggle={() => toggleDone(item.id)} />
      </button>
      <BacklinksRow item={item} onOpenLinked={onOpenLinked} />
    </div>
  );
}

// ─── Group-by modes ───────────────────────────────────────────────────────────

type GroupByMode = "recent" | "type" | "tag";

const TYPE_LABELS: Record<ItemType, string> = {
  thought: "Thoughts",
  task: "Tasks",
  link: "Links",
  image: "Images",
  file: "Files",
};

const TYPE_ORDER: ItemType[] = ["task", "thought", "link", "image", "file"];

// ─── Collapsible group ────────────────────────────────────────────────────────

function ItemGroup({
  label,
  items,
  onOpen,
  onOpenLinked,
}: {
  label: string;
  items: Item[];
  onOpen: (item: Item) => void;
  onOpenLinked: (item: Item) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mb-3 flex items-center gap-2 text-left"
      >
        {expanded ? (
          <ChevronDown className="size-3.5 text-ink-faint" />
        ) : (
          <ChevronRight className="size-3.5 text-ink-faint" />
        )}
        <span className="font-semibold text-ink-2 text-sm">{label}</span>
        <span className="rounded-[5px] bg-fill px-1.5 py-0.5 font-mono text-ink-dim text-[10px]">
          {items.length}
        </span>
      </button>

      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          expanded ? "max-h-[9999px] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="columns-1 gap-3 sm:columns-2 lg:columns-3" style={{ columnGap: "12px" }}>
          {items.map((item) => (
            <div key={item.id} className="mb-3">
              <ItemCard item={item} onOpen={() => onOpen(item)} onOpenLinked={onOpenLinked} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[12px] border border-dashed border-raise px-6 py-20 text-center">
      <Icons.layout className="size-10 text-line-max" />
      <p className="font-semibold text-ink-2">No items yet</p>
      <p className="max-w-sm text-ink-dim text-sm">
        Use quick capture to add thoughts, tasks, links, and more to this space.
      </p>
    </div>
  );
}

// ─── Recent mode ──────────────────────────────────────────────────────────────

function RecentMode() {
  const { activeItems } = useEngramStore();
  const { openDetail, openNoteEditor } = useUIStore();

  const handleOpen = useCallback(
    (item: Item) => {
      if (item.type === "thought") openNoteEditor(item.id);
      else openDetail(item.id);
    },
    [openDetail, openNoteEditor],
  );

  const sorted = [...activeItems].sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  );

  if (sorted.length === 0) return <EmptyState />;

  return (
    <div>
      <p className="mb-4 font-bold text-done text-[11px] uppercase tracking-widest">
        Recent — {sorted.length} item{sorted.length !== 1 ? "s" : ""}
      </p>
      <div className="columns-1 gap-3 sm:columns-2 lg:columns-3" style={{ columnGap: "12px" }}>
        {sorted.map((item) => (
          <div key={item.id} className="mb-3">
            <ItemCard item={item} onOpen={() => handleOpen(item)} onOpenLinked={handleOpen} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Type mode ────────────────────────────────────────────────────────────────

function TypeMode() {
  const { activeItems } = useEngramStore();
  const { openDetail, openNoteEditor } = useUIStore();

  const handleOpen = useCallback(
    (item: Item) => {
      if (item.type === "thought") openNoteEditor(item.id);
      else openDetail(item.id);
    },
    [openDetail, openNoteEditor],
  );

  if (activeItems.length === 0) return <EmptyState />;

  return (
    <div className="space-y-6">
      {TYPE_ORDER.map((type) => {
        const items = activeItems.filter((i) => i.type === type);
        if (items.length === 0) return null;
        return (
          <ItemGroup
            key={type}
            label={TYPE_LABELS[type]}
            items={items}
            onOpen={handleOpen}
            onOpenLinked={handleOpen}
          />
        );
      })}
    </div>
  );
}

// ─── Tag mode ─────────────────────────────────────────────────────────────────

function TagMode() {
  const { activeItems } = useEngramStore();
  const { openDetail, openNoteEditor } = useUIStore();

  const handleOpen = useCallback(
    (item: Item) => {
      if (item.type === "thought") openNoteEditor(item.id);
      else openDetail(item.id);
    },
    [openDetail, openNoteEditor],
  );

  if (activeItems.length === 0) return <EmptyState />;

  // Collect tags; items may appear under multiple tags
  const tagMap = new Map<string, Item[]>();
  for (const item of activeItems) {
    if (!item.tags || item.tags.length === 0) {
      const noTag = tagMap.get("__notag__") ?? [];
      noTag.push(item);
      tagMap.set("__notag__", noTag);
    } else {
      for (const tag of item.tags) {
        const bucket = tagMap.get(tag) ?? [];
        bucket.push(item);
        tagMap.set(tag, bucket);
      }
    }
  }

  const sortedTags = [...tagMap.keys()].sort((a, b) => {
    if (a === "__notag__") return 1;
    if (b === "__notag__") return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-6">
      {sortedTags.map((tag) => {
        const items = tagMap.get(tag) ?? [];
        return (
          <ItemGroup
            key={tag}
            label={tag === "__notag__" ? "No tag" : `#${tag}`}
            items={items}
            onOpen={handleOpen}
            onOpenLinked={handleOpen}
          />
        );
      })}
    </div>
  );
}

// ─── Main BoardView ───────────────────────────────────────────────────────────

export function BoardView() {
  const { activeSpace } = useEngramStore();
  const [groupBy, setGroupBy] = useState<GroupByMode>("recent");

  const subtitle =
    groupBy === "type"
      ? "Items grouped by type."
      : groupBy === "tag"
        ? "Items grouped by tag. Items with multiple tags appear in each."
        : "All items sorted by last update.";

  return (
    <section className="h-full overflow-y-auto bg-base px-8 py-10 text-white md:px-16 lg:px-24">
      <div className="mx-auto max-w-[1100px]">
        {/* ── Header ── */}
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h2
              className="stagger-item flex items-center gap-3 font-bold text-3xl"
              style={{ animationDelay: "0ms" }}
            >
              <Icons.layout className="size-7 text-brand-glow" />
              {activeSpace?.name ?? "Space"}
            </h2>
            <p
              className="stagger-item mt-3 max-w-2xl text-ink-3"
              style={{ animationDelay: "40ms" }}
            >
              {subtitle}
            </p>
          </div>

          {/* View toggle */}
          <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as GroupByMode)}>
            <TabsList className="rounded-[8px] bg-fill p-1">
              <TabsTrigger
                value="recent"
                className="h-8 rounded-[6px] px-3 text-ink-muted data-active:bg-raise data-active:text-white"
              >
                Recent
              </TabsTrigger>
              <TabsTrigger
                value="type"
                className="h-8 rounded-[6px] px-3 text-ink-muted data-active:bg-raise data-active:text-white"
              >
                By type
              </TabsTrigger>
              <TabsTrigger
                value="tag"
                className="h-8 rounded-[6px] px-3 text-ink-muted data-active:bg-raise data-active:text-white"
              >
                By tag
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* ── Content ── */}
        <div className="mt-9">
          {groupBy === "recent" && <RecentMode />}
          {groupBy === "type" && <TypeMode />}
          {groupBy === "tag" && <TagMode />}
        </div>
      </div>
    </section>
  );
}
