"use client";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@alphonse/ui/components/command";
import { useState } from "react";

import { useEngramStore } from "../store";
import { useUIStore } from "../ui-store";

export function SearchDialog() {
  const { searchItems, jumpToItem } = useEngramStore();
  const { searchOpen, closeSearch } = useUIStore();
  const [query, setQuery] = useState("");

  const results = searchItems(query);

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
          placeholder="Search thoughts, tasks, links, files"
        />
        <CommandList>
          <CommandEmpty>No matching items</CommandEmpty>
          {results.map((item) => {
            const label = item.title ?? item.text ?? item.url ?? item.source ?? "Untitled";
            const detail =
              item.text && item.title ? item.text : (item.url ?? item.caption ?? item.source);
            return (
              <CommandItem
                key={item.id}
                value={item.id}
                onSelect={() => {
                  setQuery("");
                  closeSearch();
                  jumpToItem(item.id);
                }}
              >
                <span className="mt-1 size-2 shrink-0 rounded-[2px] bg-[#9b88ff]" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-[#f0ebe3]">{label}</span>
                  {detail ? (
                    <span className="mt-1 block truncate text-[#8d857b] text-sm">{detail}</span>
                  ) : null}
                </span>
              </CommandItem>
            );
          })}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
