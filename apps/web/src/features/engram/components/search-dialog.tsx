"use client";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@alphonse/ui/components/command";
import { cn } from "@alphonse/ui/lib/utils";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { NAV_VIEWS, SPACE_ICONS, type SpaceIconKey } from "../nav";
import { useEngramStore } from "../store";
import type { Accent, ItemType } from "../types";
import { useUIStore } from "../ui-store";
import { Icons } from "./icons";

const ACCENT_DOT: Record<Accent, string> = {
  violet: "bg-brand",
  gold: "bg-honey",
  teal: "bg-teal",
  red: "bg-coral",
  blue: "bg-blue",
};

const TYPE_BADGE: Record<ItemType, { label: string; color: string }> = {
  thought: { label: "Thought", color: "bg-brand/20 text-brand-soft" },
  task: { label: "Task", color: "bg-honey/20 text-p2-ink" },
  link: { label: "Link", color: "bg-blue/20 text-p3-ink" },
  image: { label: "Image", color: "bg-teal/20 text-p3-ink" },
  file: { label: "File", color: "bg-ink-muted/20 text-ink-3" },
};

export function SearchDialog() {
  const { searchItems, jumpToItem, spaces, setActiveSpace } = useEngramStore();
  const { searchOpen, closeSearch, openDetail } = useUIStore();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const trimmed = query.trim().toLowerCase();
  const itemResults = trimmed ? searchItems(trimmed) : [];

  const featureResults = trimmed
    ? NAV_VIEWS.filter((v) => v.label.toLowerCase().includes(trimmed))
    : NAV_VIEWS;

  const spaceResults = trimmed
    ? spaces.filter((s) => s.name.toLowerCase().includes(trimmed))
    : spaces.sort((a, b) => a.sortOrder - b.sortOrder);

  const hasAny = featureResults.length > 0 || spaceResults.length > 0 || itemResults.length > 0;

  return (
    <CommandDialog
      open={searchOpen}
      onOpenChange={(open) => {
        if (!open) {
          setQuery("");
          closeSearch();
        }
      }}
    >
      <Command shouldFilter={false}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search features, groups, or items..."
        />
        <CommandList>
          {!hasAny && <CommandEmpty>No results found</CommandEmpty>}

          {/* ── Features ── */}
          {featureResults.length > 0 && (
            <CommandGroup heading="Features">
              {featureResults.map(({ href, label, icon }) => {
                const Icon = Icons[icon];
                return (
                  <CommandItem
                    key={href}
                    value={`feature-${href}`}
                    onSelect={() => {
                      setQuery("");
                      closeSearch();
                      router.push(href as Route<string>);
                    }}
                  >
                    <span className="grid size-5 place-items-center rounded-[5px] bg-brand-glow/15">
                      <Icon className="size-3 text-brand-glow" />
                    </span>
                    <span className="flex-1 min-w-0 font-semibold text-ink">{label}</span>
                    <span className="ml-auto shrink-0 rounded-[4px] bg-brand-glow/10 px-1.5 py-0.5 font-mono text-[10px] text-brand-glow">
                      View
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {/* ── Groups ── */}
          {spaceResults.length > 0 && (
            <CommandGroup heading="Groups">
              {spaceResults.map((space) => {
                const iconKey = (space.icon in SPACE_ICONS ? space.icon : "sparkles") as SpaceIconKey;
                const Icon = Icons[SPACE_ICONS[iconKey]];
                const dotColor = ACCENT_DOT[space.color ?? "violet"];
                return (
                  <CommandItem
                    key={space.id}
                    value={`space-${space.id}`}
                    onSelect={() => {
                      setQuery("");
                      closeSearch();
                      setActiveSpace(space.id);
                      router.push("/tasks" as Route<string>);
                    }}
                  >
                    <span className="grid size-5 place-items-center rounded-[5px] bg-line-soft">
                      <Icon className="size-3 text-ink-3" />
                    </span>
                    <span className="flex-1 min-w-0 font-semibold text-ink">{space.name}</span>
                    <span className={cn("ml-1.5 size-2 shrink-0 rounded-full", dotColor)} />
                    <span className="ml-auto shrink-0 rounded-[4px] bg-line-soft px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
                      Group
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {/* ── Items ── */}
          {itemResults.length > 0 && (
            <CommandGroup heading="Items">
              {itemResults.map((item) => {
                const label = item.title ?? item.text ?? item.url ?? item.source ?? "Untitled";
                const detail =
                  item.text && item.title ? item.text : (item.url ?? item.caption ?? item.source);
                const badge = TYPE_BADGE[item.type];
                return (
                  <CommandItem
                    key={item.id}
                    value={`item-${item.id}`}
                    onSelect={() => {
                      setQuery("");
                      closeSearch();
                      router.push((item.type === "task" ? "/tasks" : "/library") as Route<string>);
                      if (item.type === "task") jumpToItem(item.id);
                      else openDetail(item.id);
                    }}
                  >
                    <span className={cn("mt-0.5 size-2 shrink-0 rounded-[2px]", ACCENT_DOT[item.accent])} />
                    <span className="flex-1 min-w-0">
                      <span className="block truncate font-semibold text-ink">{label}</span>
                      {detail ? (
                        <span className="mt-0.5 block truncate text-ink-muted text-xs">{detail}</span>
                      ) : null}
                    </span>
                    <span className={cn("ml-auto shrink-0 self-start rounded-[4px] px-1.5 py-0.5 text-[10px] font-medium", badge.color)}>
                      {badge.label}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
