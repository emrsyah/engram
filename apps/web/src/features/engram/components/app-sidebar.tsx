"use client";

import { Button } from "@alphonse/ui/components/button";
import { cn } from "@alphonse/ui/lib/utils";

import { Icons } from "./icons";
import { useEngramStore } from "../store";
import type { EngramView, Item } from "../types";

const viewItems: { view: EngramView; label: string; icon: keyof typeof Icons; badge?: string }[] = [
  { view: "canvas", label: "Canvas", icon: "layout" },
  { view: "timeline", label: "Timeline", icon: "calendar", badge: "3" },
  { view: "priorities", label: "Priorities", icon: "flag", badge: "*" },
];

export function AppSidebar() {
  const { activeView, setActiveView, spaces, activeSpaceId, setActiveSpace, recentItems } =
    useEngramStore();

  return (
    <aside className="hidden w-[252px] shrink-0 border-[#292622] border-r bg-[#0b0b0a] text-[#c7bfb4] md:flex md:flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <div className="flex items-center gap-3 font-bold text-lg text-white">
          <Icons.sparkles className="size-4 text-[#9b88ff]" />
          Engram
        </div>
        <Button variant="ghost" size="icon-xs" className="text-[#706a62]">
          <Icons.chevronLeft className="size-4" />
        </Button>
      </div>

      <nav className="space-y-1 px-3">
        {viewItems.map(({ view, label, icon, badge }) => {
          const Icon = Icons[icon];
          return (
            <button
              type="button"
              key={view}
              onClick={() => setActiveView(view)}
              className={cn(
                "flex h-[36px] w-full items-center justify-between rounded-[7px] px-3 py-2 text-left text-sm transition",
                activeView === view
                  ? "bg-[#22201f] text-white"
                  : "text-[#b7afa5] hover:bg-[#171614] hover:text-white",
              )}
            >
              <span className="flex items-center gap-3">
                <Icon className={cn("size-4", activeView === view && "text-[#9b88ff]")} />
                <span className="font-semibold">{label}</span>
              </span>
              {badge ? (
                <span className={cn("text-xs", badge === "*" ? "text-[#f2765f]" : "text-[#8c857b]")}>
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="mt-8 px-3">
        <p className="mb-2 px-3 text-[11px] font-bold tracking-[0.14em] text-[#736c63] uppercase">
          Spaces
        </p>
        <div className="space-y-1">
          {spaces.map((space) => (
            <button
              type="button"
              key={space.id}
              onClick={() => setActiveSpace(space.id)}
              className={cn(
                "flex h-[36px] w-full items-center gap-3 rounded-[7px] px-3 py-2 text-left text-sm transition",
                activeSpaceId === space.id
                  ? "bg-[#22201f] font-semibold text-white"
                  : "text-[#b7afa5] hover:bg-[#171614] hover:text-white",
              )}
            >
              {space.icon === "briefcase" ? (
                <Icons.briefcase className="size-4" />
              ) : space.icon === "book" ? (
                <Icons.book className="size-4" />
              ) : (
                <Icons.sparkles className="size-4 text-[#9b88ff]" />
              )}
              {space.name}
            </button>
          ))}
          <button
            type="button"
            className="flex h-[36px] w-full items-center gap-3 rounded-[7px] px-3 py-2 text-left text-sm text-[#8c857b]"
          >
            <Icons.plus className="size-4" />
            New space
          </button>
        </div>
      </div>

      <div className="mt-8 min-h-0 px-3">
        <p className="mb-2 px-3 text-[11px] font-bold tracking-[0.14em] text-[#736c63] uppercase">
          Recent
        </p>
        <div className="space-y-1">
          {recentItems.map((item) => (
            <RecentItem key={item.id} item={item} />
          ))}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between px-5 py-5 text-[#7f776d]">
        <Icons.rotate className="size-4" />
        <Icons.settings className="size-4" />
        <Icons.info className="size-4" />
      </div>
    </aside>
  );
}

function RecentItem({ item }: { item: Item }) {
  const { jumpToItem } = useEngramStore();
  const label = item.title ?? item.text ?? item.url ?? item.source ?? "Untitled";
  const Icon = item.type === "task" ? Icons.check : item.type === "link" ? Icons.link : Icons.file;

  return (
    <button
      type="button"
      onClick={() => jumpToItem(item.id)}
      className="flex w-full items-center gap-3 overflow-hidden rounded-[7px] px-3 py-2 text-left text-sm text-[#b7afa5] hover:bg-[#171614] hover:text-white"
    >
      <Icon className="size-4 shrink-0 text-[#8b8378]" />
      <span className="truncate">{label}</span>
    </button>
  );
}
