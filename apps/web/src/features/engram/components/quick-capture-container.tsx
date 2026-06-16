"use client";

import { useUIStore } from "../ui-store";
import { QuickCaptureBar } from "./quick-capture-bar";

export function QuickCaptureContainer() {
  const { sidebarCollapsed } = useUIStore();

  return (
    <div
      className="pointer-events-none fixed right-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-0 z-30 flex justify-center px-4 transition-[left] duration-200 md:left-[var(--qc-left)]"
      style={
        { "--qc-left": sidebarCollapsed ? "0px" : "252px" } as Record<string, string>
      }
    >
      <div className="pointer-events-auto">
        <QuickCaptureBar />
      </div>
    </div>
  );
}
