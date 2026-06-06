"use client";

import { Input } from "@alphonse/ui/components/input";
import { useEffect, useState } from "react";

import { Icons } from "./icons";
import { useEngramStore } from "../store";

export function SearchDialog() {
  const { searchOpen, closeSearch, searchItems, jumpToItem } = useEngramStore();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (searchOpen) {
      setQuery("");
    }
  }, [searchOpen]);

  if (!searchOpen) {
    return null;
  }

  const results = searchItems(query);

  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-black/35 pt-[16vh] backdrop-blur-sm">
      <div className="mx-auto w-[min(620px,calc(100vw-32px))] rounded-[8px] border border-[#3b352f] bg-[#211e1a] shadow-2xl">
        <div className="flex items-center gap-3 border-[#332e28] border-b px-4 py-3">
          <Icons.search className="size-4 text-[#8d857b]" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                closeSearch();
              }
              if (event.key === "Enter" && results[0]) {
                jumpToItem(results[0].id);
              }
            }}
            placeholder="Search thoughts, tasks, links, files"
            className="h-10 border-0 bg-transparent text-base text-white focus-visible:ring-0"
          />
          <button type="button" className="text-[#8d857b]" onClick={closeSearch}>
            Esc
          </button>
        </div>

        <div className="max-h-[360px] overflow-y-auto p-2">
          {results.length ? (
            results.map((item) => {
              const label = item.title ?? item.text ?? item.url ?? item.source ?? "Untitled";
              const detail = item.text && item.title ? item.text : item.url ?? item.caption ?? item.source;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => jumpToItem(item.id)}
                  className="flex w-full items-start gap-3 rounded-[7px] px-3 py-3 text-left hover:bg-[#2b2722]"
                >
                  <span className="mt-1 size-2 rounded-[2px] bg-[#9b88ff]" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-[#f0ebe3]">{label}</span>
                    {detail ? <span className="mt-1 block truncate text-[#8d857b] text-sm">{detail}</span> : null}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="px-3 py-8 text-center text-[#8d857b] text-sm">No matching items</div>
          )}
        </div>
      </div>
    </div>
  );
}
