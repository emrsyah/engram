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
        caption_label: "text-sm font-semibold text-[#efe9df]",
        nav: "flex items-center gap-1",
        button_previous: "flex h-7 w-7 items-center justify-center rounded-[6px] text-[#8a8378] hover:bg-[#2e2a24] hover:text-[#efe9df] transition-colors",
        button_next: "flex h-7 w-7 items-center justify-center rounded-[6px] text-[#8a8378] hover:bg-[#2e2a24] hover:text-[#efe9df] transition-colors",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 text-center text-[11px] font-medium text-[#5a5450] pb-1",
        week: "flex mt-1",
        day: "w-9 h-9 p-0 text-center",
        day_button: cn(
          "w-9 h-9 rounded-[6px] text-sm text-[#c8bfb2] transition-colors",
          "hover:bg-[#2e2a24] hover:text-white",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#907ce8]",
        ),
        selected: "[&>button]:bg-[#907ce8] [&>button]:text-[#17131f] [&>button]:font-semibold [&>button]:hover:bg-[#a08ef2]",
        today: "[&>button]:text-[#907ce8] [&>button]:font-semibold",
        outside: "[&>button]:text-[#3a3530] [&>button]:hover:bg-transparent",
        disabled: "[&>button]:text-[#3a3530] [&>button]:cursor-not-allowed [&>button]:hover:bg-transparent",
        range_middle: "[&>button]:rounded-none [&>button]:bg-[#2a2420]",
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
