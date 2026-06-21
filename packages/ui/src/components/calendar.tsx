"use client";

import { DayPicker } from "react-day-picker";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@alphonse/ui/lib/utils";

type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col",
        month: "space-y-3",
        month_caption: "flex items-center justify-between px-1",
        caption_label: "text-sm font-semibold text-ink",
        nav: "flex items-center gap-1",
        button_previous: "flex h-7 w-7 items-center justify-center rounded-[6px] text-ink-muted hover:bg-fill hover:text-ink transition-colors",
        button_next: "flex h-7 w-7 items-center justify-center rounded-[6px] text-ink-muted hover:bg-fill hover:text-ink transition-colors",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 text-center text-[11px] font-medium text-ink-faint pb-1",
        week: "flex mt-1",
        day: "w-9 h-9 p-0 text-center",
        day_button: cn(
          "w-9 h-9 rounded-[6px] text-sm text-ink-2 transition-colors",
          "hover:bg-fill hover:text-white",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-glow",
        ),
        selected: "[&>button]:bg-brand [&>button]:text-brand-ink [&>button]:font-semibold [&>button]:hover:bg-brand-bright",
        today: "[&>button]:text-brand-soft [&>button]:font-semibold",
        outside: "[&>button]:text-ink-ghost [&>button]:hover:bg-transparent",
        disabled: "[&>button]:text-ink-ghost [&>button]:cursor-not-allowed [&>button]:hover:bg-transparent",
        range_middle: "[&>button]:rounded-none [&>button]:bg-fill",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeftIcon className="size-4" />
          ) : (
            <ChevronRightIcon className="size-4" />
          ),
      }}
      {...props}
    />
  );
}
