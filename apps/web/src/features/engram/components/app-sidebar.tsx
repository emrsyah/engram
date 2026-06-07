"use client";

import { Button, buttonVariants } from "@alphonse/ui/components/button";
import { cn } from "@alphonse/ui/lib/utils";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_VIEWS, SPACE_ICONS } from "../nav";
import { useEngramStore } from "../store";
import { useUIStore } from "../ui-store";
import type { Item } from "../types";
import { Icons } from "./icons";

const navItemClass = "h-[36px] w-full justify-between rounded-[7px] px-3 py-2 text-sm font-normal";

export function AppSidebar() {
  const pathname = usePathname();
  const { spaces, activeSpaceId, setActiveSpace, recentItems } = useEngramStore();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <aside
      className={cn(
        "hidden shrink-0 border-[#292622] border-r bg-[#0b0b0a] text-[#c7bfb4] md:flex md:flex-col",
        "overflow-hidden transition-[width] duration-200",
        sidebarCollapsed ? "w-0 border-r-0" : "w-[252px]",
      )}
    >
      <div className="flex h-16 w-[252px] items-center justify-between px-5">
        <div className="flex items-center gap-3 font-bold text-lg text-white">
          <Icons.sparkles className="size-4 text-[#9b88ff]" />
          Engram
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-[#706a62] hover:text-[#c8bfb2]"
          onClick={toggleSidebar}
          title="Toggle sidebar  ["
        >
          <Icons.chevronLeft className="size-4" />
        </Button>
      </div>

      <nav className="space-y-1 px-3">
        {NAV_VIEWS.map(({ href, label, icon }) => {
          const Icon = Icons[icon];
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href as Route<string>}
              className={cn(
                buttonVariants({ variant: "ghost" }),
                navItemClass,
                active
                  ? "bg-[#22201f] text-white"
                  : "text-[#b7afa5] hover:bg-[#171614] hover:text-white",
              )}
            >
              <span className="flex items-center gap-3">
                <Icon className={cn("size-4", active && "text-[#9b88ff]")} />
                <span className="font-semibold">{label}</span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 px-3">
        <p className="mb-2 px-3 font-bold text-[#736c63] text-[11px] uppercase tracking-[0.14em]">
          Spaces
        </p>
        <div className="space-y-1">
          {spaces.map((space) => {
            const iconKey = (space.icon in SPACE_ICONS ? space.icon : "sparkles") as keyof typeof SPACE_ICONS;
            const Icon = Icons[SPACE_ICONS[iconKey]];
            return (
              <Button
                type="button"
                key={space.id}
                variant="ghost"
                onClick={() => setActiveSpace(space.id)}
                className={cn(
                  "h-[36px] w-full justify-start gap-3 rounded-[7px] px-3 py-2 text-sm font-normal",
                  activeSpaceId === space.id
                    ? "bg-[#22201f] font-semibold text-white"
                    : "text-[#b7afa5] hover:bg-[#171614] hover:text-white",
                )}
              >
                <Icon className="size-4" />
                {space.name}
              </Button>
            );
          })}
          <Button
            type="button"
            variant="ghost"
            className="h-[36px] w-full justify-start gap-3 rounded-[7px] px-3 py-2 text-[#8c857b] text-sm font-normal"
          >
            <Icons.plus className="size-4" />
            New space
          </Button>
        </div>
      </div>

      <div className="mt-8 min-h-0 px-3">
        <p className="mb-2 px-3 font-bold text-[#736c63] text-[11px] uppercase tracking-[0.14em]">
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
    <Button
      type="button"
      variant="ghost"
      onClick={() => jumpToItem(item.id)}
      className="h-[36px] w-full justify-start gap-3 overflow-hidden rounded-[7px] px-3 py-2 text-left text-[#b7afa5] text-sm font-normal hover:bg-[#171614] hover:text-white"
    >
      <Icon className="size-4 shrink-0 text-[#8b8378]" />
      <span className="truncate">{label}</span>
    </Button>
  );
}
