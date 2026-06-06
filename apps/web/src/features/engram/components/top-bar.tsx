"use client";

import { Button } from "@alphonse/ui/components/button";
import { cn } from "@alphonse/ui/lib/utils";

import { Icons } from "./icons";
import { useEngramStore } from "../store";
import type { EngramView } from "../types";

const views: { view: EngramView; label: string; icon: keyof typeof Icons }[] = [
  { view: "canvas", label: "Canvas", icon: "layout" },
  { view: "timeline", label: "Timeline", icon: "calendar" },
  { view: "priorities", label: "Priorities", icon: "flag" },
];

export function TopBar() {
  const { activeView, setActiveView, activeSpace, activeItems, openSearch, openCapture } =
    useEngramStore();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-[#292622] border-b bg-[#171512] px-5">
      <div className="flex min-w-0 items-center gap-3">
        <Icons.layout className="size-4 text-[#8a8378]" />
        <h1 className="truncate font-bold text-white">{activeSpace?.name ?? "Mind"}</h1>
        <span className="text-[#776f65] text-sm">/ {activeItems.length} items</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden rounded-[8px] bg-[#23201d] p-1 lg:flex">
          {views.map(({ view, label, icon }) => {
            const Icon = Icons[icon];
            return (
              <button
                type="button"
                key={view}
                onClick={() => setActiveView(view)}
                className={cn(
                  "flex h-8 items-center gap-2 rounded-[6px] px-3 text-sm font-semibold transition",
                  activeView === view
                    ? "bg-[#312d28] text-white shadow-sm"
                    : "text-[#948c82] hover:text-white",
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={openSearch}
          className="hidden h-10 w-[260px] items-center justify-between rounded-[8px] border border-[#342f2a] bg-[#211f1c] px-3 text-[#8d857a] text-sm xl:flex"
        >
          <span className="flex items-center gap-2">
            <Icons.search className="size-4" />
            Search
          </span>
          <span className="rounded-[5px] bg-[#34302b] px-2 py-0.5 font-mono text-xs">Cmd+K</span>
        </button>

        <Button
          type="button"
          onClick={openCapture}
          className="h-10 rounded-[8px] bg-[#907ce8] px-4 font-bold text-[#17131f] hover:bg-[#a08ef2]"
        >
          <Icons.plus className="size-4" />
          Capture
          <span className="ml-1 font-mono text-xs opacity-70">N</span>
        </Button>
      </div>
    </header>
  );
}
