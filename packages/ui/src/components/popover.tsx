"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "@alphonse/ui/lib/utils";
import * as React from "react";

const PopoverRoot = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverPortal = PopoverPrimitive.Portal;
const PopoverPositioner = PopoverPrimitive.Positioner;

const PopoverContent = React.forwardRef<
  React.ComponentRef<typeof PopoverPrimitive.Popup>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Popup>
>(({ className, ...props }, ref) => (
  <PopoverPortal>
    <PopoverPositioner sideOffset={8}>
      <PopoverPrimitive.Popup
        ref={ref}
        className={cn(
          "z-50 rounded-[10px] border border-[#332e28] bg-[#1e1b17] shadow-xl outline-none",
          "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity duration-150",
          className,
        )}
        {...props}
      />
    </PopoverPositioner>
  </PopoverPortal>
));
PopoverContent.displayName = "PopoverContent";

export { PopoverRoot, PopoverTrigger, PopoverContent };
