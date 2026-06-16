"use client";

import { Button } from "@alphonse/ui/components/button";
import { Calendar } from "@alphonse/ui/components/calendar";
import { Checkbox } from "@alphonse/ui/components/checkbox";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "@alphonse/ui/components/popover";
import { cn } from "@alphonse/ui/lib/utils";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarIcon } from "./icons";
import { type KeyboardEvent, useRef, useState } from "react";

import { TagChip } from "./chips";
import { Icons } from "./icons";
import { LinkifiedText } from "./linkified-text";
import { useEngramStore } from "../store";
import { useUIStore } from "../ui-store";
import type { ChecklistItem, Item, Priority } from "../types";

export function ItemDetailPanel() {
  const { detailItemId, closeDetail, openNoteEditor } = useUIStore();
  const {
    items,
    links,
    activeItems,
    updateItem,
    removeItem,
    addChecklistItem,
    toggleChecklistItem,
    removeChecklistItem,
    reorderChecklistItems,
    addItemTag,
    removeItemTag,
    allTags,
    backlinksForItem,
    connectItems,
    deleteLink,
  } = useEngramStore();
  const [newText, setNewText] = useState("");
  const [newTag, setNewTag] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [connSearch, setConnSearch] = useState("");
  const [connDropdownOpen, setConnDropdownOpen] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const connInputRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const item = items.find((i) => i.id === detailItemId);
  const isOpen = !!item;

  function handleAdd() {
    const text = newText.trim();
    if (!text || !item) return;
    addChecklistItem(item.id, text);
    setNewText("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleAdd();
    if (e.key === "Escape") closeDetail();
  }

  function handleDelete() {
    if (!item) return;
    removeItem(item.id);
    closeDetail();
  }

  function updateChecklistText(checklistItemId: string, text: string) {
    if (!item) return;
    updateItem(item.id, {
      checklistItems: checklist.map((ci) =>
        ci.id === checklistItemId ? { ...ci, text } : ci,
      ),
    });
  }

  const checklist = item?.checklistItems ?? [];
  const doneCount = checklist.filter((ci) => ci.done).length;
  const title = item?.title?.trim() || item?.url || "Untitled";
  const body = item?.text?.trim();
  const progress = checklist.length > 0 ? Math.round((doneCount / checklist.length) * 100) : 0;

  // Connections derived data
  const linkedItems = item ? backlinksForItem(item.id) : [];
  const linkedIds = new Set(linkedItems.map((i) => i.id));

  // Candidates for adding a connection: same space, not self, not already linked
  const connCandidates = item
    ? activeItems.filter(
        (i) => i.id !== item.id && i.spaceId === item.spaceId && !linkedIds.has(i.id),
      )
    : [];

  const filteredCandidates = connSearch.trim()
    ? connCandidates.filter((i) => {
        const label = (i.title?.trim() || i.text?.trim() || i.url || "").toLowerCase();
        return label.includes(connSearch.toLowerCase());
      })
    : connCandidates;

  function findLinkId(targetId: string): string | undefined {
    if (!item) return undefined;
    return links.find(
      (l) =>
        (l.fromItemId === item.id && l.toItemId === targetId) ||
        (l.fromItemId === targetId && l.toItemId === item.id),
    )?.id;
  }

  function handleRemoveConnection(targetId: string) {
    const linkId = findLinkId(targetId);
    if (linkId) deleteLink(linkId);
  }

  function handleAddConnection(target: Item) {
    if (!item) return;
    connectItems(item.id, target.id);
    setConnSearch("");
    setConnDropdownOpen(false);
  }

  function handleChecklistDragEnd(event: DragEndEvent) {
    if (!item || event.active.id === event.over?.id) return;
    const oldIndex = checklist.findIndex((ci) => ci.id === event.active.id);
    const newIndex = checklist.findIndex((ci) => ci.id === event.over?.id);
    if (oldIndex < 0 || newIndex < 0) return;
    reorderChecklistItems(item.id, arrayMove(checklist, oldIndex, newIndex));
  }

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={closeDetail} />
      )}

      <div
        className={cn(
          "fixed top-0 right-0 z-50 flex h-full w-[min(420px,92vw)] flex-col",
          "border-l border-surface bg-base shadow-2xl shadow-black/50",
          "transition-transform duration-200 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {item && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between border-b border-surface px-5 py-4">
              <div className="min-w-0 flex-1 pr-3">
                <p className="font-mono text-ink-ghost text-[10px] uppercase tracking-widest">
                  {item.type}
                </p>
                {item.type === "task" ? (
                  <input
                    value={item.title ?? ""}
                    onChange={(event) => updateItem(item.id, { title: event.target.value })}
                    placeholder="Untitled task"
                    className="mt-2 w-full rounded-[6px] border border-transparent bg-transparent px-0 py-0 font-semibold text-ink text-lg leading-snug outline-none placeholder:text-line-strong focus:border-line-2 focus:bg-sunken focus:px-2 focus:py-1"
                  />
                ) : (
                  <p className="mt-2 break-words font-semibold text-ink text-lg leading-snug">
                    {title}
                  </p>
                )}
                {item.type === "task" && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[10px] text-done uppercase tracking-wider">
                    <span>{item.done ? "Done" : "Open"}</span>
                    {checklist.length > 0 && <span>{doneCount}/{checklist.length} checklist</span>}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={closeDetail}
                className={cn(
                  "mt-0.5 grid size-7 shrink-0 place-items-center rounded-[5px]",
                  "text-ink-ghost hover:bg-surface hover:text-ink-2",
                  "transition-colors duration-100",
                )}
              >
                <Icons.x className="size-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {item.type === "task" && (
                <>
                  <section className="mb-5 rounded-[7px] border border-surface bg-sunken px-4 py-3">
                    <p className="mb-2 font-mono text-ink-ghost text-[10px] uppercase tracking-widest">
                      Detail
                    </p>
                    <textarea
                      value={item.text ?? ""}
                      onChange={(event) => updateItem(item.id, { text: event.target.value })}
                      placeholder="Add task notes..."
                      className="min-h-20 w-full resize-none bg-transparent text-ink-2 text-sm leading-6 outline-none placeholder:text-line-strong"
                    />
                  </section>

                  <ExtractedLinks
                    texts={[item.title, item.text, ...checklist.map((ci) => ci.text)]}
                  />

                  <section className="mb-5 rounded-[7px] border border-surface bg-sunken p-4">
                    <p className="mb-3 font-mono text-ink-ghost text-[10px] uppercase tracking-widest">
                      Schedule
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <DetailPriorityButtons
                        priority={item.priority}
                        onChange={(priority) => updateItem(item.id, { priority })}
                      />
                      <DetailDueButton
                        dueAt={item.dueAt}
                        onChange={(dueAt) => updateItem(item.id, { dueAt })}
                      />
                    </div>
                  </section>

                  <section className="mb-5 rounded-[7px] border border-surface bg-sunken p-4">
                    <p className="mb-3 font-mono text-ink-ghost text-[10px] uppercase tracking-widest">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(item.tags ?? []).map((tag) => (
                        <TagChip key={tag} tag={tag} onRemove={() => removeItemTag(item.id, tag)} />
                      ))}
                    </div>
                    <div className="relative mt-2">
                      <input
                        ref={tagInputRef}
                        type="text"
                        value={newTag}
                        placeholder="Add tag…"
                        onChange={(e) => {
                          const val = e.target.value.replace(/^#/, "").replace(/\s/g, "-");
                          setNewTag(val);
                          setTagSuggestions(
                            val.length > 0
                              ? allTags.filter((t) => t.includes(val) && !item.tags?.includes(t)).slice(0, 5)
                              : [],
                          );
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newTag.trim()) {
                            addItemTag(item.id, newTag.trim().toLowerCase());
                            setNewTag("");
                            setTagSuggestions([]);
                          }
                          if (e.key === "Escape") { setNewTag(""); setTagSuggestions([]); }
                        }}
                        className="w-full rounded-[6px] border border-surface bg-clay px-3 py-1.5 text-sm text-ink placeholder:text-line-strong focus:border-line-strong focus:outline-none"
                      />
                      {tagSuggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-[6px] border border-surface bg-clay py-1 shadow-lg">
                          {tagSuggestions.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => {
                                addItemTag(item.id, tag);
                                setNewTag("");
                                setTagSuggestions([]);
                                tagInputRef.current?.focus();
                              }}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-blue text-sm hover:bg-surface"
                            >
                              <span className="opacity-60">#</span>{tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>

                  <div className="mb-4 rounded-[7px] border border-surface bg-sunken p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-mono text-ink-ghost text-[10px] uppercase tracking-widest">
                        Checklist
                      </p>
                      {checklist.length > 0 && (
                        <span className="font-mono text-ink-ghost text-[10px]">
                          {progress}%
                        </span>
                      )}
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface">
                      <div
                        className="h-full rounded-full bg-amber transition-[width] duration-200"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <DndContext id="checklist-dnd" sensors={sensors} onDragEnd={handleChecklistDragEnd}>
                    <SortableContext items={checklist.map((ci) => ci.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-0.5">
                        {checklist.map((ci) => (
                          <SortableChecklistRow
                            key={ci.id}
                            item={ci}
                            onToggle={() => toggleChecklistItem(item.id, ci.id)}
                            onTextChange={(text) => updateChecklistText(ci.id, text)}
                            onRemove={() => removeChecklistItem(item.id, ci.id)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>

                  {checklist.length === 0 && (
                    <p className="rounded-[7px] border border-dashed border-surface px-3 py-4 text-ink-ghost text-sm">
                      No checklist items yet.
                    </p>
                  )}

                  {/* Add input */}
                  <div className="mt-4 flex gap-2">
                    <input
                      type="text"
                      value={newText}
                      onChange={(e) => setNewText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Add item…"
                      className={cn(
                        "flex-1 rounded-[6px] border border-surface bg-clay",
                        "px-3 py-1.5 text-sm text-ink",
                        "placeholder:text-line-strong",
                        "focus:border-line-strong focus:outline-none",
                        "transition-colors duration-100",
                      )}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleAdd}
                      disabled={!newText.trim()}
                      className="border-line-2 bg-clay text-ink-2 hover:bg-fill disabled:opacity-40"
                    >
                      Add
                    </Button>
                  </div>
                </>
              )}

              {item.type === "thought" && (
                <div className="space-y-4">
                  {body ? (
                    <section className="rounded-[7px] border border-surface bg-sunken px-4 py-3">
                      <p className="mb-2 font-mono text-ink-ghost text-[10px] uppercase tracking-widest">
                        Content
                      </p>
                      <p className="whitespace-pre-wrap text-ink-2 text-sm leading-6">
                        <LinkifiedText text={body} />
                      </p>
                    </section>
                  ) : (
                    <p className="rounded-[7px] border border-dashed border-surface px-3 py-4 text-ink-ghost text-sm">
                      No content yet.
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openNoteEditor(item.id)}
                    className="w-full border-line-2 bg-clay text-ink-2 hover:bg-fill"
                  >
                    <Icons.book className="size-3.5" />
                    Open editor
                  </Button>
                </div>
              )}

              {item.type === "link" && (
                <>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-teal text-sm hover:underline"
                    >
                      {item.url}
                    </a>
                  )}
                  {item.text && (
                    <p className="mt-3 text-sm text-ink-2 leading-6">
                      <LinkifiedText text={item.text} />
                    </p>
                  )}
                </>
              )}

              {/* Connections section — shown for all item types */}
              <section className="mt-5 rounded-[7px] border border-surface bg-sunken p-4">
                <p className="mb-3 font-mono text-ink-ghost text-[10px] uppercase tracking-widest">
                  Connections
                </p>

                {/* Existing linked items */}
                {linkedItems.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {linkedItems.map((linked) => {
                      const label = linked.title?.trim() || linked.text?.trim() || linked.url || "Untitled";
                      return (
                        <span
                          key={linked.id}
                          className="flex items-center gap-1 rounded-[5px] border border-line-max bg-brand-surface py-0.5 pr-1 pl-2 text-[11px] text-brand-soft"
                        >
                          <Icons.link className="size-2.5 shrink-0 text-brand-glow" />
                          <span className="max-w-[160px] truncate">{label}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveConnection(linked.id)}
                            className="ml-0.5 flex size-4 items-center justify-center rounded-[3px] text-brand hover:bg-p3 hover:text-white"
                            aria-label={`Remove link to ${label}`}
                          >
                            <Icons.x className="size-2.5" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {linkedItems.length === 0 && (
                  <p className="mb-3 text-line-max text-xs">No connections yet.</p>
                )}

                {/* Add connection — searchable dropdown */}
                {connCandidates.length > 0 && (
                  <div className="relative">
                    <input
                      ref={connInputRef}
                      type="text"
                      value={connSearch}
                      placeholder="Add connection…"
                      onChange={(e) => {
                        setConnSearch(e.target.value);
                        setConnDropdownOpen(true);
                      }}
                      onFocus={() => setConnDropdownOpen(true)}
                      onBlur={() => requestAnimationFrame(() => setConnDropdownOpen(false))}
                      className="w-full rounded-[6px] border border-surface bg-clay px-3 py-1.5 text-sm text-ink placeholder:text-line-strong focus:border-line-strong focus:outline-none"
                    />
                    {connDropdownOpen && filteredCandidates.length > 0 && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-[6px] border border-surface bg-clay py-1 shadow-lg">
                        {filteredCandidates.slice(0, 8).map((candidate) => {
                          const label = candidate.title?.trim() || candidate.text?.trim() || candidate.url || "Untitled";
                          return (
                            <button
                              key={candidate.id}
                              type="button"
                              onMouseDown={(e) => { e.preventDefault(); handleAddConnection(candidate); }}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink-2 hover:bg-surface"
                            >
                              <Icons.link className="size-3 shrink-0 text-done" />
                              <span className="min-w-0 flex-1 truncate">{label}</span>
                              <span className="shrink-0 font-mono text-[10px] text-ink-ghost uppercase">{candidate.type}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {connCandidates.length === 0 && (
                  <p className="text-line-strong text-xs">All items in this space are already linked.</p>
                )}
              </section>
            </div>

            {/* Footer */}
            <div className="border-t border-surface px-5 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleDelete}
                className={cn(
                  "w-full border-line-2 bg-panel text-p1-ink",
                  "hover:border-p1 hover:bg-clay",
                )}
              >
                <Icons.trash className="size-3.5" />
                Delete item
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function ExtractedLinks({ texts }: { texts: Array<string | undefined> }) {
  const links = Array.from(new Set(texts.flatMap((text) => extractUrls(text ?? ""))));
  if (links.length === 0) return null;

  return (
    <section className="mb-5 rounded-[7px] border border-surface bg-sunken px-4 py-3">
      <p className="mb-2 font-mono text-ink-ghost text-[10px] uppercase tracking-widest">
        Links
      </p>
      <div className="space-y-1.5">
        {links.map((link) => {
          const href = link.startsWith("http") ? link : `https://${link}`;
          return (
            <a
              key={link}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-teal text-sm underline decoration-teal/35 underline-offset-2 hover:text-p3-ink"
            >
              {link}
            </a>
          );
        })}
      </div>
    </section>
  );
}

function extractUrls(text: string) {
  return text.match(/https?:\/\/[^\s<]+|www\.[^\s<]+/gi) ?? [];
}

function DetailPriorityButtons({
  priority,
  onChange,
}: {
  priority?: Priority;
  onChange: (priority: Priority) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {([1, 2, 3] as Priority[]).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={cn(
            "h-7 rounded-[6px] border px-2 font-bold text-[11px] transition-colors",
            priority === p
              ? "border-line-max bg-line text-ink"
              : "border-line-soft bg-base text-done hover:text-ink-2",
          )}
        >
          P{p}
        </button>
      ))}
    </div>
  );
}

function SortableChecklistRow({
  item,
  onToggle,
  onTextChange,
  onRemove,
}: {
  item: ChecklistItem;
  onToggle: () => void;
  onTextChange: (text: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group flex items-start gap-2 rounded-[6px] border border-transparent px-2 py-2 hover:border-surface hover:bg-clay",
        isDragging && "border-line-max bg-surface shadow-lg",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="mt-0.5 grid size-5 shrink-0 cursor-grab place-items-center rounded-[4px] text-line-max hover:text-ink-muted active:cursor-grabbing"
        aria-label="Reorder checklist item"
      >
        <GripIcon />
      </button>
      <Checkbox
        checked={item.done}
        onCheckedChange={onToggle}
        className="mt-0.5 rounded-[4px]"
      />
      <input
        value={item.text}
        onChange={(event) => onTextChange(event.target.value)}
        className={cn(
          "min-w-0 flex-1 rounded-[5px] border border-transparent bg-transparent px-1 py-0 text-sm text-ink-2 outline-none focus:border-line-2 focus:bg-sunken",
          item.done && "text-line-max line-through",
        )}
      />
      <button
        type="button"
        onClick={onRemove}
        className={cn(
          "invisible grid size-5 place-items-center rounded-[4px]",
          "text-line-strong hover:text-ink-muted",
          "group-hover:visible",
        )}
      >
        <Icons.x className="size-3" />
      </button>
    </div>
  );
}

function GripIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <circle cx="4" cy="3" r="1" />
      <circle cx="8" cy="3" r="1" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="8" cy="6" r="1" />
      <circle cx="4" cy="9" r="1" />
      <circle cx="8" cy="9" r="1" />
    </svg>
  );
}

function DetailDueButton({
  dueAt,
  onChange,
}: {
  dueAt?: string;
  onChange: (dueAt?: string) => void;
}) {
  const dueDate = dueAt ? parseDueDate(dueAt) : undefined;
  const dueHasTime = hasDueTime(dueAt);

  return (
    <PopoverRoot>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-[6px] border px-2 font-mono font-bold text-[11px] transition-colors",
              dueAt
                ? "border-line-strong bg-line-strong text-honey"
                : "border-line-soft bg-base text-done hover:text-ink-2",
            )}
          />
        }
      >
        <CalendarIcon className="size-3" />
        {dueAt && dueDate ? formatDueShort(dueDate, dueHasTime) : "Due date"}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={dueDate}
          onSelect={(date) => {
            if (!date) {
              onChange(undefined);
              return;
            }
            const next = new Date(date);
            if (dueHasTime && dueDate) {
              next.setHours(dueDate.getHours(), dueDate.getMinutes(), 0, 0);
              onChange(next.toISOString());
              return;
            }
            onChange(toDateInputValue(next));
          }}
        />
        <div className="border-surface border-t px-3 py-2">
          <label className="flex items-center justify-between gap-3 text-ink-muted text-xs">
            <span>Time</span>
            <input
              type="time"
              value={dueDate && dueHasTime ? toTimeInputValue(dueDate) : ""}
              onChange={(event) => {
                if (!event.target.value) {
                  if (dueDate) onChange(toDateInputValue(dueDate));
                  return;
                }
                const [hours, minutes] = event.target.value.split(":").map(Number);
                const next = dueDate ? new Date(dueDate) : new Date();
                next.setHours(hours ?? 0, minutes ?? 0, 0, 0);
                onChange(next.toISOString());
              }}
              className="h-7 rounded-[5px] border border-line-2 bg-base px-2 font-mono text-ink text-xs outline-none focus:border-line-max"
            />
          </label>
          <p className="mt-1.5 text-ink-ghost text-[10px]">Indonesia time (WIB)</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={!dueDate || !dueHasTime}
              onClick={() => dueDate && onChange(toDateInputValue(dueDate))}
              className="text-ink-muted text-xs hover:text-ink-2 disabled:text-line-strong"
            >
              Clear time
            </button>
            <button
              type="button"
              disabled={!dueAt}
              onClick={() => onChange(undefined)}
              className="text-ink-muted text-xs hover:text-ink-2 disabled:text-line-strong"
            >
              Clear due
            </button>
          </div>
        </div>
      </PopoverContent>
    </PopoverRoot>
  );
}

function formatDueShort(date: Date, hasTime: boolean) {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const time = hasTime ? formatIndonesiaTime(date) : "";

  if (date.toDateString() === today.toDateString()) return hasTime ? `Today ${time}` : "Today";
  if (date.toDateString() === tomorrow.toDateString()) return hasTime ? `Tmrw ${time}` : "Tmrw";
  const day = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return hasTime ? `${day} ${time}` : day;
}

function formatIndonesiaTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

function toTimeInputValue(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function hasDueTime(dueAt?: string) {
  return !!dueAt && dueAt.includes("T");
}

function parseDueDate(dueAt: string) {
  if (hasDueTime(dueAt)) return new Date(dueAt);
  const [year, month, day] = dueAt.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
