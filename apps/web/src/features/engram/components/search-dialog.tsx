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
  violet: "bg-[#907ce8]",
  gold: "bg-[#d9a82f]",
  teal: "bg-[#43b6a6]",
  red: "bg-[#e46f50]",
  blue: "bg-[#4aa5c8]",
};

const TYPE_BADGE: Record<ItemType, { label: string; color: string }> = {
  thought: { label: "Thought", color: "bg-[#907ce8]/20 text-[#c4b5fd]" },
  task: { label: "Task", color: "bg-[#d9a82f]/20 text-[#e5b83d]" },
  link: { label: "Link", color: "bg-[#4aa5c8]/20 text-[#58b8d8]" },
  image: { label: "Image", color: "bg-[#43b6a6]/20 text-[#7dd4c6]" },
  file: { label: "File", color: "bg-[#8d857b]/20 text-[#b0a99f]" },
};

export function SearchDialog() {
  const { searchItems, jumpToItem, spaces, setActiveSpace } = useEngramStore();
  const { searchOpen, closeSearch } = useUIStore();
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
          placeholder="Search features, spaces, or items…"
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
                    <span className="grid size-5 place-items-center rounded-[5px] bg-[#9b88ff]/15">
                      <Icon className="size-3 text-[#9b88ff]" />
                    </span>
                    <span className="flex-1 min-w-0 font-semibold text-[#f0ebe3]">{label}</span>
                    <span className="ml-auto shrink-0 rounded-[4px] bg-[#9b88ff]/10 px-1.5 py-0.5 font-mono text-[10px] text-[#9b88ff]">
                      View
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {/* ── Spaces ── */}
          {spaceResults.length > 0 && (
            <CommandGroup heading="Spaces">
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
                      router.push("/canvas" as Route<string>);
                    }}
                  >
                    <span className="grid size-5 place-items-center rounded-[5px] bg-[#2e2b26]">
                      <Icon className="size-3 text-[#b0a99f]" />
                    </span>
                    <span className="flex-1 min-w-0 font-semibold text-[#f0ebe3]">{space.name}</span>
                    <span className={cn("ml-1.5 size-2 shrink-0 rounded-full", dotColor)} />
                    <span className="ml-auto shrink-0 rounded-[4px] bg-[#2e2b26] px-1.5 py-0.5 font-mono text-[10px] text-[#8d857b]">
                      Space
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
                      jumpToItem(item.id);
                    }}
                  >
                    <span className={cn("mt-0.5 size-2 shrink-0 rounded-[2px]", ACCENT_DOT[item.accent])} />
                    <span className="flex-1 min-w-0">
                      <span className="block truncate font-semibold text-[#f0ebe3]">{label}</span>
                      {detail ? (
                        <span className="mt-0.5 block truncate text-[#8d857b] text-xs">{detail}</span>
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
